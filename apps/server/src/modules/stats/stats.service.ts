import {
  CollectionLogMeta,
  ECollectionLogType,
  MediaItem,
  MediaItemType,
  MediaItemWithParent,
} from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { CronTime } from 'cron'
import { Repository } from 'typeorm'
import { MediaServerFactory } from '../api/media-server/media-server.factory'
import {
  DiskSpaceResource,
  RootFolder,
} from '../api/servarr-api/interfaces/servarr.interface'
import { ServarrService } from '../api/servarr-api/servarr.service'
import { CollectionsService } from '../collections/collections.service'
import { CollectionLog } from '../collections/entities/collection_log.entities'
import { CollectionMedia } from '../collections/entities/collection_media.entities'
import { RuleGroup } from '../rules/entities/rule-group.entities'
import { SonarrSettings } from '../settings/entities/sonarr_settings.entities'
import { SettingsService } from '../settings/settings.service'

export interface AppStatsResponse {
  rules: number
  storage: AppStorageStats
  choppingBlock: AppChoppingBlockStats
  libraries: AppLibraryStats[]
  recentlyAdded: MediaItem[]
  collections: AppCollectionPreview[]
  leavingSoon: AppLeavingSoonItem[]
  tasks: AppTaskStats[]
  configuredServices: AppConfiguredService[]
  recentActivity: AppRecentActivityItem[]
}

interface AppStorageStats {
  totalSpace: number
  usedSpace: number
  freeSpace: number
  sourceCount: number
}

interface AppLibraryStats {
  id: string
  title: string
  type: 'movie' | 'show'
  itemCount: number
  seasonCount?: number
  episodeCount?: number
}

interface AppChoppingBlockStats {
  totalSizeBytes: number
  collections: AppChoppingBlockCollectionStats[]
}

interface AppChoppingBlockCollectionStats {
  id: number
  title: string
  totalSizeBytes: number
  mediaCount: number
}

interface AppCollectionPreview {
  id: number
  title: string
  description?: string
  type: MediaItemType
  libraryId: string
  mediaCount: number
  totalSizeBytes?: number | null
  deleteAfterDays?: number | null
  isActive: boolean
  media: AppCollectionPreviewMedia[]
}

interface AppCollectionPreviewMedia {
  image_path?: string
}

interface AppLeavingSoonItem {
  media: MediaItem | MediaItemWithParent
  collectionId: number
  collectionTitle: string
  deleteDate: string
  daysLeft: number
}

interface AppTaskStats {
  name: string
  nextRun?: string
  lastRun?: string
}

interface AppConfiguredService {
  name: string
  status: 'Connected' | 'Disconnected'
}

interface AppRecentActivityItem {
  id: number
  collectionId: number
  collectionTitle: string
  posterTmdbId?: string
  posterType?: 'movie' | 'show'
  posterPath?: string
  timestamp: string
  message: string
  type: ECollectionLogType
  meta?: CollectionLogMeta
}

function normalizeDiskPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() || '/'
}

function isPathPrefix(parent: string, child: string): boolean {
  if (parent === child) return true
  if (parent === '/') return child.startsWith('/')
  return child.startsWith(`${parent}/`)
}

@Injectable()
export class StatsService {
  private readonly serviceStatusCacheMs = 5 * 60 * 1000
  private serviceStatusCache:
    | { timestamp: number; services: AppConfiguredService[] }
    | undefined
  private serviceStatusRefresh: Promise<void> | undefined

  constructor(
    private readonly mediaServerFactory: MediaServerFactory,
    private readonly servarrService: ServarrService,
    private readonly collectionsService: CollectionsService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(RuleGroup)
    private readonly ruleGroupRepository: Repository<RuleGroup>,
    @InjectRepository(SonarrSettings)
    private readonly sonarrSettingsRepository: Repository<SonarrSettings>,
    @InjectRepository(CollectionLog)
    private readonly collectionLogRepository: Repository<CollectionLog>,
    @InjectRepository(CollectionMedia)
    private readonly collectionMediaRepository: Repository<CollectionMedia>,
  ) {}

  async getStats(): Promise<AppStatsResponse> {
    const [rules, storage, choppingBlock, libraries, collections] =
      await Promise.all([
        this.ruleGroupRepository.count(),
        this.getSonarrStorageStats(),
        this.getChoppingBlockStats(),
        this.getLibraryStats(),
        this.getCollectionPreviews(),
      ])
    const [recentlyAdded, leavingSoon, recentActivity, tasks] =
      await Promise.all([
        this.getRecentlyAdded(libraries),
        this.getLeavingSoon(),
        this.getRecentActivity(),
        this.getTaskStats(),
      ])

    return {
      rules,
      storage,
      choppingBlock,
      libraries,
      recentlyAdded,
      collections,
      leavingSoon,
      tasks,
      configuredServices: await this.getConfiguredServices(),
      recentActivity,
    }
  }

  private async getTaskStats(): Promise<AppTaskStats[]> {
    const settings = await this.settingsService.getSettings()
    const collectionSchedule =
      settings && 'collection_handler_job_cron' in settings
        ? settings.collection_handler_job_cron
        : this.settingsService.collection_handler_job_cron
    const rulesSchedule =
      settings && 'rules_handler_job_cron' in settings
        ? settings.rules_handler_job_cron
        : this.settingsService.rules_handler_job_cron

    return [
      this.getTaskStat('Collection Handler', collectionSchedule),
      this.getTaskStat(
        'Rule Handler',
        rulesSchedule,
        'execute-global-schedule-rules',
      ),
    ]
  }

  private getTaskStat(
    name: string,
    schedule: string,
    jobName: string = name,
  ): AppTaskStats {
    const job = this.schedulerRegistry.getCronJobs().get(jobName)
    const lastRun = job?.lastDate()?.toISOString()
    const now = Date.now()

    if (!schedule) {
      return { name, lastRun }
    }

    const nextRun = this.getNextRunFromSchedule(schedule, now)

    return nextRun
      ? { name, nextRun: nextRun.toISOString(), lastRun }
      : { name, lastRun }
  }

  private getNextRunFromSchedule(
    schedule: string,
    now: number,
  ): Date | undefined {
    try {
      const cronTime = new CronTime(schedule)
      const candidates = cronTime.sendAt(10)

      return candidates
        .map((candidate) => candidate.toJSDate())
        .find((date) => date.getTime() > now)
    } catch {
      return undefined
    }
  }

  private async getConfiguredServices(): Promise<AppConfiguredService[]> {
    const now = Date.now()

    if (
      this.serviceStatusCache &&
      now - this.serviceStatusCache.timestamp < this.serviceStatusCacheMs
    ) {
      return this.serviceStatusCache.services
    }

    const serviceNames = await this.getConfiguredServiceNames()
    const cachedServicesByName = new Map(
      this.serviceStatusCache?.services.map((service) => [
        service.name,
        service,
      ]) ?? [],
    )

    this.refreshConfiguredServiceStatus()

    return serviceNames.map((name) => ({
      name,
      status: cachedServicesByName.get(name)?.status ?? 'Connected',
    }))
  }

  private async getConfiguredServiceNames(): Promise<string[]> {
    const services: string[] = []
    const mediaServerType = this.settingsService.getMediaServerType()

    if (mediaServerType) {
      services.push(mediaServerType === 'jellyfin' ? 'Jellyfin' : 'Plex')
    }

    const sonarrSettings = await this.settingsService.getSonarrSettings()
    if (Array.isArray(sonarrSettings) && sonarrSettings.length > 0) {
      services.push('Sonarr')
    }

    const radarrSettings = await this.settingsService.getRadarrSettings()
    if (Array.isArray(radarrSettings) && radarrSettings.length > 0) {
      services.push('Radarr')
    }

    if (this.settingsService.tautulliConfigured()) {
      services.push('Tautulli')
    }

    if (this.settingsService.seerrConfigured()) {
      services.push('Seerr')
    }

    return services
  }

  private refreshConfiguredServiceStatus(): void {
    if (this.serviceStatusRefresh !== undefined) {
      return
    }

    this.serviceStatusRefresh = this.buildConfiguredServiceStatuses()
      .then((services) => {
        this.serviceStatusCache = {
          timestamp: Date.now(),
          services,
        }
      })
      .catch(() => undefined)
      .finally(() => {
        this.serviceStatusRefresh = undefined
      })
  }

  private async buildConfiguredServiceStatuses(): Promise<
    AppConfiguredService[]
  > {
    const services: AppConfiguredService[] = []
    const mediaServerType = this.settingsService.getMediaServerType()
    const getStatus = async (isConnected: Promise<boolean> | boolean) =>
      (await isConnected) ? 'Connected' : 'Disconnected'

    if (mediaServerType) {
      services.push({
        name: mediaServerType === 'jellyfin' ? 'Jellyfin' : 'Plex',
        status: await getStatus(
          this.settingsService.testMediaServerConnection(),
        ),
      })
    }

    const sonarrSettings = await this.settingsService.getSonarrSettings()
    if (Array.isArray(sonarrSettings) && sonarrSettings.length > 0) {
      const statuses = await Promise.all(
        sonarrSettings.map((setting) =>
          this.settingsService.testSonarr(setting.id),
        ),
      )
      services.push({
        name: 'Sonarr',
        status: statuses.every((status) => status.status === 'OK')
          ? 'Connected'
          : 'Disconnected',
      })
    }

    const radarrSettings = await this.settingsService.getRadarrSettings()
    if (Array.isArray(radarrSettings) && radarrSettings.length > 0) {
      const statuses = await Promise.all(
        radarrSettings.map((setting) =>
          this.settingsService.testRadarr(setting.id),
        ),
      )
      services.push({
        name: 'Radarr',
        status: statuses.every((status) => status.status === 'OK')
          ? 'Connected'
          : 'Disconnected',
      })
    }

    if (this.settingsService.tautulliConfigured()) {
      services.push({
        name: 'Tautulli',
        status: await getStatus(
          this.settingsService
            .testTautulli()
            .then((result) => result.status === 'OK'),
        ),
      })
    }

    if (this.settingsService.seerrConfigured()) {
      services.push({
        name: 'Seerr',
        status: await getStatus(
          this.settingsService
            .testSeerr()
            .then((result) => result.status === 'OK'),
        ),
      })
    }

    return services
  }

  private async getRecentActivity(): Promise<AppRecentActivityItem[]> {
    const logs = await this.collectionLogRepository.find({
      relations: ['collection'],
      order: { id: 'DESC' },
      take: 20,
    })
    return Promise.all(
      logs
        .filter((log) => log.collection)
        .map(async (log) => {
          const thumbnail = this.getRecentActivityThumbnail(log.meta)
          const resolvedThumbnail =
            thumbnail.posterTmdbId || thumbnail.posterPath
              ? thumbnail
              : await this.getRecentActivityCollectionMediaThumbnail(log)

          return {
            id: log.id,
            collectionId: log.collection.id,
            collectionTitle: log.collection.title,
            ...resolvedThumbnail,
            timestamp: log.timestamp.toISOString(),
            message: log.message,
            type: log.type,
            meta: log.meta,
          }
        }),
    )
  }

  private getRecentActivityThumbnail(
    meta: CollectionLogMeta | undefined,
  ): Pick<AppRecentActivityItem, 'posterTmdbId' | 'posterType' | 'posterPath'> {
    try {
      if (
        meta &&
        'media' in meta &&
        meta.media?.tmdbId &&
        meta.media.posterType
      ) {
        return {
          posterTmdbId: meta.media.tmdbId,
          posterType: meta.media.posterType,
        }
      }
    } catch {
      return {}
    }

    return {}
  }

  private async getRecentActivityCollectionMediaThumbnail(
    log: CollectionLog,
  ): Promise<
    Pick<AppRecentActivityItem, 'posterTmdbId' | 'posterType' | 'posterPath'>
  > {
    const mediaServerId =
      log.meta && 'media' in log.meta
        ? log.meta.media?.mediaServerId
        : undefined

    if (!mediaServerId) {
      return {}
    }

    const collectionMedia = await this.collectionMediaRepository.findOne({
      where: {
        collectionId: log.collection.id,
        mediaServerId,
      },
    })

    if (!collectionMedia) {
      return {}
    }

    return {
      posterTmdbId: collectionMedia.tmdbId?.toString(),
      posterType: log.collection.type === 'movie' ? 'movie' : 'show',
      posterPath: collectionMedia.image_path,
    }
  }

  private async getChoppingBlockStats(): Promise<AppChoppingBlockStats> {
    const collections = await this.collectionsService.getAllCollections()
    const sizedCollections = (
      await Promise.all(
        collections.map(async (collection) => ({
          id: collection.id,
          title: collection.title,
          totalSizeBytes: Number(collection.totalSizeBytes ?? 0),
          mediaCount: await this.collectionsService.getCollectionMediaCount(
            collection.id,
          ),
        })),
      )
    )
      .filter(
        (collection) =>
          Number.isFinite(collection.totalSizeBytes) &&
          collection.totalSizeBytes > 0,
      )
      .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)

    return {
      totalSizeBytes: sizedCollections.reduce(
        (total, collection) => total + collection.totalSizeBytes,
        0,
      ),
      collections: sizedCollections,
    }
  }

  private async getLibraryStats(): Promise<AppLibraryStats[]> {
    const mediaServer = await this.mediaServerFactory.getService()
    const libraries = await mediaServer.getLibraries()

    return Promise.all(
      libraries.map(async (library) => {
        const itemCount = await mediaServer.getLibraryContentCount(
          library.id,
          library.type,
        )

        if (library.type !== 'show') {
          return {
            id: library.id,
            title: library.title,
            type: library.type,
            itemCount,
          }
        }

        const [seasonCount, episodeCount] = await Promise.all([
          mediaServer.getLibraryContentCount(library.id, 'season'),
          mediaServer.getLibraryContentCount(library.id, 'episode'),
        ])

        return {
          id: library.id,
          title: library.title,
          type: library.type,
          itemCount,
          seasonCount,
          episodeCount,
        }
      }),
    )
  }

  private async getRecentlyAdded(
    libraries: AppLibraryStats[],
  ): Promise<MediaItem[]> {
    const mediaServer = await this.mediaServerFactory.getService()
    const recentItems = (
      await Promise.all(
        libraries.map(async (library) => {
          try {
            return await mediaServer.getRecentlyAdded(library.id, {
              limit: 10,
              type: library.type,
            })
          } catch {
            return []
          }
        }),
      )
    ).flat()

    return recentItems
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      )
      .slice(0, 12)
  }

  private async getCollectionPreviews(): Promise<AppCollectionPreview[]> {
    const collections = await this.collectionsService.getCollections()

    return (collections ?? [])
      .map((collection) => ({
        id: collection.id,
        title: collection.manualCollection
          ? `${collection.manualCollectionName} (manual)`
          : collection.title,
        description: collection.manualCollection
          ? `Handled by rule: '${collection.title}'`
          : collection.description,
        type: collection.type,
        libraryId: collection.libraryId,
        mediaCount: collection.media?.length ?? 0,
        totalSizeBytes: collection.totalSizeBytes,
        deleteAfterDays: collection.deleteAfterDays,
        isActive: collection.isActive,
        media: (collection.media ?? [])
          .slice(0, 2)
          .map((media) => ({ image_path: media.image_path })),
      }))
      .sort((a, b) => b.mediaCount - a.mediaCount)
      .slice(0, 12)
  }

  private async getLeavingSoon(): Promise<AppLeavingSoonItem[]> {
    const collections = (await this.collectionsService.getCalendarData()) ?? []
    const mediaServer = await this.mediaServerFactory.getService()
    const candidates = collections
      .flatMap((collection) =>
        collection.media.map((media) => {
          const deleteDate = new Date(media.addDate)
          deleteDate.setDate(deleteDate.getDate() + collection.deleteAfterDays)

          return {
            mediaServerId: media.mediaServerId,
            collectionId: collection.id,
            collectionTitle: collection.title,
            deleteDate,
          }
        }),
      )
      .filter((item) => Number.isFinite(item.deleteDate.getTime()))
      .sort((a, b) => a.deleteDate.getTime() - b.deleteDate.getTime())
    const selectedCandidates = this.pickLeavingSoonCandidates(candidates, 24)

    return (
      await Promise.all(
        selectedCandidates.map(async (item) => {
          const media = await mediaServer.getMetadata(item.mediaServerId)

          if (!media) {
            return undefined
          }

          const parentId =
            media.type === 'episode'
              ? media.grandparentId
              : media.type === 'season'
                ? media.parentId
                : undefined
          const parentItem = parentId
            ? await mediaServer.getMetadata(parentId)
            : undefined
          const mediaWithParent = parentItem
            ? ({ ...media, parentItem } as MediaItemWithParent)
            : media

          const daysLeft = Math.ceil(
            (item.deleteDate.getTime() - Date.now()) / 86400000,
          )

          return {
            media: mediaWithParent,
            collectionId: item.collectionId,
            collectionTitle: item.collectionTitle,
            deleteDate: item.deleteDate.toISOString(),
            daysLeft,
          }
        }),
      )
    ).filter((item): item is AppLeavingSoonItem => item !== undefined)
  }

  private pickLeavingSoonCandidates<T extends { deleteDate: Date }>(
    items: T[],
    limit: number,
  ): T[] {
    if (items.length <= limit) {
      return items
    }

    const cutoff = items[limit - 1].deleteDate.getTime()
    const beforeCutoff = items.filter(
      (item) => item.deleteDate.getTime() < cutoff,
    )
    const tiedAtCutoff = items.filter(
      (item) => item.deleteDate.getTime() === cutoff,
    )
    const remaining = limit - beforeCutoff.length

    return [...beforeCutoff, ...this.shuffle(tiedAtCutoff).slice(0, remaining)]
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5)
  }

  private async getSonarrStorageStats(): Promise<AppStorageStats> {
    const settings = await this.sonarrSettingsRepository.find()
    const diskspaceByRootFolder = (
      await Promise.all(
        settings.map(async (setting) => {
          try {
            const client = await this.servarrService.getSonarrApiClient(
              setting.id,
            )
            const [diskspace, rootFolders] = await Promise.all([
              client.getDiskspace(),
              client.getRootFolders(),
            ])

            return this.getRootFolderDiskspace(
              diskspace ?? [],
              rootFolders ?? [],
            )
          } catch {
            return []
          }
        }),
      )
    ).flat()
    const diskspace =
      diskspaceByRootFolder.length > 0
        ? diskspaceByRootFolder
        : (
            await Promise.all(
              settings.map(async (setting) => {
                try {
                  const client = await this.servarrService.getSonarrApiClient(
                    setting.id,
                  )
                  return (await client.getDiskspace()) ?? []
                } catch {
                  return []
                }
              }),
            )
          ).flat()
    const uniqueDiskspace = new Map<string, DiskSpaceResource>()

    for (const entry of diskspace) {
      const key = entry.path ?? `${entry.totalSpace}-${entry.freeSpace}`
      if (!uniqueDiskspace.has(key)) {
        uniqueDiskspace.set(key, entry)
      }
    }

    const totals = [...uniqueDiskspace.values()].reduce(
      (acc, entry) => {
        const totalSpace = entry.totalSpace ?? 0
        const freeSpace = entry.freeSpace ?? 0

        acc.totalSpace += totalSpace
        acc.freeSpace += freeSpace
        return acc
      },
      { totalSpace: 0, freeSpace: 0 },
    )

    return {
      totalSpace: totals.totalSpace,
      freeSpace: totals.freeSpace,
      usedSpace: Math.max(totals.totalSpace - totals.freeSpace, 0),
      sourceCount: uniqueDiskspace.size,
    }
  }

  private getRootFolderDiskspace(
    diskspace: DiskSpaceResource[],
    rootFolders: RootFolder[],
  ): DiskSpaceResource[] {
    const result = new Map<string, DiskSpaceResource>()

    for (const rootFolder of rootFolders) {
      const rootPath = normalizeDiskPath(rootFolder.path)
      let bestMatch: DiskSpaceResource | undefined
      let bestMatchLength = -1

      for (const entry of diskspace) {
        if (!entry.path) continue

        const diskPath = normalizeDiskPath(entry.path)
        if (!isPathPrefix(diskPath, rootPath)) continue

        if (diskPath.length > bestMatchLength) {
          bestMatch = entry
          bestMatchLength = diskPath.length
        }
      }

      if (bestMatch?.path) {
        result.set(normalizeDiskPath(bestMatch.path), bestMatch)
      }
    }

    return [...result.values()]
  }
}
