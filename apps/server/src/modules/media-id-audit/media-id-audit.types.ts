export type MediaIdAuditCategory =
  | 'probable_mismatch'
  | 'missing_plex_id'
  | 'not_found_in_arr'
  | 'duplicate_plex_id'
  | 'ambiguous_title_match'
  | 'plex_trash'

export type MediaIdAuditMediaType = 'movie' | 'show'
export type MediaIdAuditFindingState = 'current' | 'resolved'
export type MediaIdAuditRunStatus = 'running' | 'completed' | 'failed'

export interface AuditPlexItem {
  mediaType: MediaIdAuditMediaType
  title: string
  year?: number
  ratingKey: string
  libraryId: string
  libraryTitle: string
  providerIds: string[]
  inPlexTrash?: boolean
}

export interface AuditArrItem {
  mediaType: MediaIdAuditMediaType
  title: string
  year?: number
  providerId: string
  serverName: string
  itemId: number
}

export interface MediaIdAuditFindingDraft {
  fingerprint: string
  category: MediaIdAuditCategory
  mediaType: MediaIdAuditMediaType
  title: string
  year?: number
  plexLibraryId: string
  plexLibraryTitle: string
  plexRatingKey: string
  plexProviderId?: string
  arrProviderId?: string
  arrServerName?: string
  arrItemId?: number
  confidence: 'high' | 'medium' | 'info'
  reason: string
}
