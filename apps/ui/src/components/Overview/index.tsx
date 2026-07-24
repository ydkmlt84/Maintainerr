import {
  CalendarIcon,
  ChartBarIcon,
  CollectionIcon,
  ExternalLinkIcon,
  LightningBoltIcon,
  ServerIcon,
  TrashIcon,
} from '@heroicons/react/outline'
import {
  type LogEvent,
  type MediaItem,
  type MediaItemType,
  type MediaItemWithParent,
} from '@maintainerr/contracts'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReconnectingEventSource from 'reconnecting-eventsource'
import GetApiHandler, {
  API_BASE_PATH,
  DeleteApiHandler,
  PostApiHandler,
} from '../../utils/ApiHandler'
import LoadingSpinner from '../Common/LoadingSpinner'
import Modal from '../Common/Modal'
import type { ICollectionMedia } from '../Collection'

interface AppStats {
  rules?: number
  storage?: AppStorageStats
  choppingBlock?: AppChoppingBlockStats
  libraries?: AppLibraryStats[]
  recentlyAdded?: AppRecentlyAddedItem[]
  popularMovies?: AppPopularMediaItem[]
  popularTv?: AppPopularMediaItem[]
  oldestItems?: AppLibraryRankingItem[]
  biggestItems?: AppLibraryRankingItem[]
  collections?: AppCollectionPreview[]
  leavingSoon?: AppLeavingSoonItem[]
  plexTrash?: AppPlexTrashItem[]
  tasks?: AppTaskStats[]
  configuredServices?: AppConfiguredService[]
  recentActivity?: AppRecentActivityItem[]
}

type AppRecentlyAddedItem = MediaItem & {
  tautulliPosterPath?: string
}

interface RankedMediaItem {
  title: string
  ratingKey: string
  posterPath?: string
  backdropPath?: string
}

interface AppPopularMediaItem extends RankedMediaItem {
  year?: number
  usersWatched: number
  totalPlays: number
}

interface AppLibraryRankingItem extends RankedMediaItem {
  addedAt: string
  sizeBytes: number
}

type CalendarCollectionMedia = {
  id: number
  mediaServerId: string
  addDate: Date | string
}

type CalendarCollection = {
  id: number
  title: string
  type: MediaItemType
  arrAction: number
  deleteAfterDays: number
  radarrSettingsId?: number
  sonarrSettingsId?: number
  media: CalendarCollectionMedia[]
}

type WeekDaySummary = {
  date: Date
  items: CalendarItem[]
}

type CalendarItem = {
  id: string
  title: string
  count: number
  references: CalendarReference[]
}

type CalendarReference = {
  collectionId: number
  mediaId: number
  mediaServerId: string
  addDate: Date | string
}

type CalendarModalItem = {
  mediaTitle: string
  addedAt: string
  collectionId: number
  collectionTitle: string
  mediaType: MediaItemType
}

type SelectedCalendarEntry = {
  item: CalendarItem
  date: Date
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
  type: 'movie' | 'show' | 'season' | 'episode'
  libraryId: string
  mediaCount: number
  totalSizeBytes?: number | null
  deleteAfterDays?: number | null
  isActive: boolean
  media: { image_path?: string }[]
}

interface AppLeavingSoonItem {
  media: MediaItem | MediaItemWithParent
  collectionId: number
  collectionTitle: string
  deleteDate: string
  daysLeft: number
}

interface AppPlexTrashItem {
  plexId: string
  title: string
  year?: number
  library: string
  type: 'movie' | 'show' | 'season' | 'episode' | 'collection'
  posterPath?: string
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
  type: number
}

const formatBytes = (value?: number): string => {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '--'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}

const formatNumber = (value?: number): string =>
  value == null ? '--' : value.toLocaleString()

const getTautulliImageUrl = (path?: string): string | undefined =>
  path
    ? `${API_BASE_PATH}/api/tautulli/image?path=${encodeURIComponent(path)}`
    : undefined

const formatRelativeTime = (
  value?: string,
  fallback = 'Not scheduled',
): string => {
  if (!value) {
    return fallback
  }

  const diffMs = new Date(value).getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  for (const [unit, size] of units) {
    if (absMs >= size || unit === 'minute') {
      return formatter.format(Math.round(diffMs / size), unit)
    }
  }

  return formatter.format(0, 'minute')
}

const formatLocalTime = (value?: string): string => {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const isFutureDate = (value?: string): boolean =>
  value ? new Date(value).getTime() > Date.now() : false

const getPercent = (part?: number, total?: number): number => {
  if (!part || !total) {
    return 0
  }

  return Math.min(Math.max((part / total) * 100, 0), 100)
}

const getActivityColor = (item: AppRecentActivityItem) => {
  const message = item.message.toLowerCase()

  if (message.includes('successfully handled')) {
    return 'border-l-red-500'
  }

  if (message.includes('added')) {
    return 'border-l-green-500'
  }

  if (message.includes('removed')) {
    return 'border-l-maintainerr'
  }

  return 'border-l-zinc-500'
}

const getActivityDetail = (message: string) =>
  message
    .replace(/^Successfully handled\s+/i, '')
    .replace(/^Added a specific exclusion for\s+/i, 'Specific exclusion: ')
    .replace(/^Removed specific exclusion of\s+/i, 'Specific exclusion: ')
    .replace(/^Added\s+/i, '')
    .replace(/^Removed\s+/i, '')
    .replace(
      /S(?:eason)?\s*(\d+)\s*E(?:pisode)?\s*(\d+)/gi,
      (_match, season, episode) =>
        `S${String(season).padStart(2, '0')}E${String(episode).padStart(
          2,
          '0',
        )}`,
    )
    .replace(
      /Season\s+(\d+)\s*[-: ]+\s*Episode\s+(\d+)/gi,
      (_match, season, episode) =>
        `S${String(season).padStart(2, '0')}E${String(episode).padStart(
          2,
          '0',
        )}`,
    )
    .replace(
      /Season\s+(\d+)/gi,
      (_match, season) => `S${String(season).padStart(2, '0')}`,
    )

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const startOfWeekSunday = (date: Date) => {
  const start = startOfDay(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

enum CalendarServarrAction {
  DELETE = 0,
  UNMONITOR_DELETE_ALL = 1,
  UNMONITOR_DELETE_EXISTING = 2,
  UNMONITOR = 3,
  DO_NOTHING = 4,
  DELETE_SHOW_IF_EMPTY = 5,
  UNMONITOR_SHOW_IF_EMPTY = 6,
  CHANGE_QUALITY_PROFILE = 7,
}

const DEFAULT_ACTION_LABEL = 'Scheduled Action'

const MOVIE_ACTION_LABELS: Partial<Record<CalendarServarrAction, string>> = {
  [CalendarServarrAction.DELETE]: 'Delete',
  [CalendarServarrAction.UNMONITOR_DELETE_ALL]: 'Unmonitor/Delete',
  [CalendarServarrAction.UNMONITOR]: 'Unmonitor/Keep',
  [CalendarServarrAction.CHANGE_QUALITY_PROFILE]: 'Change Quality',
  [CalendarServarrAction.DO_NOTHING]: 'Do nothing',
}

const SHOW_ACTION_LABELS: Partial<Record<CalendarServarrAction, string>> = {
  [CalendarServarrAction.DELETE]: 'Delete',
  [CalendarServarrAction.UNMONITOR_DELETE_ALL]: 'Unmonitor/Delete',
  [CalendarServarrAction.UNMONITOR_DELETE_EXISTING]:
    'Unmonitor/Delete Existing',
  [CalendarServarrAction.UNMONITOR]: 'Unmonitor/Keep',
  [CalendarServarrAction.CHANGE_QUALITY_PROFILE]: 'Change Quality',
  [CalendarServarrAction.DO_NOTHING]: 'Do nothing',
}

const SEASON_ACTION_LABELS: Partial<Record<CalendarServarrAction, string>> = {
  [CalendarServarrAction.DELETE]: 'Unmonitor/Delete',
  [CalendarServarrAction.DELETE_SHOW_IF_EMPTY]:
    'Unmonitor/Delete + Delete Empty Show',
  [CalendarServarrAction.UNMONITOR_DELETE_EXISTING]:
    'Unmonitor/Delete Existing',
  [CalendarServarrAction.UNMONITOR]: 'Unmonitor/Keep',
  [CalendarServarrAction.UNMONITOR_SHOW_IF_EMPTY]:
    'Unmonitor/Keep + Unmonitor Empty Show',
  [CalendarServarrAction.DO_NOTHING]: 'Do nothing',
}

const EPISODE_ACTION_LABELS: Partial<Record<CalendarServarrAction, string>> = {
  [CalendarServarrAction.DELETE]: 'Unmonitor/Delete',
  [CalendarServarrAction.UNMONITOR]: 'Unmonitor/Keep',
  [CalendarServarrAction.DO_NOTHING]: 'Do nothing',
}

const GENERIC_ACTION_LABELS: Partial<Record<CalendarServarrAction, string>> = {
  [CalendarServarrAction.DELETE]: 'Delete',
  [CalendarServarrAction.UNMONITOR_DELETE_ALL]: 'Unmonitor/Delete',
  [CalendarServarrAction.UNMONITOR_DELETE_EXISTING]:
    'Unmonitor/Delete Existing',
  [CalendarServarrAction.UNMONITOR]: 'Unmonitor/Keep',
  [CalendarServarrAction.DELETE_SHOW_IF_EMPTY]: 'Delete Empty Show',
  [CalendarServarrAction.UNMONITOR_SHOW_IF_EMPTY]: 'Unmonitor Empty Show',
  [CalendarServarrAction.CHANGE_QUALITY_PROFILE]: 'Change Quality',
}

const formatCalendarItemTitle = (actionLabel: string, count: number) =>
  `${actionLabel}: ${count} items`

const getActionLabelFromMap = (
  action: CalendarServarrAction,
  labels: Partial<Record<CalendarServarrAction, string>>,
) => labels[action] ?? DEFAULT_ACTION_LABEL

const getActionLabel = (collection: CalendarCollection) => {
  const action = collection.arrAction as CalendarServarrAction
  const hasRadarr = collection.radarrSettingsId != null

  if (hasRadarr || collection.type === 'movie') {
    return getActionLabelFromMap(action, MOVIE_ACTION_LABELS)
  }

  if (collection.type === 'show') {
    return getActionLabelFromMap(action, SHOW_ACTION_LABELS)
  }

  if (collection.type === 'season') {
    return getActionLabelFromMap(action, SEASON_ACTION_LABELS)
  }

  if (collection.type === 'episode') {
    return getActionLabelFromMap(action, EPISODE_ACTION_LABELS)
  }

  return getActionLabelFromMap(action, GENERIC_ACTION_LABELS)
}

const buildCalendarItemsByDayKey = (
  collections: CalendarCollection[] | undefined,
) => {
  const itemsByKey = new Map<string, CalendarItem[]>()

  collections?.forEach((collection) => {
    if (
      collection.arrAction === CalendarServarrAction.DO_NOTHING ||
      collection.deleteAfterDays == null
    ) {
      return
    }

    collection.media.forEach((media) => {
      if (!media.addDate) {
        return
      }

      const deleteDate = startOfDay(new Date(media.addDate))
      deleteDate.setDate(deleteDate.getDate() + collection.deleteAfterDays)

      const key = getDayKey(deleteDate)
      const actionLabel = getActionLabel(collection)
      const items = itemsByKey.get(key) ?? []
      const existingItem = items.find((item) => item.id === actionLabel)
      const reference = {
        collectionId: collection.id,
        mediaId: media.id,
        mediaServerId: media.mediaServerId,
        addDate: media.addDate,
      }

      if (existingItem) {
        existingItem.count += 1
        existingItem.title = formatCalendarItemTitle(
          actionLabel,
          existingItem.count,
        )
        existingItem.references.push(reference)
      } else {
        items.push({
          id: actionLabel,
          title: formatCalendarItemTitle(actionLabel, 1),
          count: 1,
          references: [reference],
        })
      }

      itemsByKey.set(key, items)
    })
  })

  return itemsByKey
}

const getWeekDays = (
  itemsByKey: Map<string, CalendarItem[]>,
  weekStart: Date,
): WeekDaySummary[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    return {
      date,
      items: itemsByKey.get(getDayKey(date)) ?? [],
    }
  })

const getCalendarMediaTitle = (media: ICollectionMedia) => {
  const mediaData = media.mediaData

  if (!mediaData) {
    return media.mediaServerId
  }

  if (mediaData.type === 'episode') {
    const showTitle = mediaData.grandparentTitle || mediaData.parentTitle || ''
    const seasonEpisode =
      mediaData.parentIndex != null && mediaData.index != null
        ? `S${String(mediaData.parentIndex).padStart(2, '0')}E${String(
            mediaData.index,
          ).padStart(2, '0')}`
        : mediaData.index != null
          ? `E${String(mediaData.index).padStart(2, '0')}`
          : ''

    return [showTitle, seasonEpisode].filter(Boolean).join(' - ')
  }

  return (
    mediaData.grandparentTitle ||
    mediaData.parentTitle ||
    mediaData.title ||
    media.mediaServerId
  )
}

const formatAddedAt = (value: Date | string) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatScheduledDate = (value: Date) =>
  value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

const getMediaTypeLabel = (mediaType: MediaItemType) => {
  switch (mediaType) {
    case 'movie':
      return 'Movie'
    case 'show':
      return 'Show'
    case 'season':
      return 'Season'
    case 'episode':
      return 'Episode'
    default:
      return 'Media'
  }
}

const getReferencesByCollection = (references: CalendarReference[]) =>
  references.reduce((map, reference) => {
    const refs = map.get(reference.collectionId) ?? []
    refs.push(reference)
    map.set(reference.collectionId, refs)
    return map
  }, new Map<number, CalendarReference[]>())

const getReferenceDateLookups = (references: CalendarReference[]) => ({
  addDateByMediaId: new Map(
    references.map((ref) => [ref.mediaId, ref.addDate]),
  ),
  addDateByMediaServerId: new Map(
    references.map((ref) => [ref.mediaServerId, ref.addDate]),
  ),
})

const fetchCalendarModalItems = async (
  selectedEntry: SelectedCalendarEntry,
  collectionsById: Map<number, CalendarCollection>,
) => {
  const referencesByCollection = getReferencesByCollection(
    selectedEntry.item.references,
  )

  const collectionResults = await Promise.all(
    [...referencesByCollection.entries()].map(async ([collectionId, refs]) => {
      const collection = collectionsById.get(collectionId)
      const mediaResponse = await GetApiHandler<{
        totalSize: number
        items: ICollectionMedia[]
      }>(
        `/collections/media/${collectionId}/content/1?size=${collection?.media.length ?? 25}`,
      )

      const mediaIds = new Set(refs.map((ref) => ref.mediaId))
      const mediaServerIds = new Set(refs.map((ref) => ref.mediaServerId))
      const { addDateByMediaId, addDateByMediaServerId } =
        getReferenceDateLookups(refs)

      return mediaResponse.items
        .filter(
          (media) =>
            mediaIds.has(media.id) || mediaServerIds.has(media.mediaServerId),
        )
        .map((media) => ({
          mediaTitle: getCalendarMediaTitle(media),
          addedAt: formatAddedAt(
            addDateByMediaId.get(media.id) ??
              addDateByMediaServerId.get(media.mediaServerId) ??
              media.addDate,
          ),
          collectionId,
          collectionTitle:
            collection?.title ??
            media.collection?.title ??
            `Collection ${collectionId}`,
          mediaType: media.mediaData?.type ?? collection?.type ?? 'movie',
        }))
    }),
  )

  return collectionResults
    .flat()
    .sort((left, right) => left.mediaTitle.localeCompare(right.mediaTitle))
}

const getMediaTitle = (item: MediaItem): string =>
  item.grandparentTitle || item.parentTitle || item.title

const getMediaYear = (item: MediaItem): string | undefined => {
  const parentItem = (item as MediaItemWithParent).parentItem
  return (parentItem?.year ?? item.year)?.toString()
}

const getMediaContext = (item: MediaItem): string | undefined => {
  if (item.type === 'episode') {
    const seasonNumber =
      item.parentIndex != null ? String(item.parentIndex).padStart(2, '0') : ''
    const episodeNumber =
      item.index != null ? String(item.index).padStart(2, '0') : ''

    if (seasonNumber && episodeNumber) {
      return `S${seasonNumber}E${episodeNumber}`
    }

    if (episodeNumber) {
      return `Episode ${item.index}`
    }
  }

  if (item.type === 'season' && item.index != null) {
    return `Season ${item.index}`
  }

  return getMediaYear(item)
}

const getTmdbId = (item: MediaItem): string | undefined => {
  const parentItem = (item as MediaItemWithParent).parentItem

  if (
    (item.type === 'season' || item.type === 'episode') &&
    parentItem?.providerIds?.tmdb?.[0]
  ) {
    return parentItem.providerIds.tmdb[0]
  }

  return item.providerIds?.tmdb?.[0] ?? parentItem?.providerIds?.tmdb?.[0]
}

const getPosterType = (item: MediaItem): 'movie' | 'show' =>
  item.type === 'movie' ? 'movie' : 'show'

const Overview = () => {
  const [stats, setStats] = useState<AppStats>()
  const [calendarCollections, setCalendarCollections] =
    useState<CalendarCollection[]>()
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekSunday(new Date()),
  )
  const [loading, setLoading] = useState(true)
  const [selectedLeavingSoon, setSelectedLeavingSoon] =
    useState<AppLeavingSoonItem>()
  const [selectedCalendarEntry, setSelectedCalendarEntry] =
    useState<SelectedCalendarEntry>()
  const [calendarModalItems, setCalendarModalItems] =
    useState<CalendarModalItem[]>()
  const [calendarModalLoading, setCalendarModalLoading] = useState(false)
  const [excluding, setExcluding] = useState(false)

  useEffect(() => {
    let active = true

    GetApiHandler<AppStats>('/stats')
      .then((response) => {
        if (active) {
          setStats(response)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    GetApiHandler<CalendarCollection[]>('/collections/calendar-data').then(
      (response) => {
        if (active) {
          setCalendarCollections(response)
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  const storageUsedPercent = getPercent(
    stats?.storage?.usedSpace,
    stats?.storage?.totalSpace,
  )
  const choppingBlockPercent = getPercent(
    stats?.choppingBlock?.totalSizeBytes,
    stats?.storage?.totalSpace,
  )
  const calendarItemsByKey = useMemo(
    () => buildCalendarItemsByDayKey(calendarCollections),
    [calendarCollections],
  )
  const calendarCollectionsById = useMemo(
    () =>
      new Map(
        (calendarCollections ?? []).map((collection) => [
          collection.id,
          collection,
        ]),
      ),
    [calendarCollections],
  )
  const weekDays = useMemo(
    () => getWeekDays(calendarItemsByKey, weekStart),
    [calendarItemsByKey, weekStart],
  )

  useEffect(() => {
    if (!selectedCalendarEntry) {
      setCalendarModalItems(undefined)
      return
    }

    let active = true
    setCalendarModalLoading(true)

    fetchCalendarModalItems(selectedCalendarEntry, calendarCollectionsById)
      .then((items) => {
        if (active) {
          setCalendarModalItems(items)
        }
      })
      .finally(() => {
        if (active) {
          setCalendarModalLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [calendarCollectionsById, selectedCalendarEntry])
  const excludeSelectedLeavingSoon = async () => {
    if (!selectedLeavingSoon) {
      return
    }

    setExcluding(true)

    try {
      await DeleteApiHandler(
        `/collections/media?mediaId=${selectedLeavingSoon.media.id}&collectionId=${selectedLeavingSoon.collectionId}`,
      )
      await PostApiHandler('/rules/exclusion', {
        collectionId: selectedLeavingSoon.collectionId,
        mediaId: selectedLeavingSoon.media.id,
        action: 0,
      })
      setStats((current) =>
        current
          ? {
              ...current,
              leavingSoon: current.leavingSoon?.filter(
                (item) =>
                  !(
                    item.collectionId === selectedLeavingSoon.collectionId &&
                    item.media.id === selectedLeavingSoon.media.id
                  ),
              ),
            }
          : current,
      )
      setSelectedLeavingSoon(undefined)
    } finally {
      setExcluding(false)
    }
  }

  if (loading) {
    return (
      <>
        <title>Overview - Maintainerr</title>
        <LoadingSpinner />
      </>
    )
  }

  return (
    <>
      <title>Overview - Maintainerr</title>
      <div className="mx-auto w-full min-w-0 max-w-[96rem] space-y-4 pb-10 pt-4 sm:space-y-5">
        <section className="grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-2">
          <StoragePressureCard
            storage={stats?.storage}
            usedPercent={storageUsedPercent}
          />
          <LogsCard />
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<CollectionIcon className="h-5 w-5" />}
            label="Chopping Block"
            value={formatBytes(stats?.choppingBlock?.totalSizeBytes)}
            detail={`${choppingBlockPercent.toFixed(2)}% of total storage`}
            details={stats?.choppingBlock?.collections.map((item) => ({
              href: `/collections/${item.id}`,
              label: item.title,
              size: formatBytes(item.totalSizeBytes),
              count: formatNumber(item.mediaCount),
            }))}
          />
          <MediaMetricCard libraries={stats?.libraries ?? []} />
          <NextRunCard tasks={stats?.tasks ?? []} />
          <ConfiguredCard services={stats?.configuredServices ?? []} />
        </section>

        <PosterRow
          title="Leaving Soon"
          emptyText="No scheduled removals found."
        >
          {(stats?.leavingSoon ?? []).map((item) => (
            <DashboardPoster
              key={`${item.collectionId}-${item.media.id}`}
              title={getMediaTitle(item.media)}
              subtitle={getMediaContext(item.media)}
              mediaType={item.media.type}
              posterType={getPosterType(item.media)}
              tmdbId={getTmdbId(item.media)}
              tone="danger"
              daysLeft={item.daysLeft}
              onSelect={() => setSelectedLeavingSoon(item)}
            />
          ))}
        </PosterRow>

        {stats?.plexTrash?.length ? (
          <PosterRow title="Plex Trash" emptyText="">
            {stats.plexTrash.map((item) => (
              <DashboardPoster
                key={`${item.library}-${item.plexId}`}
                title={item.title}
                subtitle={`${item.library}${item.year ? ` - ${item.year}` : ''}`}
                mediaType={item.type}
                posterType={item.type === 'movie' ? 'movie' : 'show'}
                posterUrl={getTautulliImageUrl(item.posterPath)}
                trashOverlay
              />
            ))}
          </PosterRow>
        ) : undefined}

        <RecentActivityRow activity={stats?.recentActivity ?? []} />

        <WeekRow
          days={weekDays}
          weekStart={weekStart}
          onPrevious={() => setWeekStart((current) => addDays(current, -7))}
          onCurrent={() => setWeekStart(startOfWeekSunday(new Date()))}
          onNext={() => setWeekStart((current) => addDays(current, 7))}
          onOpenEntry={(item, date) => setSelectedCalendarEntry({ item, date })}
        />

        <CollectionRow collections={stats?.collections ?? []} />

        <PosterRow
          title="Recently Added"
          emptyText="No recently added media found."
        >
          {(stats?.recentlyAdded ?? []).map((item) => (
            <DashboardPoster
              key={`${item.library.id}-${item.id}`}
              title={getMediaTitle(item)}
              subtitle={getMediaContext(item)}
              mediaType={item.type}
              posterType={getPosterType(item)}
              tmdbId={getTmdbId(item)}
              posterUrl={getTautulliImageUrl(item.tautulliPosterPath)}
            />
          ))}
        </PosterRow>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PopularMediaPanel
            title="Most Popular Movies"
            items={stats?.popularMovies ?? []}
          />
          <PopularMediaPanel
            title="Most Popular TV Shows"
            items={stats?.popularTv ?? []}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RankedMediaPanel
            title="Oldest Media"
            metricLabel="Added"
            items={stats?.oldestItems ?? []}
            formatMetric={(item) =>
              new Date(item.addedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: '2-digit',
              })
            }
          />
          <RankedMediaPanel
            title="Biggest Media"
            metricLabel="Size"
            items={stats?.biggestItems ?? []}
            formatMetric={(item) => formatBytes(item.sizeBytes)}
          />
        </div>
      </div>
      {selectedLeavingSoon ? (
        <LeavingSoonModal
          item={selectedLeavingSoon}
          excluding={excluding}
          onClose={() => setSelectedLeavingSoon(undefined)}
          onExclude={excludeSelectedLeavingSoon}
        />
      ) : undefined}
      {selectedCalendarEntry ? (
        <CalendarItemsModal
          entry={selectedCalendarEntry}
          items={calendarModalItems ?? []}
          loading={calendarModalLoading}
          onClose={() => setSelectedCalendarEntry(undefined)}
        />
      ) : undefined}
    </>
  )
}

const MetricCard = ({
  icon,
  label,
  value,
  detail,
  details,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
  details?: { href?: string; label: string; size: string; count: string }[]
}) => (
  <div className="h-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-2.5 shadow-lg shadow-black/20">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-lg bg-zinc-900 p-1.5 text-maintainerr-400">
        {icon}
      </span>
      <span className="text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
    </div>
    <p className="mt-2 text-lg font-bold text-zinc-50">{value}</p>
    <p className="mt-0.5 text-xs text-zinc-400">{detail}</p>
    {details?.length ? (
      <div className="tiny-scrollbar mt-3 grid max-h-40 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 xs:grid-cols-2">
        {details.map((item) => {
          const content = (
            <>
              <p className="truncate font-semibold text-zinc-200">
                {item.label}
              </p>
              <p className="mt-1 text-base font-bold text-maintainerr-400">
                {item.size}
              </p>
              <p className="text-xs text-zinc-500">{item.count} items</p>
            </>
          )

          return item.href ? (
            <Link
              key={item.label}
              to={item.href}
              className="block rounded-lg bg-zinc-900 px-3 py-2 text-sm transition hover:bg-zinc-700"
            >
              {content}
            </Link>
          ) : (
            <div
              key={item.label}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm"
            >
              {content}
            </div>
          )
        })}
      </div>
    ) : undefined}
  </div>
)

const MediaMetricCard = ({ libraries }: { libraries: AppLibraryStats[] }) => {
  const seasonTotal = libraries.reduce(
    (count, library) => count + (library.seasonCount ?? 0),
    0,
  )
  const episodeTotal = libraries.reduce(
    (count, library) => count + (library.episodeCount ?? 0),
    0,
  )

  return (
    <div className="h-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-2.5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-lg bg-zinc-900 p-1.5 text-maintainerr-400">
          <ChartBarIcon className="h-5 w-5" />
        </span>
        <span className="text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
          Media
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 xs:grid-cols-2 lg:gap-2">
        {libraries.map((library) => (
          <div
            key={library.id}
            className="rounded-md bg-zinc-900 px-2 py-1 lg:px-3 lg:py-2"
          >
            <p className="truncate text-[11px] font-medium text-zinc-400 lg:text-xs">
              {library.title}
            </p>
            <p className="text-xs font-semibold text-zinc-100 lg:text-sm">
              {formatNumber(library.itemCount)}
            </p>
          </div>
        ))}
        <div className="rounded-md bg-zinc-900 px-2 py-1 lg:px-3 lg:py-2">
          <p className="truncate text-[11px] font-medium text-zinc-400 lg:text-xs">
            Seasons
          </p>
          <p className="text-xs font-semibold text-zinc-100 lg:text-sm">
            {formatNumber(seasonTotal)}
          </p>
        </div>
        <div className="rounded-md bg-zinc-900 px-2 py-1 lg:px-3 lg:py-2">
          <p className="truncate text-[11px] font-medium text-zinc-400 lg:text-xs">
            Episodes
          </p>
          <p className="text-xs font-semibold text-zinc-100 lg:text-sm">
            {formatNumber(episodeTotal)}
          </p>
        </div>
      </div>
    </div>
  )
}

const NextRunCard = ({ tasks }: { tasks: AppTaskStats[] }) => (
  <div className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-lg shadow-black/20">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-lg bg-zinc-900 p-1.5 text-maintainerr-400">
        <LightningBoltIcon className="h-5 w-5" />
      </span>
      <span className="text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
        Next Run
      </span>
    </div>
    <div className="mt-3 space-y-2">
      {tasks.map((task) => (
        <div key={task.name} className="rounded-md bg-zinc-900 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {task.name}
            </p>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-maintainerr-400">
                {isFutureDate(task.nextRun)
                  ? formatRelativeTime(task.nextRun)
                  : 'Not scheduled'}
              </p>
              {isFutureDate(task.nextRun) ? (
                <p className="mt-0.5 text-xs text-zinc-500">
                  {formatLocalTime(task.nextRun)}
                </p>
              ) : undefined}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

const LogsCard = () => {
  const [logLines, setLogLines] = useState<LogEvent[]>([])

  useEffect(() => {
    const es = new ReconnectingEventSource(`${API_BASE_PATH}/api/logs/stream`)

    const handleLog = (event: MessageEvent) => {
      const message: LogEvent = JSON.parse(event.data)
      setLogLines((current) => [...current, message].slice(-10))
    }

    es.addEventListener('log', handleLog)

    return () => {
      es.removeEventListener('log', handleLog)
      es.close()
    }
  }, [])

  return (
    <div className="h-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-2.5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-100">Logs</h2>
        <Link
          to="/settings/logs"
          className="rounded-md bg-zinc-900 p-1 text-zinc-400 transition hover:text-zinc-100"
          aria-label="Open logs"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>
      <div className="tiny-scrollbar mt-2 h-40 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {logLines.length > 0 ? (
          logLines.map((row, index) => {
            const levelColor =
              row.level === 'ERROR'
                ? 'text-red-400'
                : row.level === 'WARN'
                  ? 'text-yellow-400'
                  : row.level === 'INFO'
                    ? 'text-green-400'
                    : 'text-indigo-400'

            return (
              <div
                key={`${row.date}-${index}`}
                className="flex min-w-0 gap-2 overflow-hidden rounded-md bg-zinc-900 px-2 py-1 font-mono text-[11px] leading-4"
              >
                <span className="shrink-0 text-zinc-500">
                  {new Date(row.date).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 font-semibold ${levelColor}`}>
                  {row.level}
                </span>
                <p className="min-w-0 truncate text-zinc-200">{row.message}</p>
              </div>
            )
          })
        ) : (
          <p className="rounded-md bg-zinc-900 px-2 py-2 text-xs text-zinc-500">
            Waiting for log entries.
          </p>
        )}
      </div>
    </div>
  )
}

const StoragePressureCard = ({
  storage,
  usedPercent,
}: {
  storage?: AppStorageStats
  usedPercent: number
}) => (
  <div className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-zinc-100">Storage</h2>
      </div>
      <ServerIcon className="h-6 w-6 text-zinc-500" />
    </div>
    <div className="mt-5 flex items-end justify-between gap-3">
      <div>
        <p className="text-2xl font-bold text-zinc-50">
          {usedPercent.toFixed(1)}%
        </p>
        <p className="text-sm text-zinc-400">used</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-zinc-50">
          {(100 - usedPercent).toFixed(1)}%
        </p>
        <p className="text-sm text-zinc-400">
          {formatBytes(storage?.freeSpace)} remaining
        </p>
      </div>
    </div>
    <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-700">
      <div
        className="h-full rounded-full bg-maintainerr transition-[width] duration-500"
        style={{ width: `${usedPercent}%` }}
      />
    </div>
    <div className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
      <div className="rounded-lg bg-zinc-900 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Used</p>
        <p className="mt-1 font-semibold text-zinc-100">
          {formatBytes(storage?.usedSpace)}
        </p>
      </div>
      <div className="rounded-lg bg-zinc-900 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Total</p>
        <p className="mt-1 font-semibold text-zinc-100">
          {formatBytes(storage?.totalSpace)}
        </p>
      </div>
    </div>
  </div>
)
const ConfiguredCard = ({ services }: { services: AppConfiguredService[] }) => (
  <div className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <span className="rounded-lg bg-zinc-900 p-1.5 text-maintainerr-400">
        <ServerIcon className="h-5 w-5" />
      </span>
      <span className="text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
        Services
      </span>
    </div>
    <div className="mt-4 space-y-3">
      {services.map((service) => (
        <Link
          key={service.name}
          to={getServiceSettingsRoute(service.name)}
          className="flex items-center justify-between gap-4 rounded-lg bg-zinc-900 px-3 py-2"
        >
          <span className="text-sm font-medium text-zinc-200">
            {service.name}
          </span>
          <span
            className={`text-sm font-semibold ${
              service.status === 'Connected' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {service.status}
          </span>
        </Link>
      ))}
    </div>
  </div>
)

const getServiceSettingsRoute = (name: string): string => {
  switch (name.toLowerCase()) {
    case 'plex':
      return '/settings/plex'
    case 'jellyfin':
      return '/settings/jellyfin'
    case 'sonarr':
      return '/settings/sonarr'
    case 'radarr':
      return '/settings/radarr'
    case 'tautulli':
      return '/settings/tautulli'
    case 'seerr':
      return '/settings/seerr'
    default:
      return '/settings/main'
  }
}

const WeekRow = ({
  days,
  weekStart,
  onPrevious,
  onCurrent,
  onNext,
  onOpenEntry,
}: {
  days: WeekDaySummary[]
  weekStart: Date
  onPrevious: () => void
  onCurrent: () => void
  onNext: () => void
  onOpenEntry: (item: CalendarItem, date: Date) => void
}) => (
  <section className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/calendar"
          className="rounded-md bg-zinc-900 p-1 text-zinc-500 transition hover:text-zinc-100"
          aria-label="Open calendar"
        >
          <CalendarIcon className="h-5 w-5" />
        </Link>
        <h2 className="truncate text-lg font-bold text-zinc-100">
          {weekStart.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          {' - '}
          {addDays(weekStart, 6).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </h2>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          onClick={onPrevious}
          aria-label="Previous week"
        >
          {'<'}
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
          onClick={onCurrent}
        >
          This Week
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm font-bold text-zinc-200 transition hover:bg-zinc-800"
          onClick={onNext}
          aria-label="Next week"
        >
          {'>'}
        </button>
      </div>
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 md:grid md:grid-cols-7">
      {days.map((day) => (
        <div
          key={getDayKey(day.date)}
          className="min-h-[7rem] border-b border-zinc-700 p-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
        >
          {(() => {
            const scheduledCount = day.items.reduce(
              (total, item) => total + item.count,
              0,
            )

            return (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {day.date.toLocaleDateString(undefined, {
                      weekday: 'short',
                    })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">
                    {day.date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                {scheduledCount > 0 ? (
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-sm font-bold text-maintainerr-400">
                    {scheduledCount}
                  </span>
                ) : undefined}
              </div>
            )
          })()}
          <div className="mt-4 space-y-1">
            {day.items.length > 0 ? (
              day.items.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="block w-full truncate rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-xs text-zinc-100 transition hover:border-maintainerr/50 hover:bg-zinc-700"
                  title={item.title}
                  onClick={() => onOpenEntry(item, day.date)}
                >
                  {item.title}
                </button>
              ))
            ) : (
              <p className="text-xs text-zinc-600">No scheduled actions</p>
            )}
            {day.items.length > 2 ? (
              <p className="text-xs text-maintainerr-400">
                +{day.items.length - 2} more
              </p>
            ) : undefined}
          </div>
        </div>
      ))}
    </div>
  </section>
)

const RecentActivityRow = ({
  activity,
}: {
  activity: AppRecentActivityItem[]
}) => (
  <section className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-zinc-100">Recent Activity</h2>
      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Added
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-maintainerr" />
          Removed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Handled
        </span>
      </div>
    </div>
    <div className="tiny-scrollbar mt-4 max-h-[13.5rem] overflow-y-auto overscroll-contain pr-1">
      {activity.length > 0 ? (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {activity.map((item) => (
            <Link
              key={item.id}
              to={`/collections/${item.collectionId}`}
              className={`grid min-h-[6rem] grid-cols-[minmax(0,1fr)_3rem] gap-2 rounded-lg border-y border-l-4 border-r border-y-zinc-700 border-r-zinc-700 ${getActivityColor(item)} bg-zinc-900 px-2.5 py-2 transition hover:border-y-zinc-600 hover:border-r-zinc-600 hover:bg-zinc-800`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold leading-4 text-zinc-100">
                  {item.collectionTitle}
                </p>
                <span className="mt-1 block text-[10px] text-zinc-500">
                  {formatRelativeTime(item.timestamp)}
                </span>
                <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-zinc-400">
                  {getActivityDetail(item.message)}
                </p>
              </div>
              <RecentActivityThumbnail item={item} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState text="No recent collection activity found." />
      )}
    </div>
  </section>
)

const RecentActivityThumbnail = ({ item }: { item: AppRecentActivityItem }) => {
  const [posterPath, setPosterPath] = useState<string>()

  useEffect(() => {
    if (item.posterPath) {
      queueMicrotask(() => setPosterPath(item.posterPath))
      return
    }

    if (!item.posterTmdbId || !item.posterType) {
      queueMicrotask(() => setPosterPath(undefined))
      return
    }

    let active = true
    GetApiHandler<string>(
      `/moviedb/image/${item.posterType}/${item.posterTmdbId}`,
    ).then((path) => {
      if (active) {
        setPosterPath(path)
      }
    })

    return () => {
      active = false
    }
  }, [item.posterPath, item.posterTmdbId, item.posterType])

  return posterPath ? (
    <img
      src={`https://image.tmdb.org/t/p/w92${posterPath}`}
      alt=""
      className="h-[4.5rem] w-12 rounded-md object-cover"
      onError={() => setPosterPath(undefined)}
    />
  ) : (
    <span className="block h-[4.5rem] w-12" aria-hidden="true" />
  )
}

const useHorizontalWheelScroll = () => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scroller = scrollRef.current

    if (!scroller) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth

      if (maxScrollLeft <= 0) {
        return
      }

      const wheelDelta =
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX
      const nextScrollLeft = scroller.scrollLeft + wheelDelta

      event.preventDefault()
      event.stopPropagation()
      scroller.scrollLeft = Math.min(Math.max(nextScrollLeft, 0), maxScrollLeft)
    }

    scroller.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scroller.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return scrollRef
}

const PosterRow = ({
  title,
  emptyText,
  children,
}: {
  title: string
  emptyText: string
  children: ReactNode
}) => {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  const scrollRef = useHorizontalWheelScroll()

  return (
    <section className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
      <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="tiny-scrollbar mt-4 flex min-w-0 gap-3 overflow-x-auto overscroll-contain pb-2"
        >
          {Array.isArray(items) && items.length === 0 ? (
            <EmptyState text={emptyText} />
          ) : (
            items
          )}
        </div>
      </div>
    </section>
  )
}

const DashboardPoster = ({
  title,
  subtitle,
  mediaType,
  posterType,
  tmdbId,
  posterUrl,
  tone = 'default',
  daysLeft,
  trashOverlay = false,
  onSelect,
}: {
  title: string
  subtitle?: string
  mediaType: string
  posterType: 'movie' | 'show'
  tmdbId?: string
  posterUrl?: string
  tone?: 'default' | 'danger'
  daysLeft?: number
  trashOverlay?: boolean
  onSelect?: () => void
}) => {
  const posterRequestKey = `${posterType}:${tmdbId ?? ''}`
  const [resolvedPoster, setResolvedPoster] = useState<{
    key: string
    path: string
  }>()

  useEffect(() => {
    if (posterUrl || !tmdbId) {
      return
    }

    let active = true
    GetApiHandler<string>(`/moviedb/image/${posterType}/${tmdbId}`).then(
      (path) => {
        if (active && path) {
          setResolvedPoster({ key: posterRequestKey, path })
        }
      },
    )

    return () => {
      active = false
    }
  }, [posterRequestKey, posterType, posterUrl, tmdbId])

  const posterPath =
    resolvedPoster?.key === posterRequestKey ? resolvedPoster.path : undefined

  const poster = (
    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/25">
      {posterUrl || posterPath ? (
        <img
          src={
            posterUrl ??
            `https://image.tmdb.org/t/p/w300_and_h450_face${posterPath}`
          }
          alt=""
          className="h-full w-full object-cover transition duration-200 group-hover:blur-[1px]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {mediaType}
        </div>
      )}
      {trashOverlay ? (
        <>
          <div className="absolute inset-0 bg-zinc-950/45" />
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-black/50">
            <TrashIcon className="h-5 w-5 text-white" />
          </span>
        </>
      ) : undefined}
      <span
        className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
          tone === 'danger' ? 'bg-red-700/90' : 'bg-zinc-900/90'
        }`}
      >
        {mediaType}
      </span>
      {daysLeft !== undefined ? (
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-100 shadow ${
            daysLeft < 0
              ? 'bg-red-700'
              : mediaType === 'movie'
                ? 'bg-zinc-900/90 ring-1 ring-zinc-500/30'
                : mediaType === 'show'
                  ? 'bg-maintainerrdark/90 ring-1 ring-maintainerr-600/30'
                  : mediaType === 'season'
                    ? 'bg-maintainerr-800/90 ring-1 ring-maintainerr-500/30'
                    : 'bg-indigo-900/90 ring-1 ring-indigo-400/30'
          }`}
        >
          {daysLeft}
        </span>
      ) : undefined}
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-transparent px-3 pb-3 pt-10 transition duration-200 group-hover:translate-y-0">
        <p className="line-clamp-2 text-sm font-bold leading-4 text-white">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-300">
            {subtitle}
          </p>
        ) : undefined}
      </div>
    </div>
  )

  return (
    <div className="w-28 flex-shrink-0 xs:w-32">
      {onSelect ? (
        <button
          type="button"
          className="group block w-full text-left"
          onClick={onSelect}
          aria-label={`Open ${title}`}
        >
          {poster}
        </button>
      ) : (
        <div className="group">{poster}</div>
      )}
    </div>
  )
}

const PopularMediaPanel = ({
  title,
  items,
}: {
  title: string
  items: AppPopularMediaItem[]
}) => {
  return (
    <RankedMediaPanel
      title={title}
      metricLabel="Users"
      items={items}
      formatMetric={(item) => item.usersWatched.toString()}
    />
  )
}

function RankedMediaPanel<T extends RankedMediaItem>({
  title,
  metricLabel,
  items,
  formatMetric,
}: {
  title: string
  metricLabel: string
  items: T[]
  formatMetric: (item: T) => string
}) {
  const featured = items[0]
  const posterUrl = getTautulliImageUrl(featured?.posterPath)
  const backdropUrl = getTautulliImageUrl(featured?.backdropPath)

  return (
    <section className="relative min-h-52 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/20">
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      ) : undefined}
      <div className="absolute inset-0 bg-zinc-950/55" />

      <div className="relative flex h-full min-h-52 gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="w-20 flex-shrink-0 sm:w-24">
          <div className="aspect-[2/3] overflow-hidden rounded border border-zinc-600 bg-zinc-950 shadow-md">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-xs font-semibold uppercase text-zinc-600">
                No poster
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-zinc-600/60 pb-2">
            <h2 className="truncate text-sm font-bold uppercase text-zinc-100 sm:text-base">
              {title}
            </h2>
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase text-zinc-400 sm:text-xs">
              {metricLabel}
            </span>
          </div>

          {items.length ? (
            <ol className="divide-y divide-zinc-700/70">
              {items.map((item, index) => (
                <li
                  key={`${item.ratingKey}-${index}`}
                  className="grid h-7 grid-cols-[1.25rem_minmax(0,1fr)_4.5rem] items-center gap-1 text-sm"
                >
                  <span className="text-right text-xs text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="truncate text-zinc-200" title={item.title}>
                    {item.title}
                  </span>
                  <span className="text-right font-semibold text-amber-400">
                    {formatMetric(item)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex min-h-32 items-center justify-center text-sm text-zinc-500">
              No ranked media found.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

const LeavingSoonModal = ({
  item,
  excluding,
  onClose,
  onExclude,
}: {
  item: AppLeavingSoonItem
  excluding: boolean
  onClose: () => void
  onExclude: () => void
}) => (
  <Modal
    title={getMediaTitle(item.media)}
    size="sm"
    onCancel={onClose}
    onOk={onExclude}
    okText={excluding ? 'Excluding...' : 'Exclude from Collection'}
    okButtonType="danger"
    okDisabled={excluding}
    cancelText="Close"
    backgroundClickable={!excluding}
  >
    <div className="rounded-lg bg-zinc-800 p-3">
      {getMediaContext(item.media) ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Media
          </p>
          <p className="mt-1 text-base font-bold text-zinc-100">
            {getMediaContext(item.media)}
          </p>
        </>
      ) : undefined}
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Collection
      </p>
      <Link
        to={`/collections/${item.collectionId}`}
        className="mt-1 inline-block text-base font-bold text-maintainerr-400 transition hover:text-maintainerr-300"
        onClick={onClose}
      >
        {item.collectionTitle}
      </Link>
      <p className="mt-2 text-sm text-zinc-400">
        {item.daysLeft <= 0
          ? 'Scheduled for removal now.'
          : `${item.daysLeft} days left before removal.`}
      </p>
    </div>
  </Modal>
)

const CalendarItemsModal = ({
  entry,
  items,
  loading,
  onClose,
}: {
  entry: SelectedCalendarEntry
  items: CalendarModalItem[]
  loading: boolean
  onClose: () => void
}) => (
  <Modal
    title={entry.item.title}
    onCancel={onClose}
    cancelText="Close"
    size="4xl"
  >
    {loading ? (
      <div className="py-6 text-center text-sm text-zinc-300">
        Loading scheduled items...
      </div>
    ) : items.length > 0 ? (
      <div className="-mt-1 space-y-2">
        <div className="text-center text-sm font-medium text-zinc-300">
          {formatScheduledDate(entry.date)}
        </div>
        <div className="space-y-2 sm:hidden">
          {items.map((item, index) => (
            <div
              key={`${item.collectionId}-${item.mediaTitle}-${index}`}
              className="rounded-md border border-zinc-600/60 bg-zinc-800/40 px-3 py-3"
            >
              <div className="truncate text-sm font-medium text-zinc-100">
                {item.mediaTitle}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <div className="text-zinc-400">Added On</div>
                  <div className="text-zinc-300">{item.addedAt}</div>
                </div>
                <div>
                  <div className="text-zinc-400">Type</div>
                  <div className="text-zinc-300">
                    {getMediaTypeLabel(item.mediaType)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-zinc-400">Collection</div>
                  <Link
                    className="text-maintainerr-300 hover:text-maintainerr-200 hover:underline"
                    to={`/collections/${item.collectionId}`}
                    onClick={onClose}
                  >
                    {item.collectionTitle}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="border-b border-zinc-600 px-3 pb-2 text-left">
                  Media
                </th>
                <th className="border-b border-zinc-600 px-3 pb-2 text-center">
                  Added On
                </th>
                <th className="border-b border-zinc-600 px-3 pb-2 text-center">
                  Collection
                </th>
                <th className="border-b border-zinc-600 px-3 pb-2 text-center">
                  Type
                </th>
              </tr>
            </thead>
          </table>
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full table-fixed border-separate border-spacing-y-2">
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
              </colgroup>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={`${item.collectionId}-${item.mediaTitle}-${index}`}
                    className="rounded-md border border-zinc-600/60 bg-zinc-800/40"
                  >
                    <td
                      className="rounded-l-md border-y border-l border-zinc-600/60 bg-zinc-800/40 px-3 py-2 text-zinc-100"
                      title={item.mediaTitle}
                    >
                      <div className="truncate">{item.mediaTitle}</div>
                    </td>
                    <td
                      className="border-y border-zinc-600/60 bg-zinc-800/40 px-3 py-2 text-center text-zinc-300"
                      title={item.addedAt}
                    >
                      {item.addedAt}
                    </td>
                    <td className="border-y border-zinc-600/60 bg-zinc-800/40 px-3 py-2 text-center">
                      <Link
                        className="text-maintainerr-300 hover:text-maintainerr-200 hover:underline"
                        to={`/collections/${item.collectionId}`}
                        onClick={onClose}
                      >
                        {item.collectionTitle}
                      </Link>
                    </td>
                    <td className="rounded-r-md border-y border-r border-zinc-600/60 bg-zinc-800/40 px-3 py-2 text-center text-zinc-300">
                      {getMediaTypeLabel(item.mediaType)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : (
      <div className="py-6 text-center text-sm text-zinc-400">
        No media items found for this scheduled action.
      </div>
    )}
  </Modal>
)

const CollectionRow = ({
  collections,
}: {
  collections: AppCollectionPreview[]
}) => {
  const scrollRef = useHorizontalWheelScroll()

  return (
    <section className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-800 p-3 shadow-xl shadow-black/20 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-zinc-100">Collections</h2>
        <Link
          to="/collections"
          className="rounded-md bg-zinc-900 p-1 text-zinc-400 transition hover:text-zinc-100"
          aria-label="Open collections"
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </Link>
      </div>
      <div
        ref={scrollRef}
        className="tiny-scrollbar mt-4 flex min-w-0 gap-3 overflow-x-auto overscroll-contain pb-2"
      >
        {collections.length > 0 ? (
          collections.map((collection) => (
            <Link
              key={collection.id}
              to={`/collections/${collection.id}`}
              className="relative h-36 w-60 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-lg shadow-black/25 transition hover:border-zinc-600 hover:bg-zinc-800 xs:h-40 xs:w-72 xs:p-4"
            >
              {collection.media.length > 1 ? (
                <div className="absolute inset-0 z-0 flex opacity-20">
                  {collection.media
                    .slice(0, 2)
                    .map((media, index) =>
                      media.image_path ? (
                        <img
                          key={`${collection.id}-${index}`}
                          src={`https://image.tmdb.org/t/p/w500${media.image_path}`}
                          alt=""
                          className="h-full w-1/2 object-cover"
                        />
                      ) : undefined,
                    )}
                  <div className="absolute inset-0 bg-zinc-950/70" />
                </div>
              ) : undefined}
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <h3 className="line-clamp-2 text-base font-bold text-white">
                    {collection.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                    {collection.description}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <CollectionStat
                    label="Items"
                    value={`${collection.mediaCount}`}
                  />
                  <CollectionStat
                    label="Size"
                    value={formatBytes(collection.totalSizeBytes ?? undefined)}
                  />
                  <CollectionStat
                    label="Delete"
                    value={
                      collection.deleteAfterDays == null
                        ? 'Never'
                        : `${collection.deleteAfterDays}d`
                    }
                  />
                </div>
              </div>
            </Link>
          ))
        ) : (
          <EmptyState text="No collections found." />
        )}
      </div>
    </section>
  )
}

const CollectionStat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="font-semibold uppercase tracking-wide text-zinc-500">
      {label}
    </p>
    <p className="truncate font-semibold text-maintainerr-400">{value}</p>
  </div>
)

const EmptyState = ({ text }: { text: string }) => (
  <div className="w-full min-w-0 flex-none rounded-lg border border-dashed border-zinc-700 bg-zinc-900 px-3 py-8 text-center text-sm text-zinc-500">
    {text}
  </div>
)

export default Overview
