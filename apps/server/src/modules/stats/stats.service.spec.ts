import { PlexLibraryItem } from '../api/plex-api/interfaces/library.interfaces'
import { TautulliRecentlyAddedItem } from '../api/tautulli-api/tautulli-api.service'
import {
  mapPlexLibraryRankingItem,
  mapTautulliRecentlyAddedItem,
} from './stats.service'

describe('mapTautulliRecentlyAddedItem', () => {
  it('maps episode indexes and metadata without additional lookups', () => {
    const item: TautulliRecentlyAddedItem = {
      media_type: 'episode',
      section_id: '17',
      library_name: 'TV Shows',
      rating_key: '124785',
      parent_rating_key: '124637',
      grandparent_rating_key: '121621',
      title: 'TBA',
      parent_title: 'Season 3',
      grandparent_title: 'House of the Dragon',
      media_index: '4',
      parent_media_index: '3',
      content_rating: 'TV-MA',
      summary: '',
      audience_rating: '1.0',
      user_rating: '',
      duration: '3688064',
      year: '2026',
      thumb: '/library/metadata/124785/thumb/1783937802',
      parent_thumb: '/library/metadata/124637/thumb/1783411863',
      grandparent_thumb: '/library/metadata/121621/thumb/1783930713',
      originally_available_at: '2026-07-12',
      added_at: '1783916015',
      updated_at: '1783937802',
      last_viewed_at: '',
      guid: 'plex://episode/example',
      guids: ['imdb://tt1234567', 'tmdb://7196567', 'tvdb://123456'],
      genres: [],
      labels: ['Overlay'],
      collections: [],
      child_count: '',
    }

    expect(mapTautulliRecentlyAddedItem(item)).toMatchObject({
      id: '124785',
      title: 'TBA',
      grandparentTitle: 'House of the Dragon',
      type: 'episode',
      index: 4,
      parentIndex: 3,
      durationMs: 3688064,
      library: { id: '17', title: 'TV Shows' },
      providerIds: {
        imdb: ['tt1234567'],
        tmdb: ['7196567'],
        tvdb: ['123456'],
      },
      tautulliPosterPath: '/library/metadata/121621/thumb/1783930713',
    })
  })
})

describe('mapPlexLibraryRankingItem', () => {
  it('totals all files and formats an episode context', () => {
    const item = {
      ratingKey: '122161',
      type: 'episode',
      title: 'Hardhome',
      grandparentTitle: 'Game of Thrones',
      parentIndex: 5,
      index: 8,
      addedAt: 1765096477,
      grandparentThumb: '/library/metadata/122152/thumb/1783503145',
      art: '/library/metadata/122152/art/1783503145',
      Media: [
        { Part: [{ size: 100 }, { size: 50 }] },
        { Part: [{ size: 25 }] },
      ],
    } as PlexLibraryItem

    expect(mapPlexLibraryRankingItem(item)).toEqual({
      title: 'Game of Thrones - S05E08',
      ratingKey: '122161',
      addedAt: new Date(1765096477 * 1000).toISOString(),
      sizeBytes: 175,
      posterPath: '/library/metadata/122152/thumb/1783503145',
      backdropPath: '/library/metadata/122152/art/1783503145',
    })
  })
})
