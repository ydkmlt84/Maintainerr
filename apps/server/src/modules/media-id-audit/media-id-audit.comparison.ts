import {
  AuditArrItem,
  AuditPlexItem,
  MediaIdAuditCategory,
  MediaIdAuditFindingDraft,
} from './media-id-audit.types'

const normalizeTitle = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const titleYearKey = (title: string, year?: number) =>
  `${normalizeTitle(title)}:${year ?? ''}`

const fingerprint = (
  category: MediaIdAuditCategory,
  item: AuditPlexItem,
  arrProviderId = '',
) =>
  [
    category,
    item.mediaType,
    item.libraryId,
    item.ratingKey,
    item.providerIds.join(','),
    arrProviderId,
  ].join(':')

const baseFinding = (
  item: AuditPlexItem,
  category: MediaIdAuditCategory,
): Omit<MediaIdAuditFindingDraft, 'confidence' | 'reason'> => ({
  fingerprint: fingerprint(category, item),
  category,
  mediaType: item.mediaType,
  title: item.title,
  year: item.year,
  plexLibraryId: item.libraryId,
  plexLibraryTitle: item.libraryTitle,
  plexRatingKey: item.ratingKey,
  plexProviderId: item.providerIds.join(', ') || undefined,
})

export interface ComparisonResult {
  findings: MediaIdAuditFindingDraft[]
  matchedCount: number
}

export const compareMediaIds = (
  plexItems: AuditPlexItem[],
  arrItems: AuditArrItem[],
): ComparisonResult => {
  const findings: MediaIdAuditFindingDraft[] = []
  let matchedCount = 0
  const arrByType = new Map<'movie' | 'show', AuditArrItem[]>([
    ['movie', arrItems.filter((item) => item.mediaType === 'movie')],
    ['show', arrItems.filter((item) => item.mediaType === 'show')],
  ])
  const duplicateCounts = new Map<string, number>()

  for (const item of plexItems) {
    for (const providerId of item.providerIds) {
      const key = `${item.mediaType}:${providerId}`
      duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
    }
  }

  for (const item of plexItems) {
    const matchingArrItems = arrByType.get(item.mediaType) ?? []

    if (item.inPlexTrash) {
      findings.push({
        ...baseFinding(item, 'plex_trash'),
        confidence: 'info',
        reason:
          'Plex reports this item in the library trash, so it is not expected to exist in Radarr or Sonarr.',
      })
      continue
    }

    if (
      item.providerIds.some(
        (providerId) =>
          (duplicateCounts.get(`${item.mediaType}:${providerId}`) ?? 0) > 1,
      )
    ) {
      findings.push({
        ...baseFinding(item, 'duplicate_plex_id'),
        confidence: 'high',
        reason: `The Plex provider ID is shared by multiple ${item.mediaType === 'movie' ? 'movies' : 'shows'} in Plex.`,
      })
    }

    if (item.providerIds.length === 0) {
      findings.push({
        ...baseFinding(item, 'missing_plex_id'),
        confidence: 'high',
        reason: `Plex did not return a ${item.mediaType === 'movie' ? 'TMDB' : 'TVDB'} ID for this item.`,
      })
      continue
    }

    const exactMatches = matchingArrItems.filter((candidate) =>
      item.providerIds.includes(candidate.providerId),
    )
    if (exactMatches.length > 0) {
      matchedCount++
      continue
    }

    const titleCandidates = matchingArrItems.filter(
      (candidate) =>
        titleYearKey(candidate.title, candidate.year) ===
        titleYearKey(item.title, item.year),
    )
    const distinctCandidates = [
      ...new Map(
        titleCandidates.map((candidate) => [candidate.providerId, candidate]),
      ).values(),
    ]

    if (distinctCandidates.length === 1) {
      const candidate = distinctCandidates[0]
      findings.push({
        ...baseFinding(item, 'probable_mismatch'),
        fingerprint: fingerprint(
          'probable_mismatch',
          item,
          candidate.providerId,
        ),
        arrProviderId: candidate.providerId,
        arrServerName: candidate.serverName,
        arrItemId: candidate.itemId,
        confidence: 'high',
        reason: `The title and year match ${candidate.serverName}, but the provider IDs differ.`,
      })
    } else if (distinctCandidates.length > 1) {
      findings.push({
        ...baseFinding(item, 'ambiguous_title_match'),
        arrProviderId: distinctCandidates
          .map((candidate) => candidate.providerId)
          .join(', '),
        confidence: 'medium',
        reason: `Multiple Arr items have the same normalized title and year, so a likely match cannot be selected.`,
      })
    } else {
      findings.push({
        ...baseFinding(item, 'not_found_in_arr'),
        confidence: 'info',
        reason: `No matching provider ID or exact title and year was found in ${item.mediaType === 'movie' ? 'Radarr' : 'Sonarr'}.`,
      })
    }
  }

  return { findings, matchedCount }
}
