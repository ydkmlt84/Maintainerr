export interface IPlexMetadata {
  ratingKey: string
  key: string
  parentRatingKey?: string
  grandparentRatingKey?: string
  art: string
  audienceRating?: number
  audienceRatingImage?: string
  contentRating?: string
  duration: number
  guid: string
  type: 'movie' | 'show' | 'season' | 'episode'
  title: string
  Guid: { id: string }[]
  Genre?: { id: string }[]
  Country?: { tag: string }[]
  Role?: { tag: string }[]
  Writer?: { tag: string }[]
  Director?: { tag: string }[]
  addedAt: number
  childCount?: number
  leafCount?: number
  viewedLeafCount?: number
  primaryExtraKey: string
  originallyAvailableAt: string
  updatedAt: number
  thumb: string
  tagline?: string
  summary: string
  studio: string
  year: number
  viewCount?: number
  lastViewedAt?: number
  parentTitle?: string
  grandparentTitle?: string
  parentData?: IPlexMetadata
  parentYear?: number
  grandParentYear?: number
  index?: number
  maintainerrExclusionType?: 'specific' | 'global'
  maintainerrExclusionId?: number
  maintainerrExclusionLabels?: string[]
  maintainerrExclusionTargets?: { id?: number; label: string }[]
  maintainerrIsManual?: boolean
  maintainerrCollections?: { id: number; title: string; isManual?: boolean; daysLeft?: number }[]
  maintainerrDaysLeft?: number
}
