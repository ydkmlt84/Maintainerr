import { MaintainerrLoggerFactory } from '../../logging/logs.service'
import { SettingsService } from '../../settings/settings.service'
import { ServarrService, buildServarrItemUrl } from './servarr.service'

describe('buildServarrItemUrl', () => {
  it('preserves a configured URL base and removes a trailing slash', () => {
    expect(
      buildServarrItemUrl(
        'https://servarr.example/radarr/',
        'movie',
        'the-movie',
      ),
    ).toBe('https://servarr.example/radarr/movie/the-movie')
  })
})

describe('ServarrService media links', () => {
  const loggerFactory = {
    createLogger: jest.fn(),
  } as unknown as MaintainerrLoggerFactory

  it('returns a direct Radarr movie link for a matching TMDB ID', async () => {
    const settings = {
      getRadarrSettings: jest.fn().mockResolvedValue([
        {
          id: 1,
          serverName: 'Movies',
          url: 'http://radarr.internal:7878',
          externalUrl: 'https://radarr.example',
        },
      ]),
    } as unknown as SettingsService
    const service = new ServarrService(settings, loggerFactory)
    jest.spyOn(service, 'getRadarrApiClient').mockResolvedValue({
      getMovies: jest
        .fn()
        .mockResolvedValue([
          { id: 41, tmdbId: 101, titleSlug: 'example-movie' },
        ]),
    } as never)

    await expect(
      service.getMediaLinks({ type: 'movie', tmdbId: 101 }),
    ).resolves.toEqual([
      {
        service: 'radarr',
        instanceName: 'Movies',
        itemId: 41,
        href: 'https://radarr.example/movie/example-movie',
      },
    ])
  })

  it('returns a direct Sonarr series link for a matching TVDB ID', async () => {
    const settings = {
      getSonarrSettings: jest.fn().mockResolvedValue([
        {
          id: 2,
          serverName: 'Television',
          url: 'http://sonarr.internal:8989',
          externalUrl: 'https://sonarr.example/base/',
        },
      ]),
    } as unknown as SettingsService
    const service = new ServarrService(settings, loggerFactory)
    jest.spyOn(service, 'getSonarrApiClient').mockResolvedValue({
      getSeries: jest
        .fn()
        .mockResolvedValue([
          { id: 52, tvdbId: 202, titleSlug: 'example-show' },
        ]),
    } as never)

    await expect(
      service.getMediaLinks({ type: 'show', tvdbId: 202 }),
    ).resolves.toEqual([
      {
        service: 'sonarr',
        instanceName: 'Television',
        itemId: 52,
        href: 'https://sonarr.example/base/series/example-show',
      },
    ])
  })
})
