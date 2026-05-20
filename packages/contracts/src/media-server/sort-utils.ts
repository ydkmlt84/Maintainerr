import {
  type MediaLibrarySortField,
  type MediaLibrarySortKey,
  type MediaSortOrder,
} from './sorting'
import type { MediaItem } from './types'

const defaultMediaLibrarySort: MediaLibrarySortKey = 'title.asc'

const toDayBucket = (
  value: Date | string | number | null | undefined,
): number | undefined => {
  if (value == null) return undefined
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 86400000)
}

const getAudienceRating = (item: MediaItem): number | undefined => {
  return item.ratings?.find((rating) => rating.type === 'audience')?.value
}

const getAirDateBucket = (item: MediaItem): number | undefined =>
  toDayBucket(item.originallyAvailableAt)

const getWatchCount = (item: MediaItem): number | undefined => item.viewCount

const compareByDisplayHierarchy = (
  leftItem: MediaItem,
  rightItem: MediaItem,
): number => {
  const leftPrimary =
    leftItem.grandparentTitle ?? leftItem.parentTitle ?? leftItem.title
  const rightPrimary =
    rightItem.grandparentTitle ?? rightItem.parentTitle ?? rightItem.title

  return (
    leftPrimary.localeCompare(rightPrimary) ||
    leftItem.title.localeCompare(rightItem.title)
  )
}

const compareNumericWithTitleFallback = (
  leftItem: MediaItem,
  rightItem: MediaItem,
  getValue: (item: MediaItem) => number | undefined,
  direction: 1 | -1,
): number => {
  const leftValue = getValue(leftItem)
  const rightValue = getValue(rightItem)

  if (leftValue === undefined && rightValue === undefined) {
    return compareByDisplayHierarchy(leftItem, rightItem)
  }
  if (leftValue === undefined) return 1
  if (rightValue === undefined) return -1

  return (
    (leftValue - rightValue) * direction ||
    compareByDisplayHierarchy(leftItem, rightItem)
  )
}

export const compareMediaItemsBySort = (
  leftItem: MediaItem,
  rightItem: MediaItem,
  sort?: MediaLibrarySortField,
  sortOrder: MediaSortOrder = 'asc',
): number => {
  const direction: 1 | -1 = sortOrder === 'desc' ? -1 : 1

  switch (sort) {
    case 'title':
      return compareByDisplayHierarchy(leftItem, rightItem) * direction
    case 'airDate':
      return compareNumericWithTitleFallback(
        leftItem,
        rightItem,
        getAirDateBucket,
        direction,
      )
    case 'rating':
      return compareNumericWithTitleFallback(
        leftItem,
        rightItem,
        getAudienceRating,
        direction,
      )
    case 'watchCount':
      return compareNumericWithTitleFallback(
        leftItem,
        rightItem,
        getWatchCount,
        direction,
      )
    default:
      return 0
  }
}

export const compareMediaItemsBySortKey = (
  leftItem: MediaItem,
  rightItem: MediaItem,
  sortKey: MediaLibrarySortKey = defaultMediaLibrarySort,
): number => {
  const [sort, sortOrder] = sortKey.split('.') as [
    MediaLibrarySortField,
    MediaSortOrder,
  ]

  return compareMediaItemsBySort(leftItem, rightItem, sort, sortOrder)
}
