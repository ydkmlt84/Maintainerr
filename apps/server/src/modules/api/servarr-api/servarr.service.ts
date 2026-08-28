import { ServarrMediaLink } from '@maintainerr/contracts'
import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { SettingsService } from '../../../modules/settings/settings.service'
import { MaintainerrLoggerFactory } from '../../logging/logs.service'
import { RadarrSettingRawDto } from "../../settings/dto's/radarr-setting.dto"
import { SonarrSettingRawDto } from "../../settings/dto's/sonarr-setting.dto"
import cacheManager from '../lib/cache'
import { RadarrApi } from './helpers/radarr.helper'
import { SonarrApi } from './helpers/sonarr.helper'

export const buildServarrItemUrl = (
  baseUrl: string,
  resource: 'movie' | 'series',
  titleSlug: string,
): string =>
  `${baseUrl.replace(/\/+$/, '')}/${resource}/${encodeURIComponent(titleSlug)}`

@Injectable()
export class ServarrService {
  SonarrApi: SonarrApi
  private radarrApiCache: Record<string, RadarrApi> = {}
  private sonarrApiCache: Record<string, SonarrApi> = {}

  constructor(
    @Inject(forwardRef(() => SettingsService))
    private readonly settings: SettingsService,
    private readonly loggerFactory: MaintainerrLoggerFactory,
  ) {}

  public async getSonarrApiClient(id: number | SonarrSettingRawDto) {
    if (typeof id === 'object') {
      return new SonarrApi(
        {
          url: `${id.url}/api/v3/`,
          apiKey: `${id.apiKey}`,
        },
        this.loggerFactory.createLogger(),
      )
    } else {
      if (!this.sonarrApiCache[id]) {
        const setting = await this.settings.getSonarrSetting(id)

        if (setting == null || !('id' in setting)) {
          throw new Error('Sonarr setting not found')
        }

        const cacheKey = `sonarr-${id}`
        if (!cacheManager.getCache(cacheKey)) {
          cacheManager.createCache(cacheKey, `Sonarr-${id}`, 'sonarr')
        }

        this.sonarrApiCache[id] = new SonarrApi(
          {
            url: `${setting.url}/api/v3/`,
            apiKey: `${setting.apiKey}`,
            cacheName: cacheKey,
          },
          this.loggerFactory.createLogger(),
        )
      }

      return this.sonarrApiCache[id]
    }
  }

  public async getRadarrApiClient(id: number | RadarrSettingRawDto) {
    if (typeof id === 'object') {
      return new RadarrApi(
        {
          url: `${id.url}/api/v3/`,
          apiKey: `${id.apiKey}`,
        },
        this.loggerFactory.createLogger(),
      )
    } else {
      if (!this.radarrApiCache[id]) {
        const setting = await this.settings.getRadarrSetting(id)

        if (setting == null || !('id' in setting)) {
          throw new Error('Radarr setting not found')
        }

        const cacheKey = `radarr-${id}`
        if (!cacheManager.getCache(cacheKey)) {
          cacheManager.createCache(cacheKey, `Radarr-${id}`, 'radarr')
        }

        this.radarrApiCache[id] = new RadarrApi(
          {
            url: `${setting.url}/api/v3/`,
            apiKey: `${setting.apiKey}`,
            cacheName: cacheKey,
          },
          this.loggerFactory.createLogger(),
        )
      }

      return this.radarrApiCache[id]
    }
  }

  public async getMediaLinks({
    type,
    tmdbId,
    tvdbId,
  }: {
    type: 'movie' | 'show'
    tmdbId?: number
    tvdbId?: number
  }): Promise<ServarrMediaLink[]> {
    if (type === 'movie') {
      if (!tmdbId) return []
      const settings = await this.settings.getRadarrSettings()
      if (!Array.isArray(settings)) return []

      const links = await Promise.all(
        settings.map(async (setting) => {
          try {
            const client = await this.getRadarrApiClient(setting.id)
            const movie = (await client.getMovies())?.find(
              (candidate) => candidate.tmdbId === tmdbId,
            )
            if (!movie?.titleSlug || movie.id == null || !setting.url) {
              return undefined
            }
            return {
              service: 'radarr' as const,
              instanceName: setting.serverName,
              itemId: movie.id,
              href: buildServarrItemUrl(
                setting.externalUrl || setting.url,
                'movie',
                movie.titleSlug,
              ),
            }
          } catch {
            return undefined
          }
        }),
      )

      return links.filter(
        (link): link is NonNullable<typeof link> => link !== undefined,
      )
    }

    if (!tvdbId) return []
    const settings = await this.settings.getSonarrSettings()
    if (!Array.isArray(settings)) return []

    const links = await Promise.all(
      settings.map(async (setting) => {
        try {
          const client = await this.getSonarrApiClient(setting.id)
          const show = (await client.getSeries())?.find(
            (candidate) => candidate.tvdbId === tvdbId,
          )
          if (!show?.titleSlug || show.id == null || !setting.url) {
            return undefined
          }
          return {
            service: 'sonarr' as const,
            instanceName: setting.serverName,
            itemId: show.id,
            href: buildServarrItemUrl(
              setting.externalUrl || setting.url,
              'series',
              show.titleSlug,
            ),
          }
        } catch {
          return undefined
        }
      }),
    )

    return links.filter(
      (link): link is NonNullable<typeof link> => link !== undefined,
    )
  }

  public deleteCachedRadarrApiClient(id: number) {
    if (this.radarrApiCache[id]) {
      delete this.radarrApiCache[id]
    }
  }

  public deleteCachedSonarrApiClient(id: number) {
    if (this.sonarrApiCache[id]) {
      delete this.sonarrApiCache[id]
    }
  }
}
