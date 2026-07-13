import { TmdbMovieDetails } from './interfaces/tmdb.interface'
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
    })
  })
})
