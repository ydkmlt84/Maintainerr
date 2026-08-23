import { compareMediaIds } from './media-id-audit.comparison'
import { AuditArrItem, AuditPlexItem } from './media-id-audit.types'

const plexItem = (overrides: Partial<AuditPlexItem> = {}): AuditPlexItem => ({
  mediaType: 'movie',
  title: 'Example Movie',
  year: 2024,
  ratingKey: '100',
  libraryId: '1',
  libraryTitle: 'Movies',
  providerIds: ['123'],
  ...overrides,
})

const arrItem = (overrides: Partial<AuditArrItem> = {}): AuditArrItem => ({
  mediaType: 'movie',
  title: 'Example Movie',
  year: 2024,
  providerId: '123',
  serverName: 'Radarr',
  itemId: 10,
  ...overrides,
})

describe('compareMediaIds', () => {
  it('accepts an exact provider ID match', () => {
    const result = compareMediaIds([plexItem()], [arrItem()])

    expect(result.matchedCount).toBe(1)
    expect(result.findings).toHaveLength(0)
  })

  it('reports a probable mismatch for one exact title and year match', () => {
    const result = compareMediaIds(
      [plexItem()],
      [arrItem({ providerId: '456' })],
    )

    expect(result.findings).toEqual([
      expect.objectContaining({
        category: 'probable_mismatch',
        plexProviderId: '123',
        arrProviderId: '456',
        confidence: 'high',
      }),
    ])
  })

  it('separates missing IDs, missing Arr items, and ambiguous title matches', () => {
    const result = compareMediaIds(
      [
        plexItem({ ratingKey: '1', providerIds: [] }),
        plexItem({
          ratingKey: '2',
          title: 'Not In Radarr',
          providerIds: ['124'],
        }),
        plexItem({
          ratingKey: '3',
          title: 'Duplicate Title',
          providerIds: ['125'],
        }),
      ],
      [
        arrItem({ title: 'Duplicate Title', providerId: '456' }),
        arrItem({ title: 'Duplicate Title', providerId: '789', itemId: 11 }),
      ],
    )

    expect(result.findings.map((finding) => finding.category)).toEqual([
      'missing_plex_id',
      'not_found_in_arr',
      'ambiguous_title_match',
    ])
  })

  it('reports each Plex item that shares a provider ID', () => {
    const result = compareMediaIds(
      [plexItem(), plexItem({ ratingKey: '101', title: 'Other Movie' })],
      [arrItem()],
    )

    expect(
      result.findings.filter(
        (finding) => finding.category === 'duplicate_plex_id',
      ),
    ).toHaveLength(2)
  })

  it('completely excludes Plex trash from the audit', () => {
    const result = compareMediaIds(
      [plexItem({ inPlexTrash: true })],
      [arrItem()],
    )

    expect(result.matchedCount).toBe(0)
    expect(result.findings).toHaveLength(0)
  })
})
