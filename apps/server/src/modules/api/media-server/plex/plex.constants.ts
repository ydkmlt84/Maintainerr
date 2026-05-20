import {
  type MediaLibrarySortField,
  type MediaSortOrder,
} from '@maintainerr/contracts';

const PLEX_SORT_FIELDS: Partial<Record<MediaLibrarySortField, string>> = {
  airDate: 'originallyAvailableAt',
  rating: 'audienceRating',
  title: 'titleSort',
  watchCount: 'viewCount',
};

export function toPlexSort(
  sort?: MediaLibrarySortField,
  sortOrder?: MediaSortOrder,
): string | undefined {
  const field = sort ? PLEX_SORT_FIELDS[sort] : undefined;

  if (!field) {
    return undefined;
  }

  return `${field}:${sortOrder ?? 'asc'}`;
}
