export const mediaLibrarySortFields = [
  'title',
  'airDate',
  'rating',
  'watchCount',
] as const

export type MediaLibrarySortField = (typeof mediaLibrarySortFields)[number]

export const mediaSortOrders = ['asc', 'desc'] as const

export type MediaSortOrder = (typeof mediaSortOrders)[number]

export type MediaLibrarySortKey = `${MediaLibrarySortField}.${MediaSortOrder}`

export interface MediaLibrarySortParams {
  sort: MediaLibrarySortField
  sortOrder: MediaSortOrder
}
