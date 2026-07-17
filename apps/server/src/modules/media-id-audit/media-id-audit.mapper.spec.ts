import { MediaItem, MediaLibrary } from '@maintainerr/contracts'
import { is4kLibrary, mapPlexItemForAudit } from './media-id-audit.mapper'

describe('mapPlexItemForAudit', () => {
  it('uses the requested library when Plex omits per-item library fields', () => {
    const item = {
      id: '100',
      title: 'Example Movie',
      year: 2024,
      providerIds: { tmdb: ['123'] },
      library: { id: undefined, title: undefined },
    } as unknown as MediaItem
    const library: MediaLibrary = {
      id: '5',
      title: 'Movies',
      type: 'movie',
    }

    expect(mapPlexItemForAudit(item, library)).toEqual({
      mediaType: 'movie',
      title: 'Example Movie',
      year: 2024,
      ratingKey: '100',
      libraryId: '5',
      libraryTitle: 'Movies',
      providerIds: ['123'],
    })
  })

  it('identifies 4K libraries without matching unrelated numbers', () => {
    expect(is4kLibrary({ id: '1', title: 'Movies - 4K', type: 'movie' })).toBe(
      true,
    )
    expect(is4kLibrary({ id: '2', title: '4K TV Shows', type: 'show' })).toBe(
      true,
    )
    expect(
      is4kLibrary({ id: '3', title: 'Movies 14K Archive', type: 'movie' }),
    ).toBe(false)
  })

  it('marks an item returned by the Plex trash query', () => {
    const item = {
      id: '100',
      title: 'Example Movie',
      providerIds: { tmdb: ['123'] },
    } as unknown as MediaItem
    const library: MediaLibrary = {
      id: '5',
      title: 'Movies',
      type: 'movie',
    }

    expect(mapPlexItemForAudit(item, library, true).inPlexTrash).toBe(true)
  })
})
