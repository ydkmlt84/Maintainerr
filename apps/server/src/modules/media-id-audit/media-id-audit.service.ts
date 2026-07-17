import { MediaServerType } from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { MediaServerFactory } from '../api/media-server/media-server.factory'
import { PlexMapper } from '../api/media-server/plex/plex.mapper'
import { PlexApiService } from '../api/plex-api/plex-api.service'
import { PlexLibraryItem } from '../api/plex-api/interfaces/library.interfaces'
import { ServarrService } from '../api/servarr-api/servarr.service'
import { MaintainerrLogger } from '../logging/logs.service'
import { NotificationPayload } from '../notifications/agents/agent'
import { NotificationType } from '../notifications/notifications-interfaces'
import { NotificationService } from '../notifications/notifications.service'
import { RadarrSettings } from '../settings/entities/radarr_settings.entities'
import { SonarrSettings } from '../settings/entities/sonarr_settings.entities'
import { SettingsService } from '../settings/settings.service'
import { MediaIdAuditFinding } from './entities/media-id-audit-finding.entities'
import { MediaIdAuditRun } from './entities/media-id-audit-run.entities'
import { compareMediaIds } from './media-id-audit.comparison'
import { is4kLibrary, mapPlexItemForAudit } from './media-id-audit.mapper'
import {
  AuditArrItem,
  AuditPlexItem,
  MediaIdAuditCategory,
  MediaIdAuditFindingDraft,
} from './media-id-audit.types'

const PAGE_SIZE = 500
const RETAINED_RUNS = 10

@Injectable()
export class MediaIdAuditService {
  constructor(
    @InjectRepository(MediaIdAuditRun)
    private readonly runRepository: Repository<MediaIdAuditRun>,
    @InjectRepository(MediaIdAuditFinding)
    private readonly findingRepository: Repository<MediaIdAuditFinding>,
    private readonly mediaServerFactory: MediaServerFactory,
    private readonly plexApiService: PlexApiService,
    private readonly servarrService: ServarrService,
    private readonly settingsService: SettingsService,
    private readonly notificationService: NotificationService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(MediaIdAuditService.name)
  }

  public async runAudit(
    abortSignal: AbortSignal,
    sendNotification: boolean,
  ): Promise<MediaIdAuditRun> {
    const run = await this.runRepository.save(
      this.runRepository.create({
        startedAt: new Date(),
        status: 'running',
      }),
    )

    try {
      abortSignal.throwIfAborted()
      const plexItems = await this.getPlexItems(abortSignal)
      const arrItems = await this.getArrItems(abortSignal)
      const comparison = compareMediaIds(plexItems, arrItems)
      const previousRun = await this.runRepository.findOne({
        where: { status: 'completed' },
        order: { completedAt: 'DESC' },
        relations: { findings: true },
      })
      const now = new Date()
      const persistence = this.buildPersistedFindings(
        run,
        comparison.findings,
        previousRun?.findings ?? [],
        now,
      )
      const findings = persistence.findings
      const currentFindings = findings.filter(
        (finding) => finding.state === 'current',
      )

      Object.assign(run, {
        completedAt: now,
        status: 'completed',
        totalPlexItems: plexItems.length,
        matchedCount: comparison.matchedCount,
        findingCount: currentFindings.length,
        newCount: currentFindings.filter((finding) => finding.isNew).length,
        resolvedCount: persistence.resolvedCount,
        probableMismatchCount: this.countCategory(
          currentFindings,
          'probable_mismatch',
        ),
        missingPlexIdCount: this.countCategory(
          currentFindings,
          'missing_plex_id',
        ),
        notFoundInArrCount: this.countCategory(
          currentFindings,
          'not_found_in_arr',
        ),
        duplicatePlexIdCount: this.countCategory(
          currentFindings,
          'duplicate_plex_id',
        ),
        ambiguousTitleMatchCount: this.countCategory(
          currentFindings,
          'ambiguous_title_match',
        ),
        plexTrashCount: this.countCategory(currentFindings, 'plex_trash'),
      } satisfies Partial<MediaIdAuditRun>)

      await this.runRepository.save(run)
      if (findings.length > 0) {
        await this.findingRepository.save(findings, { chunk: 500 })
      }
      run.findings = findings
      await this.pruneOldRuns()

      this.logger.log(
        `Media ID audit completed: ${run.totalPlexItems} Plex items, ${run.findingCount} findings, ${run.resolvedCount} resolved`,
      )
      if (sendNotification) {
        await this.sendDigest(run)
      }

      return run
    } catch (error) {
      run.status = 'failed'
      run.completedAt = new Date()
      run.error = error instanceof Error ? error.message : String(error)
      await this.runRepository.save(run)
      this.logger.error(`Media ID audit failed: ${run.error}`, error)
      throw error
    }
  }

  public getLatestRun(): Promise<MediaIdAuditRun | null> {
    return this.runRepository.findOne({
      where: {},
      order: { startedAt: 'DESC' },
      relations: { findings: true },
    })
  }

  public getRun(id: number): Promise<MediaIdAuditRun | null> {
    return this.runRepository.findOne({
      where: { id },
      relations: { findings: true },
    })
  }

  public getRuns(limit = 20): Promise<MediaIdAuditRun[]> {
    return this.runRepository.find({
      order: { startedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    })
  }

  private async getPlexItems(
    abortSignal: AbortSignal,
  ): Promise<AuditPlexItem[]> {
    const configuredType =
      await this.mediaServerFactory.getConfiguredServerType()
    if (configuredType !== MediaServerType.PLEX) {
      throw new Error('The media ID audit currently requires Plex')
    }

    const mediaServer = await this.mediaServerFactory.getServiceByType(
      MediaServerType.PLEX,
    )
    const libraries = await mediaServer.getLibraries()
    const items: AuditPlexItem[] = []

    for (const library of libraries.filter(
      (library) => !is4kLibrary(library),
    )) {
      abortSignal.throwIfAborted()
      const trashItems = await this.getUncachedPlexLibraryItems(
        library.id,
        true,
        abortSignal,
      )
      const trashRatingKeys = new Set(trashItems.map((item) => item.ratingKey))
      const libraryItems = await this.getUncachedPlexLibraryItems(
        library.id,
        false,
        abortSignal,
      )

      items.push(
        ...libraryItems.map((item) =>
          mapPlexItemForAudit(
            PlexMapper.toMediaItem(item),
            library,
            trashRatingKeys.has(item.ratingKey),
          ),
        ),
      )
    }

    return items
  }

  private async getUncachedPlexLibraryItems(
    libraryId: string,
    trash: boolean,
    abortSignal: AbortSignal,
  ): Promise<PlexLibraryItem[]> {
    const items: PlexLibraryItem[] = []
    let offset = 0
    let totalSize = 0

    do {
      const page = await this.plexApiService.getLibraryContents(
        libraryId,
        { offset, size: PAGE_SIZE, trash },
        undefined,
        false,
      )
      if (!page) {
        throw new Error(
          `Plex library inventory failed for library ${libraryId}`,
        )
      }

      totalSize = page.totalSize
      items.push(...page.items)
      offset += page.items.length
      abortSignal.throwIfAborted()

      if (page.items.length === 0) break
    } while (offset < totalSize)

    return items
  }

  private async getArrItems(abortSignal: AbortSignal): Promise<AuditArrItem[]> {
    const [radarrResult, sonarrResult] = await Promise.all([
      this.settingsService.getRadarrSettings(),
      this.settingsService.getSonarrSettings(),
    ])
    const radarrSettings = Array.isArray(radarrResult) ? radarrResult : []
    const sonarrSettings = Array.isArray(sonarrResult) ? sonarrResult : []
    const items: AuditArrItem[] = []

    for (const setting of radarrSettings as RadarrSettings[]) {
      abortSignal.throwIfAborted()
      const client = await this.servarrService.getRadarrApiClient(setting.id)
      const movies = await client.getMovies()
      if (!movies) {
        throw new Error(`Radarr inventory failed for ${setting.serverName}`)
      }
      items.push(
        ...movies
          .filter((movie) => movie.tmdbId)
          .map((movie) => ({
            mediaType: 'movie' as const,
            title: movie.title,
            year: movie.year,
            providerId: String(movie.tmdbId),
            serverName: setting.serverName,
            itemId: movie.id,
          })),
      )
    }

    for (const setting of sonarrSettings as SonarrSettings[]) {
      abortSignal.throwIfAborted()
      const client = await this.servarrService.getSonarrApiClient(setting.id)
      const series = await client.getSeries()
      if (!series) {
        throw new Error(`Sonarr inventory failed for ${setting.serverName}`)
      }
      items.push(
        ...series
          .filter((show) => show.tvdbId)
          .map((show) => ({
            mediaType: 'show' as const,
            title: show.title,
            year: show.year,
            providerId: String(show.tvdbId),
            serverName: setting.serverName,
            itemId: show.id,
          })),
      )
    }

    return items
  }

  private buildPersistedFindings(
    run: MediaIdAuditRun,
    drafts: MediaIdAuditFindingDraft[],
    previousFindings: MediaIdAuditFinding[],
    now: Date,
  ): { findings: MediaIdAuditFinding[]; resolvedCount: number } {
    const previousCurrent = new Map(
      previousFindings
        .filter((finding) => finding.state === 'current')
        .map((finding) => [finding.fingerprint, finding]),
    )
    const currentFingerprints = new Set(
      drafts.map((finding) => finding.fingerprint),
    )
    const current = drafts.map((draft) => {
      const previous = previousCurrent.get(draft.fingerprint)
      return this.findingRepository.create({
        ...draft,
        run,
        runId: run.id,
        state: 'current',
        isNew: !previous,
        firstDetectedAt: previous?.firstDetectedAt ?? now,
        lastDetectedAt: now,
      })
    })
    const resolvedCount = [...previousCurrent.keys()].filter(
      (findingFingerprint) => !currentFingerprints.has(findingFingerprint),
    ).length

    return { findings: current, resolvedCount }
  }

  private countCategory(
    findings: MediaIdAuditFinding[],
    category: MediaIdAuditCategory,
  ) {
    return findings.filter((finding) => finding.category === category).length
  }

  private async pruneOldRuns() {
    const runs = await this.runRepository.find({
      select: { id: true },
      order: { startedAt: 'DESC' },
    })
    const oldIds = runs.slice(RETAINED_RUNS).map((run) => run.id)
    if (oldIds.length > 0) {
      await this.runRepository.delete({ id: In(oldIds) })
    }
  }

  private async sendDigest(run: MediaIdAuditRun) {
    const priority = [
      'probable_mismatch',
      'missing_plex_id',
      'duplicate_plex_id',
      'ambiguous_title_match',
      'plex_trash',
      'not_found_in_arr',
    ] satisfies MediaIdAuditCategory[]
    const current = run.findings
      .filter((finding) => finding.state === 'current')
      .sort(
        (left, right) =>
          priority.indexOf(left.category) - priority.indexOf(right.category),
      )
    const lines = current
      .slice(0, 8)
      .map(
        (finding) =>
          `- ${finding.title}${finding.year ? ` (${finding.year})` : ''}: ${this.categoryLabel(finding.category)}`,
      )
    const reportUrl = this.getReportUrl()
    const summary = `${run.findingCount} current, ${run.newCount} new, ${run.resolvedCount} resolved`
    const message = [
      summary,
      ...lines,
      current.length > lines.length
        ? `- ${current.length - lines.length} more in the report`
        : undefined,
      reportUrl ? `[View full report](${reportUrl})` : undefined,
    ]
      .filter(Boolean)
      .join('\n')
    const payload: NotificationPayload = {
      subject: 'Media ID audit completed',
      message,
    }

    await this.notificationService.sendNotification(
      NotificationType.MEDIA_ID_AUDIT,
      payload,
    )
  }

  private getReportUrl() {
    const configuredUrl = this.settingsService.applicationUrl?.trim()
    if (!configuredUrl) return undefined

    try {
      const baseUrl = /^https?:\/\//i.test(configuredUrl)
        ? configuredUrl
        : `http://${configuredUrl}`
      return new URL(
        'settings/reports',
        baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
      ).toString()
    } catch {
      return undefined
    }
  }

  private categoryLabel(category: MediaIdAuditCategory) {
    return category.replaceAll('_', ' ')
  }
}
