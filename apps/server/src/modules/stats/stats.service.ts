import {
  CollectionLogMeta,
  ECollectionLogType,
  MediaItem,
  MediaItemType,
  MediaItemWithParent,
  MediaProviderIds,
  EPlexDataType,
} from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { CronTime } from 'cron'
import { Repository } from 'typeorm'
import { MediaServerFactory } from '../api/media-server/media-server.factory'
import { PlexApiService } from '../api/plex-api/plex-api.service'
import { PlexLibraryItem } from '../api/plex-api/interfaces/library.interfaces'
import {
  DiskSpaceResource,
  RootFolder,
} from '../api/servarr-api/interfaces/servarr.interface'
import { ServarrService } from '../api/servarr-api/servarr.service'
import {
  TautulliApiService,
  TautulliHomeStatRow,
  TautulliRecentlyAddedItem,
} from '../api/tautulli-api/tautulli-api.service'
import { CollectionsService } from '../collections/collections.service'
import { CollectionLog } from '../collections/entities/collection_log.entities'
import { CollectionMedia } from '../collections/entities/collection_media.entities'
import { ServarrAction } from '../collections/interfaces/collection.interface'
import {
  PlexTrashItem,
  PlexTrashService,
} from '../plex-trash/plex-trash.service'
import { RuleGroup } from '../rules/entities/rule-group.entities'
import { Exclusion } from '../rules/entities/exclusion.entities'
import { SonarrSettings } from '../settings/entities/sonarr_settings.entities'
import { SettingsService } from '../settings/settings.service'

export interface AppStatsResponse {
  rules: number
  storage: AppStorageStats
  choppingBlock: AppChoppingBlockStats
  libraries: AppLibraryStats[]
  recentlyAdded: AppRecentlyAddedItem[]
  popularMovies: AppPopularMediaItem[]
  popularTv: AppPopularMediaItem[]
  oldestItems: AppLibraryRankingItem[]
  biggestItems: AppLibraryRankingItem[]
  collections: AppCollectionPreview[]
  leavingSoon: AppLeavingSoonItem[]
  plexTrash: PlexTrashItem[]
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

export interface AppRecentlyAddedItem extends MediaItem {
  tautulliPosterPath?: string
}

export interface AppPopularMediaItem {
  title: string
  year?: number
  usersWatched: number
  totalPlays: number
  ratingKey: string
  posterPath?: string
  backdropPath?: string
}

export interface AppLibraryRankingItem {
  title: string
  ratingKey: string
  addedAt: string
  sizeBytes: number
  posterPath?: string
  backdropPath?: string
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

export interface AppLeavingSoonItem {
  media: MediaItem | MediaItemWithParent
  collectionId: number
  collectionTitle: string
  deleteDate: string
  daysLeft: number
}

export interface AppActionableExclusionItem {
  media: MediaItem | MediaItemWithParent
  exclusionId: number
  scope: 'global' | 'collection'
  collectionId?: number
  collectionTitle?: string
  expiresAt?: string
}

export interface AppManuallyAddedItem {
  media: MediaItem | MediaItemWithParent
}

export const dedupeLeavingSoonCandidates = <
  T extends { mediaServerId: string; deleteDate: Date },
>(
  items: T[],
): T[] => [
  ...items
    .reduce((uniqueItems, item) => {
      const current = uniqueItems.get(item.mediaServerId)
      if (!current || item.deleteDate < current.deleteDate) {
        uniqueItems.set(item.mediaServerId, item)
      }
      return uniqueItems
    }, new Map<string, T>())
    .values(),
]

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

function optionalNumber(value: string): number | undefined {
  if (!value) return undefined

  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function optionalUnixDate(value: string): Date | undefined {
  const seconds = optionalNumber(value)
  return seconds === undefined ? undefined : new Date(seconds * 1000)
}

function getTautulliProviderIds(guids: string[]): MediaProviderIds {
  const providerIds: MediaProviderIds = {}

  for (const guid of guids ?? []) {
    const match = guid.match(/^(imdb|tmdb|tvdb):\/\/(.+)$/i)
    if (!match) continue

    const provider = match[1].toLowerCase() as keyof MediaProviderIds
    providerIds[provider] = [...(providerIds[provider] ?? []), match[2]]
  }

  return providerIds
}

export function mapTautulliRecentlyAddedItem(
  item: TautulliRecentlyAddedItem,
): AppRecentlyAddedItem | undefined {
  if (!['movie', 'show', 'season', 'episode'].includes(item.media_type)) {
    return undefined
  }

  const audienceRating = optionalNumber(item.audience_rating)

  return {
    id: item.rating_key,
    parentId: item.parent_rating_key || undefined,
    grandparentId: item.grandparent_rating_key || undefined,
    title: item.title,
    parentTitle: item.parent_title || undefined,
    grandparentTitle: item.grandparent_title || undefined,
    guid: item.guid,
    type: item.media_type as MediaItemType,
    addedAt: optionalUnixDate(item.added_at) ?? new Date(0),
    updatedAt: optionalUnixDate(item.updated_at),
    providerIds: getTautulliProviderIds(item.guids),
    mediaSources: [],
    library: {
      id: item.section_id,
      title: item.library_name,
    },
    summary: item.summary || undefined,
    lastViewedAt: optionalUnixDate(item.last_viewed_at),
    year: optionalNumber(item.year),
    durationMs: optionalNumber(item.duration),
    originallyAvailableAt: item.originally_available_at
      ? new Date(item.originally_available_at)
      : undefined,
    contentRating: item.content_rating || undefined,
    ratings:
      audienceRating === undefined
        ? []
        : [{ source: 'audience', value: audienceRating, type: 'audience' }],
    userRating: optionalNumber(item.user_rating),
    genres: (item.genres ?? []).map((name) => ({ name })),
    childCount: optionalNumber(item.child_count),
    index: optionalNumber(item.media_index),
    parentIndex: optionalNumber(item.parent_media_index),
    collections: item.collections ?? [],
    labels: item.labels ?? [],
    tautulliPosterPath:
      item.media_type === 'episode'
        ? item.grandparent_thumb || item.parent_thumb || item.thumb || undefined
        : item.thumb ||
          item.parent_thumb ||
          item.grandparent_thumb ||
          undefined,
  }
}

export function mapPlexLibraryRankingItem(
  item: PlexLibraryItem,
): AppLibraryRankingItem {
  const episodeContext =
    item.type === 'episode' &&
    item.parentIndex !== undefined &&
    item.index !== undefined
      ? `S${String(item.parentIndex).padStart(2, '0')}E${String(item.index).padStart(2, '0')}`
      : undefined

  return {
    title:
      item.type === 'episode'
        ? `${item.grandparentTitle || item.parentTitle || item.title}${episodeContext ? ` - ${episodeContext}` : ''}`
        : item.title,
    ratingKey: item.ratingKey,
    addedAt: new Date(item.addedAt * 1000).toISOString(),
    sizeBytes: (item.Media ?? []).reduce(
      (total, media) =>
        total +
        (media.Part ?? []).reduce(
          (mediaTotal, part) => mediaTotal + (part.size || 0),
          0,
        ),
      0,
    ),
    posterPath: item.grandparentThumb || item.thumb || undefined,
    backdropPath: item.art || undefined,
  }
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
    private readonly plexApiService: PlexApiService,
    private readonly servarrService: ServarrService,
    private readonly tautulliApiService: TautulliApiService,
    private readonly collectionsService: CollectionsService,
    private readonly plexTrashService: PlexTrashService,
    private readonly settingsService: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(RuleGroup)
    private readonly ruleGroupRepository: Repository<RuleGroup>,
    @InjectRepository(Exclusion)
    private readonly exclusionRepository: Repository<Exclusion>,
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
    const [
      recentlyAdded,
      popularity,
      libraryRankings,
      leavingSoon,
      recentActivity,
      tasks,
      plexTrash,
    ] = await Promise.all([
      this.getRecentlyAdded(libraries),
      this.getPopularityStats(),
      this.getLibraryRankings(libraries),
      this.getLeavingSoon(undefined, 24),
      this.getRecentActivity(),
      this.getTaskStats(),
      this.plexApiService.isPlexSetup()
        ? this.plexTrashService.getItems()
        : Promise.resolve([]),
    ])

    return {
      rules,
      storage,
      choppingBlock,
      libraries,
      recentlyAdded,
      popularMovies: popularity.movies,
      popularTv: popularity.tv,
      oldestItems: libraryRankings.oldest,
      biggestItems: libraryRankings.biggest,
      collections,
      leavingSoon,
      plexTrash,
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
  ): Promise<AppRecentlyAddedItem[]> {
    const tautulliItems = await this.tautulliApiService.getRecentlyAdded(12)

    if (tautulliItems !== null) {
      return tautulliItems
        .map(mapTautulliRecentlyAddedItem)
        .filter((item): item is MediaItem => item !== undefined)
    }

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

  private async getPopularityStats(): Promise<{
    movies: AppPopularMediaItem[]
    tv: AppPopularMediaItem[]
  }> {
    const homeStats = await this.tautulliApiService.getHomeStats(30, 5)
    if (!homeStats) return { movies: [], tv: [] }

    const mapRows = (statId: string): AppPopularMediaItem[] =>
      (homeStats.find((stat) => stat.stat_id === statId)?.rows ?? []).map(
        (row) => this.mapPopularMediaItem(row),
      )

    return {
      movies: mapRows('popular_movies'),
      tv: mapRows('popular_tv'),
    }
  }

  private mapPopularMediaItem(row: TautulliHomeStatRow): AppPopularMediaItem {
    return {
      title: row.title,
      year: optionalNumber(String(row.year ?? '')),
      usersWatched: optionalNumber(String(row.users_watched ?? '')) ?? 0,
      totalPlays: optionalNumber(String(row.total_plays ?? '')) ?? 0,
      ratingKey: String(row.grandparent_rating_key || row.rating_key),
      posterPath: row.grandparent_thumb || row.thumb || undefined,
      backdropPath: row.art || undefined,
    }
  }

  private async getLibraryRankings(libraries: AppLibraryStats[]): Promise<{
    oldest: AppLibraryRankingItem[]
    biggest: AppLibraryRankingItem[]
  }> {
    if (!this.plexApiService.isPlexSetup()) {
      return { oldest: [], biggest: [] }
    }

    const rankingLibraries = libraries.filter(
      (library) => !/(^|\W)4k(\W|$)/i.test(library.title),
    )

    const results = await Promise.all(
      rankingLibraries.map(async (library) => {
        const type =
          library.type === 'movie'
            ? EPlexDataType.MOVIES
            : EPlexDataType.EPISODES

        try {
          const [oldest, biggest] = await Promise.all([
            this.plexApiService.getLibraryContents(
              library.id,
              { size: 5, sort: 'addedAt:asc' },
              type,
            ),
            this.plexApiService.getLibraryContents(
              library.id,
              { size: 25, sort: 'mediaSize:desc' },
              type,
            ),
          ])

          return {
            oldest: oldest?.items ?? [],
            biggest: biggest?.items ?? [],
          }
        } catch {
          return { oldest: [], biggest: [] }
        }
      }),
    )

    const oldest = results
      .flatMap((result) => result.oldest)
      .sort((left, right) => left.addedAt - right.addedAt)
      .slice(0, 5)
      .map(mapPlexLibraryRankingItem)
    const biggest = results
      .flatMap((result) => result.biggest)
      .map(mapPlexLibraryRankingItem)
      .sort((left, right) => right.sizeBytes - left.sizeBytes)
      .slice(0, 5)

    return { oldest, biggest }
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

  public async getLeavingSoon(
    libraryId?: string,
    limit?: number,
  ): Promise<AppLeavingSoonItem[]> {
    const collections =
      (await this.collectionsService.getCalendarData(libraryId)) ?? []
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
    const uniqueCandidates = dedupeLeavingSoonCandidates(candidates)
    const selectedCandidates =
      limit === undefined
        ? uniqueCandidates
        : this.pickLeavingSoonCandidates(uniqueCandidates, limit)

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

  public async getActionableExclusions(
    libraryId?: string,
  ): Promise<AppActionableExclusionItem[]> {
    const [ruleGroups, exclusions] = await Promise.all([
      this.ruleGroupRepository.find({ relations: { collection: true } }),
      this.exclusionRepository
        .createQueryBuilder('exclusion')
        .where('(exclusion.expiresAt IS NULL OR exclusion.expiresAt > :now)', {
          now: new Date(),
        })
        .orderBy('exclusion.id', 'DESC')
        .getMany(),
    ])
    const actionableGroups = ruleGroups.filter(
      (group) =>
        group.isActive &&
        group.collection?.isActive &&
        group.collection.arrAction !== ServarrAction.DO_NOTHING &&
        (!libraryId || group.libraryId === libraryId),
    )
    const groupsById = new Map(
      actionableGroups.map((group) => [group.id, group]),
    )
    const mediaServer = await this.mediaServerFactory.getService()

    const isTypeRelevant = (exclusion: Exclusion, group: RuleGroup) => {
      const acceptedTypes: MediaItemType[] = [group.dataType]
      if (group.dataType === 'season') acceptedTypes.push('show')
      if (group.dataType === 'episode') acceptedTypes.push('show', 'season')
      return exclusion.type ? acceptedTypes.includes(exclusion.type) : true
    }

    const exclusionFamilies = [
      ...exclusions
        .reduce((families, exclusion) => {
          const key = `${exclusion.ruleGroupId ?? 'global'}:${exclusion.parent ?? exclusion.mediaServerId}`
          const family = families.get(key) ?? []
          family.push(exclusion)
          families.set(key, family)
          return families
        }, new Map<string, Exclusion[]>())
        .values(),
    ]

    return (
      await Promise.all(
        exclusionFamilies.map(async (family) => {
          const exclusion =
            family.find(
              (item) =>
                item.mediaServerId === (item.parent ?? item.mediaServerId),
            ) ?? family[0]
          const matchingGroup = exclusion.ruleGroupId
            ? groupsById.get(exclusion.ruleGroupId)
            : actionableGroups.find((group) => isTypeRelevant(exclusion, group))
          if (!matchingGroup || !isTypeRelevant(exclusion, matchingGroup)) {
            return undefined
          }

          const media = await mediaServer.getMetadata(exclusion.mediaServerId)
          if (!media) return undefined

          return {
            media,
            exclusionId: exclusion.id,
            scope: exclusion.ruleGroupId
              ? ('collection' as const)
              : ('global' as const),
            ...(exclusion.ruleGroupId
              ? {
                  collectionId: matchingGroup.collectionId,
                  collectionTitle: matchingGroup.collection?.title,
                }
              : {}),
            ...(exclusion.expiresAt
              ? { expiresAt: exclusion.expiresAt.toISOString() }
              : {}),
          }
        }),
      )
    ).filter((item): item is AppActionableExclusionItem => item !== undefined)
  }

  public async getManuallyAdded(
    libraryId?: string,
  ): Promise<AppManuallyAddedItem[]> {
    const query = this.collectionMediaRepository
      .createQueryBuilder('media')
      .innerJoin('media.collection', 'collection')
      .select('media.mediaServerId', 'mediaServerId')
      .where('media.isManual = :isManual', { isManual: true })
      .groupBy('media.mediaServerId')

    if (libraryId) {
      query.andWhere('collection.libraryId = :libraryId', { libraryId })
    }

    const rows = await query.getRawMany<{ mediaServerId: string }>()
    const mediaServer = await this.mediaServerFactory.getService()

    return (
      await Promise.all(
        rows.map(async ({ mediaServerId }) => {
          const media = await mediaServer.getMetadata(mediaServerId)
          if (!media) return undefined

          const parentId =
            media.type === 'episode'
              ? media.grandparentId
              : media.type === 'season'
                ? media.parentId
                : undefined
          const parentItem = parentId
            ? await mediaServer.getMetadata(parentId)
            : undefined

          return {
            media: parentItem
              ? ({ ...media, parentItem } as MediaItemWithParent)
              : media,
          }
        }),
      )
    ).filter((item): item is AppManuallyAddedItem => item !== undefined)
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
