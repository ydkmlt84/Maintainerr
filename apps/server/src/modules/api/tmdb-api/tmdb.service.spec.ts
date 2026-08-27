import {
  TmdbMovieDetails,
  TmdbTvDetails,
  TmdbTvSeasonDetails,
} from './interfaces/tmdb.interface'
import { TmdbApiService } from './tmdb.service'
import { MaintainerrLogger } from '../../logging/logs.service'

describe('TmdbApiService media assets', () => {
  let service: TmdbApiService

  beforeEach(() => {
    service = new TmdbApiService({
      setContext: jest.fn(),
    } as unknown as MaintainerrLogger)
  })

  it('returns the backdrop and prefers an official YouTube trailer', async () => {
    jest.spyOn(service, 'getMovie').mockResolvedValue({
      backdrop_path: '/backdrop.jpg',
      videos: {
        results: [
          {
            id: 'first',
            key: 'unofficial-key',
            name: 'Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
          },
          {
            id: 'official',
            key: 'official key',
            name: 'Official Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
            official: true,
          },
        ],
      },
    } as TmdbMovieDetails)

    await expect(
      service.getMediaAssets({ tmdbId: 4011, type: 'movie' }),
    ).resolves.toEqual({
      backdropPath: '/backdrop.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=official%20key',
      cast: [],
    })
  })

  it('prefers a generic show trailer over a different season trailer', async () => {
    jest.spyOn(service, 'getTvShow').mockResolvedValue({
      backdrop_path: '/show.jpg',
      videos: {
        results: [
          {
            id: 'season-four',
            key: 'season-four-key',
            name: 'Season 4 Official Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
            official: true,
          },
          {
            id: 'series',
            key: 'series-key',
            name: 'Official Series Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
          },
        ],
      },
    } as TmdbTvDetails)

    await expect(
      service.getMediaAssets({ tmdbId: 2604, type: 'show', seasonNumber: 2 }),
    ).resolves.toEqual({
      backdropPath: '/show.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=series-key',
      cast: [],
    })
  })

  it('falls back to the requested season trailer, not another season', async () => {
    jest.spyOn(service, 'getTvShow').mockResolvedValue({
      backdrop_path: '/show.jpg',
      videos: {
        results: [
          {
            id: 'season-four',
            key: 'season-four-key',
            name: 'Season 4 Official Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
            official: true,
          },
        ],
      },
    } as TmdbTvDetails)
    jest.spyOn(service, 'getTvSeason').mockResolvedValue({
      id: 2,
      air_date: '2005-10-02',
      episode_count: 15,
      name: 'Season 2',
      overview: '',
      season_number: 2,
      videos: {
        results: [
          {
            id: 'season-two',
            key: 'season-two-key',
            name: 'Season 2 Trailer',
            site: 'YouTube',
            size: 1080,
            type: 'Trailer',
            official: true,
          },
        ],
      },
    } as TmdbTvSeasonDetails)

    await expect(
      service.getMediaAssets({ tmdbId: 2604, type: 'show', seasonNumber: 2 }),
    ).resolves.toEqual({
      backdropPath: '/show.jpg',
      trailerUrl: 'https://www.youtube.com/watch?v=season-two-key',
      cast: [],
    })
  })

  it('returns a compact cast list for the media modal', async () => {
    jest.spyOn(service, 'getMovie').mockResolvedValue({
      backdrop_path: '/backdrop.jpg',
      credits: {
        cast: [
          {
            id: 101,
            name: 'Lead Actor',
            character: 'The Lead',
            profile_path: '/lead.jpg',
          },
        ],
      },
      videos: { results: [] },
    } as TmdbMovieDetails)

    await expect(
      service.getMediaAssets({ tmdbId: 4011, type: 'movie' }),
    ).resolves.toMatchObject({
      cast: [
        {
          id: 101,
          name: 'Lead Actor',
          character: 'The Lead',
          profilePath: '/lead.jpg',
        },
      ],
    })
  })

  it('limits media assets to ten cast members', async () => {
    jest.spyOn(service, 'getMovie').mockResolvedValue({
      credits: {
        cast: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `Actor ${index + 1}`,
          character: `Character ${index + 1}`,
        })),
      },
      videos: { results: [] },
    } as TmdbMovieDetails)

    const assets = await service.getMediaAssets({
      tmdbId: 4012,
      type: 'movie',
    })

    expect(assets.cast).toHaveLength(10)
    expect(assets.cast.at(-1)?.name).toBe('Actor 10')
  })
})
