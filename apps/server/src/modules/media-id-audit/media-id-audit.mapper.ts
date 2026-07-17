import { MediaItem, MediaLibrary } from '@maintainerr/contracts'
import { AuditPlexItem } from './media-id-audit.types'

export const is4kLibrary = (library: MediaLibrary) =>
  /(^|\W)4k(\W|$)/i.test(library.title)

export const mapPlexItemForAudit = (
  item: MediaItem,
  library: MediaLibrary,
  inPlexTrash = false,
): AuditPlexItem => {
  const providerIds =
    library.type === 'movie' ? item.providerIds.tmdb : item.providerIds.tvdb

  return {
    mediaType: library.type,
    title: item.title,
    year: item.year,
    ratingKey: item.id,
    libraryId: library.id,
    libraryTitle: library.title,
    providerIds: [...new Set((providerIds ?? []).filter(Boolean))],
    ...(inPlexTrash ? { inPlexTrash: true } : {}),
  }
}
