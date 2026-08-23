import {
  type MediaItem,
  type MediaItemWithParent,
} from '@maintainerr/contracts'
import { debounce } from 'lodash-es'
import { useEffect, useRef } from 'react'
import { PhotographIcon } from '@heroicons/react/outline'
import { ICollectionMedia } from '../../Collection'
import LoadingSpinner, {
  SmallLoadingSpinner,
} from '../../Common/LoadingSpinner'
import MediaCard from '../../Common/MediaCard'
import { getMediaItemIdentity } from '../../../utils/mediaIdentity'

interface IMediaContent {
  data: MediaItem[]
  dataFinished: boolean
  loading: boolean
  extrasLoading?: boolean
  fetchData: () => void
  onRemove?: (id: string) => void
  libraryId: string
  collectionPage?: boolean
  collectionInfo?: ICollectionMedia[]
  collectionId?: number
  emptyTitle?: string
}

type ScheduledMediaItem = MediaItem & {
  maintainerrManualFilter?: boolean
  maintainerrLeavingSoon?: {
    collectionId: number
    collectionTitle?: string
    daysLeft: number
  }
  maintainerrExcluded?: {
    exclusionId: number
    scope: 'global' | 'collection'
    collectionId?: number
    collectionTitle?: string
    expiresAt?: string
  }
}

/**
 * Extract TMDB ID from a MediaItem.
 * For episodes/seasons, checks parent item's providerIds.
 */
function extractTmdbId(
  item: MediaItem | MediaItemWithParent,
): string | undefined {
  const parentItem = (item as MediaItemWithParent).parentItem

  // For seasons/episodes, always use the parent show's TMDB ID
  if (
    (item.type === 'season' || item.type === 'episode') &&
    parentItem?.providerIds?.tmdb?.[0]
  ) {
    return parentItem.providerIds.tmdb[0]
  }

  if (item.providerIds?.tmdb?.[0]) {
    return item.providerIds.tmdb[0]
  }

  if (parentItem?.providerIds?.tmdb?.[0]) {
    return parentItem.providerIds.tmdb[0]
  }

  return undefined
}

const MediaContent = (props: IMediaContent) => {
  const {
    collectionInfo,
    data,
    dataFinished,
    extrasLoading,
    fetchData,
    loading,
  } = props
  const latestPropsRef = useRef(props)

  const isNearBottom = () =>
    window.innerHeight + document.documentElement.scrollTop >=
    document.documentElement.scrollHeight * 0.8

  useEffect(() => {
    latestPropsRef.current = props
  }, [props])

  useEffect(() => {
    const debouncedScroll = debounce(() => {
      const latestProps = latestPropsRef.current

      if (
        isNearBottom() &&
        !latestProps.extrasLoading &&
        !latestProps.dataFinished
      ) {
        latestProps.fetchData()
      }
    }, 200)
    window.addEventListener('scroll', debouncedScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      debouncedScroll.cancel() // Cancel pending debounced calls
    }
  }, [])

  useEffect(() => {
    if (isNearBottom() && !loading && !extrasLoading && !dataFinished) {
      fetchData()
    }
  }, [data, dataFinished, extrasLoading, fetchData, loading])

  const getDaysLeft = (mediaId: string) => {
    if (collectionInfo) {
      const collectionData = collectionInfo.find(
        (colEl) => colEl.mediaServerId === mediaId,
      )
      if (collectionData && collectionData.collection) {
        if (collectionData.collection.deleteAfterDays == null) {
          return undefined
        }

        const date = new Date(collectionData.addDate)
        const today = new Date()

        date.setDate(date.getDate() + collectionData.collection.deleteAfterDays)

        const diffTime = date.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      }
    }
    return undefined
  }

  const getCountdownCollectionNames = (mediaId: string) =>
    Array.from(
      new Set(
        (collectionInfo ?? [])
          .filter((item) => item.mediaServerId === mediaId)
          .map((item) => item.collection?.title)
          .filter((title): title is string => Boolean(title)),
      ),
    )

  /**
   * Get the parent year from a MediaItem.
   * For episodes/seasons, this is the show's year.
   */
  const getParentYear = (item: MediaItem): number | undefined => {
    const parentItem = (item as MediaItemWithParent).parentItem
    return parentItem?.year
  }

  /**
   * Get the audience rating from a MediaItem's ratings array.
   */
  const getAudienceRating = (item: MediaItem): number => {
    return item.ratings?.find((r) => r.type === 'audience')?.value ?? 0
  }

  const getSeasonLabel = (item: MediaItem): string | undefined => {
    if (item.type === 'season') {
      return item.index != null ? `Season ${item.index}` : item.title
    }

    return undefined
  }

  const padEpisodeNumber = (value: number): string =>
    value.toString().padStart(2, '0')

  const getEpisodeLabel = (item: MediaItem): string | undefined => {
    if (item.type !== 'episode' || item.index == null) {
      return undefined
    }

    if (item.parentIndex != null) {
      return `S${padEpisodeNumber(item.parentIndex)}E${padEpisodeNumber(item.index)}`
    }

    return `E${padEpisodeNumber(item.index)}`
  }

  if (props.loading) {
    return <LoadingSpinner />
  }

  if (props.data && props.data.length > 0) {
    return (
      <ul className="cards-vertical">
        {props.data.map((el: ScheduledMediaItem, index) => (
          <li key={`${getMediaItemIdentity(el)}:${index}`}>
            <MediaCard
              id={el.id}
              libraryId={props.libraryId}
              type={el.type}
              image={''}
              summary={
                el.type === 'movie' || el.type === 'show'
                  ? el.summary
                  : el.type === 'season'
                    ? el.title
                    : el.type === 'episode'
                      ? getEpisodeLabel(el)
                      : ''
              }
              year={
                el.type === 'episode'
                  ? undefined
                  : getParentYear(el)
                    ? getParentYear(el)?.toString()
                    : el.year?.toString()
              }
              mediaType={el.type}
              title={
                el.grandparentTitle
                  ? el.grandparentTitle
                  : el.parentTitle
                    ? el.parentTitle
                    : el.title
              }
              seasonLabel={getSeasonLabel(el)}
              userScore={getAudienceRating(el)}
              exclusionId={
                el.maintainerrExclusionId
                  ? el.maintainerrExclusionId
                  : undefined
              }
              tmdbid={extractTmdbId(el)}
              collectionPage={Boolean(
                props.collectionPage || el.maintainerrExcluded,
              )}
              exclusionType={
                el.maintainerrExcluded
                  ? el.maintainerrExcluded.scope === 'global'
                    ? 'global'
                    : 'specific'
                  : el.maintainerrExclusionType
              }
              onRemove={props.onRemove}
              collectionId={props.collectionId}
              isManual={el.maintainerrIsManual ? el.maintainerrIsManual : false}
              manualFilter={el.maintainerrManualFilter}
              leavingSoonFilter={Boolean(el.maintainerrLeavingSoon)}
              {...(props.collectionInfo
                ? {
                    daysLeft: getDaysLeft(el.id),
                    collectionId: props.collectionInfo.find(
                      (colEl) => colEl.mediaServerId === el.id,
                    )?.collectionId,
                    countdownCollectionNames: getCountdownCollectionNames(
                      el.id,
                    ),
                  }
                : undefined)}
              {...(el.maintainerrLeavingSoon
                ? {
                    daysLeft: el.maintainerrLeavingSoon.daysLeft,
                    collectionId: el.maintainerrLeavingSoon.collectionId,
                    exclusionCollectionTitle:
                      el.maintainerrLeavingSoon.collectionTitle,
                    countdownCollectionNames: el.maintainerrLeavingSoon
                      .collectionTitle
                      ? [el.maintainerrLeavingSoon.collectionTitle]
                      : [],
                  }
                : undefined)}
              {...(el.maintainerrExcluded
                ? {
                    exclusionId: el.maintainerrExcluded.exclusionId,
                    collectionId: el.maintainerrExcluded.collectionId ?? 0,
                    exclusionCollectionTitle:
                      el.maintainerrExcluded.collectionTitle,
                    exclusionExpiresAt: el.maintainerrExcluded.expiresAt,
                    reviewExclusion: true,
                  }
                : undefined)}
            />
          </li>
        ))}
        {props.extrasLoading ? <SmallLoadingSpinner /> : undefined}
      </ul>
    )
  }
  return (
    <div className="flex min-h-[45vh] items-center justify-center px-6 text-center">
      <div>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-maintainerr-400 ring-1 ring-zinc-700">
          <PhotographIcon className="h-6 w-6" />
        </span>
        <h3 className="mt-3 text-base font-semibold text-zinc-200">
          {props.emptyTitle ?? 'No media found'}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          There is nothing to display for this view.
        </p>
      </div>
    </div>
  )
}
export default MediaContent
