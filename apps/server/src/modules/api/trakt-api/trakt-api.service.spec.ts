import { MediaItem } from '@maintainerr/contracts'
import axios from 'axios'
import { MaintainerrLogger } from '../../logging/logs.service'
import { SettingsService } from '../../settings/settings.service'
import { MediaServerFactory } from '../media-server/media-server.factory'
import cacheManager from '../lib/cache'
import { ServarrService } from '../servarr-api/servarr.service'
import { TraktApiService } from './trakt-api.service'

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}))

describe('TraktApiService', () => {
  const api = { get: jest.fn(), post: jest.fn() }
  const auth = { post: jest.fn() }
  let settings: SettingsService
  let mediaServerFactory: MediaServerFactory
  let servarr: ServarrService
  let service: TraktApiService

  beforeEach(() => {
    jest.clearAllMocks()
    cacheManager.getCache('trakt')?.flush()
    ;(axios.create as jest.Mock)
      .mockReturnValueOnce(api)
      .mockReturnValueOnce(auth)
    settings = {
      saveTraktConfiguration: jest.fn(),
      saveTraktTokens: jest.fn(),
      saveTraktUsername: jest.fn(),
      disconnectTrakt: jest.fn(),
      removeTraktConfiguration: jest.fn(),
    } as unknown as SettingsService
    mediaServerFactory = {
      getService: jest.fn(),
    } as unknown as MediaServerFactory
    servarr = {
      getRadarrApiClient: jest.fn(),
      getSonarrApiClient: jest.fn(),
    } as unknown as ServarrService
    settings.getRadarrSettings = jest.fn().mockResolvedValue([])
    settings.getSonarrSettings = jest.fn().mockResolvedValue([])
    service = new TraktApiService(settings, mediaServerFactory, servarr, {
      setContext: jest.fn(),
      warn: jest.fn(),
    } as unknown as MaintainerrLogger)
  })

  it('returns an empty, optional discovery response when unconfigured', async () => {
    await expect(service.getDiscover()).resolves.toEqual({
      configured: false,
      connected: false,
      sections: {
        trendingMovies: [],
        popularMovies: [],
        trendingShows: [],
        popularShows: [],
      },
    })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('filters library titles and removes popular duplicates', async () => {
    settings.trakt_client_id = 'client-id'
    settings.trakt_client_secret = 'client-secret'
    const media = (title: string, trakt: number, tmdb: number) => ({
      title,
      year: 2026,
      ids: { trakt, tmdb },
    })
    api.get.mockImplementation((url: string) => {
      switch (url) {
        case '/movies/trending':
          return Promise.resolve({
            data: [
              { watchers: 10, movie: media('In Library', 1, 101) },
              { watchers: 9, movie: media('Trending Movie', 2, 102) },
            ],
          })
        case '/movies/popular':
          return Promise.resolve({
            data: [
              media('Trending Movie', 2, 102),
              media('Popular Movie', 3, 103),
            ],
          })
        case '/shows/trending':
          return Promise.resolve({
            data: [{ watchers: 8, show: media('Trending Show', 4, 104) }],
          })
        case '/shows/popular':
          return Promise.resolve({ data: [media('Popular Show', 5, 105)] })
        default:
          throw new Error(`Unexpected URL: ${url}`)
      }
    })
    const libraryItem = {
      providerIds: { tmdb: ['101'] },
    } as MediaItem
    ;(mediaServerFactory.getService as jest.Mock).mockResolvedValue({
      getLibraries: jest
        .fn()
        .mockResolvedValue([{ id: 'movies', title: 'Movies', type: 'movie' }]),
      getLibraryContents: jest.fn().mockResolvedValue({
        items: [libraryItem],
        totalSize: 1,
        offset: 0,
        limit: 500,
      }),
    })

    const result = await service.getDiscover()

    expect(result.sections.trendingMovies.map((item) => item.title)).toEqual([
      'Trending Movie',
    ])
    expect(result.sections.popularMovies.map((item) => item.title)).toEqual([
      'Popular Movie',
    ])
    expect(result.sections.trendingShows).toHaveLength(1)
    expect(result.sections.popularShows).toHaveLength(1)

    await expect(service.getDiscover()).resolves.toEqual(result)
    expect(api.get).toHaveBeenCalledTimes(4)
    expect(mediaServerFactory.getService).toHaveBeenCalledTimes(1)
  })

  it('saves application credentials without requiring a Trakt login', async () => {
    await service.configure({
      clientId: ' client-id ',
      clientSecret: 'client-secret',
    })

    expect(settings.saveTraktConfiguration).toHaveBeenCalledWith(
      'client-id',
      'client-secret',
    )
  })

  it('marks a movie as watched in Trakt history', async () => {
    settings.trakt_client_id = 'client-id'
    settings.trakt_client_secret = 'client-secret'
    settings.trakt_access_token = 'access-token'
    settings.trakt_refresh_token = 'refresh-token'
    settings.trakt_token_expires_at = new Date(Date.now() + 600000)
    api.post.mockResolvedValue({ data: { added: { movies: 1 } } })
    cacheManager
      .getCache('trakt')
      ?.data.set('discover-response', { cached: true })

    await service.markWatched({ type: 'movie', traktId: 123 })

    expect(api.post).toHaveBeenCalledWith(
      '/sync/history',
      {
        movies: [
          expect.objectContaining({
            watched_at: expect.any(String),
            ids: { trakt: 123 },
          }),
        ],
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    )
    expect(cacheManager.getCache('trakt')?.data.has('discover-response')).toBe(
      false,
    )
  })

  it('accepts added episodes when marking an entire show watched', async () => {
    settings.trakt_client_id = 'client-id'
    settings.trakt_client_secret = 'client-secret'
    settings.trakt_access_token = 'access-token'
    settings.trakt_refresh_token = 'refresh-token'
    settings.trakt_token_expires_at = new Date(Date.now() + 600000)
    api.post.mockResolvedValue({ data: { added: { episodes: 12 } } })

    await expect(
      service.markWatched({ type: 'show', traktId: 456 }),
    ).resolves.toBeUndefined()
  })

  it('only treats shows with all aired episodes watched as watched', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          show: { ids: { trakt: 1 }, aired_episodes: 2 },
          seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
        },
        {
          show: { ids: { trakt: 2 }, aired_episodes: 2 },
          seasons: [
            {
              number: 1,
              episodes: [
                { number: 1, plays: 1 },
                { number: 2, plays: 1 },
              ],
            },
          ],
        },
      ],
      headers: { 'x-pagination-page-count': '1' },
    })

    await expect(
      (
        service as unknown as {
          getFullyWatchedShowIds(token: string): Promise<number[]>
        }
      ).getFullyWatchedShowIds('access-token'),
    ).resolves.toEqual([2])
  })

  it('maps configured Radarr and Sonarr inventory into discovery statuses', async () => {
    ;(settings.getRadarrSettings as jest.Mock).mockResolvedValue([
      {
        id: 1,
        serverName: 'Movies',
        url: 'http://radarr.internal:7878',
        externalUrl: 'https://radarr.example',
      },
    ])
    ;(settings.getSonarrSettings as jest.Mock).mockResolvedValue([
      {
        id: 2,
        serverName: 'Television',
        url: 'http://sonarr.internal:8989',
        externalUrl: 'https://sonarr.example',
      },
    ])
    ;(servarr.getRadarrApiClient as jest.Mock).mockResolvedValue({
      getQueue: jest.fn().mockResolvedValue([]),
      getMovies: jest.fn().mockResolvedValue([
        {
          id: 31,
          tmdbId: 101,
          monitored: true,
          isAvailable: true,
          hasFile: false,
          titleSlug: 'example-movie',
        },
      ]),
    })
    ;(servarr.getSonarrApiClient as jest.Mock).mockResolvedValue({
      getQueue: jest.fn().mockResolvedValue([]),
      getSeries: jest.fn().mockResolvedValue([
        {
          id: 42,
          tvdbId: 202,
          monitored: true,
          status: 'continuing',
          titleSlug: 'example-show',
          statistics: { episodeFileCount: 8, episodeCount: 10 },
        },
      ]),
    })

    const statuses = await (
      service as unknown as {
        getServarrStatuses(): Promise<
          Map<string, { state: string; status: string }[]>
        >
      }
    ).getServarrStatuses()

    expect(statuses.get('movie:tmdb:101')).toEqual([
      expect.objectContaining({
        itemId: 31,
        state: 'missing',
        status: 'Missing, monitored',
        href: 'https://radarr.example/movie/example-movie',
      }),
    ])
    expect(statuses.get('show:tvdb:202')).toEqual([
      expect.objectContaining({
        itemId: 42,
        state: 'partial',
        status: 'Partially downloaded',
        detail: '8/10 episodes',
        href: 'https://sonarr.example/series/example-show',
      }),
    ])
  })
})
