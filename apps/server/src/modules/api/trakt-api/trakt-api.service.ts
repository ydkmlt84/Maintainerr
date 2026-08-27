import {
  TraktApplicationConfig,
  TraktDeviceAuthStatus,
  TraktDeviceCode,
  TraktDiscoverItem,
  TraktDiscoverResponse,
  TraktIds,
  TraktHistoryMutation,
  TraktMediaType,
  TraktServarrStatus,
  TraktStatus,
  TraktWatchlistMutation,
} from '@maintainerr/contracts'
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import axios, { AxiosError, AxiosInstance } from 'axios'
import { SettingsService } from '../../settings/settings.service'
import { MaintainerrLogger } from '../../logging/logs.service'
import { MediaServerFactory } from '../media-server/media-server.factory'
import { ServarrService } from '../servarr-api/servarr.service'

interface TraktMediaObject {
  title: string
  year?: number
  overview?: string
  runtime?: number
  certification?: string
  genres?: string[]
  rating?: number
  votes?: number
  ids: TraktIds
}

interface TraktTrendingResult {
  watchers: number
  movie?: TraktMediaObject
  show?: TraktMediaObject
}

interface TraktWatchlistResult {
  movie?: TraktMediaObject
  show?: TraktMediaObject
}

interface TraktWatchedShowResult {
  show: TraktMediaObject & { aired_episodes?: number }
  seasons?: {
    number: number
    episodes?: { number: number; plays?: number }[]
  }[]
}

interface TraktTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  created_at?: number
}

interface TraktUserSettingsResponse {
  user?: { username?: string }
}

interface TraktSyncResponse {
  added?: { movies?: number; shows?: number; episodes?: number }
  deleted?: { movies?: number; shows?: number }
}

@Injectable()
export class TraktApiService {
  private readonly api: AxiosInstance
  private readonly auth: AxiosInstance
  private refreshPromise?: Promise<string>

  constructor(
    private readonly settings: SettingsService,
    private readonly mediaServerFactory: MediaServerFactory,
    private readonly servarr: ServarrService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(TraktApiService.name)
    this.api = axios.create({
      baseURL: 'https://api.trakt.tv',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    this.auth = axios.create({
      baseURL: 'https://auth.trakt.tv',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  public getStatus(): TraktStatus {
    return {
      configured: this.isConfigured(),
      connected: this.isConnected(),
      clientId: this.settings.trakt_client_id || undefined,
      clientSecretConfigured: Boolean(this.settings.trakt_client_secret),
      username: this.settings.trakt_username || undefined,
    }
  }

  public async configure(config: TraktApplicationConfig): Promise<TraktStatus> {
    const clientId = config.clientId?.trim()
    const clientSecret = config.clientSecret?.trim()
    if (!clientId) throw new BadRequestException('Trakt client ID is required')
    if (!clientSecret && !this.settings.trakt_client_secret) {
      throw new BadRequestException('Trakt client secret is required')
    }

    await this.settings.saveTraktConfiguration(clientId, clientSecret)
    return this.getStatus()
  }

  public async removeConfiguration(): Promise<void> {
    await this.settings.removeTraktConfiguration()
  }

  public async disconnect(): Promise<TraktStatus> {
    await this.settings.disconnectTrakt()
    return this.getStatus()
  }

  public async startDeviceAuth(): Promise<TraktDeviceCode> {
    this.assertConfigured()
    const response = await this.api.post<{
      device_code: string
      user_code: string
      verification_url: string
      expires_in: number
      interval: number
    }>('/oauth/device/code', { client_id: this.settings.trakt_client_id })

    return {
      deviceCode: response.data.device_code,
      userCode: response.data.user_code,
      verificationUrl: response.data.verification_url,
      expiresIn: response.data.expires_in,
      interval: response.data.interval,
    }
  }

  public async pollDeviceAuth(
    deviceCode: string,
  ): Promise<TraktDeviceAuthStatus> {
    this.assertConfigured()
    if (!deviceCode?.trim()) {
      throw new BadRequestException('Device code is required')
    }

    try {
      const response = await this.api.post<TraktTokenResponse>(
        '/oauth/device/token',
        {
          code: deviceCode,
          client_id: this.settings.trakt_client_id,
          client_secret: this.settings.trakt_client_secret,
        },
      )
      await this.persistTokens(response.data)
      const username = await this.loadConnectedUsername()
      return { status: 'connected', username }
    } catch (error) {
      const status = (error as AxiosError).response?.status
      if (status === 400 || status === 429) return { status: 'pending' }
      if (status === 410) return { status: 'expired' }
      if (status === 418) return { status: 'denied' }
      this.logger.warn(`Trakt device authorization failed: ${error}`)
      throw new ServiceUnavailableException(
        'Could not complete Trakt authorization',
      )
    }
  }

  public async getDiscover(): Promise<TraktDiscoverResponse> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        connected: false,
        sections: this.emptySections(),
      }
    }

    try {
      const [
        trendingMovies,
        popularMovies,
        trendingShows,
        popularShows,
        libraryIds,
        watchlistIds,
        watchedIds,
        servarrByItem,
      ] = await Promise.all([
        this.getTrending('movie'),
        this.getPopular('movie'),
        this.getTrending('show'),
        this.getPopular('show'),
        this.getLibraryIds(),
        this.isConnected()
          ? this.getWatchlistIds()
          : Promise.resolve(new Set()),
        this.isConnected() ? this.getWatchedIds() : Promise.resolve(new Set()),
        this.getServarrStatuses(),
      ])

      const available = (items: TraktDiscoverItem[]) =>
        items.filter((item) => !this.matchesLibrary(item, libraryIds))
      const movieTrending = available(trendingMovies)
      const showTrending = available(trendingShows)
      const movieTrendingIds = new Set(
        movieTrending
          .slice(0, 16)
          .map((item) => this.itemKey(item.type, item.ids.trakt)),
      )
      const showTrendingIds = new Set(
        showTrending
          .slice(0, 16)
          .map((item) => this.itemKey(item.type, item.ids.trakt)),
      )
      const markWatchlist = (items: TraktDiscoverItem[]) =>
        items.slice(0, 16).map((item) => ({
          ...item,
          watchlisted: watchlistIds.has(
            this.itemKey(item.type, item.ids.trakt),
          ),
          watched: watchedIds.has(this.itemKey(item.type, item.ids.trakt)),
          servarr: this.getItemServarrStatuses(item, servarrByItem),
        }))

      return {
        configured: true,
        connected: this.isConnected(),
        username: this.settings.trakt_username || undefined,
        sections: {
          trendingMovies: markWatchlist(movieTrending),
          popularMovies: markWatchlist(
            available(popularMovies).filter(
              (item) =>
                !movieTrendingIds.has(this.itemKey(item.type, item.ids.trakt)),
            ),
          ),
          trendingShows: markWatchlist(showTrending),
          popularShows: markWatchlist(
            available(popularShows).filter(
              (item) =>
                !showTrendingIds.has(this.itemKey(item.type, item.ids.trakt)),
            ),
          ),
        },
      }
    } catch (error) {
      this.logger.warn(`Failed to load Trakt discovery: ${error}`)
      throw new ServiceUnavailableException('Could not load Trakt discovery')
    }
  }

  public async addToWatchlist(item: TraktWatchlistMutation): Promise<void> {
    await this.mutateWatchlist(item, false)
  }

  public async removeFromWatchlist(
    item: TraktWatchlistMutation,
  ): Promise<void> {
    await this.mutateWatchlist(item, true)
  }

  public async markWatched(item: TraktHistoryMutation): Promise<void> {
    this.assertValidMediaMutation(item)
    const token = await this.getAccessToken()
    const key = item.type === 'movie' ? 'movies' : 'shows'
    const response = await this.api.post<TraktSyncResponse>(
      '/sync/history',
      {
        [key]: [
          {
            watched_at: new Date().toISOString(),
            ids: { trakt: item.traktId },
          },
        ],
      },
      { headers: this.apiHeaders(token) },
    )
    const added =
      item.type === 'movie'
        ? response.data.added?.movies
        : (response.data.added?.episodes ?? response.data.added?.shows)
    if (!added) {
      throw new ServiceUnavailableException(
        `Trakt did not mark the ${item.type === 'movie' ? 'movie' : 'show'} as watched`,
      )
    }
  }

  private async mutateWatchlist(
    item: TraktWatchlistMutation,
    remove: boolean,
  ): Promise<void> {
    this.assertValidMediaMutation(item)
    const token = await this.getAccessToken()
    const key = item.type === 'movie' ? 'movies' : 'shows'
    const response = await this.api.post<TraktSyncResponse>(
      remove ? '/sync/watchlist/remove' : '/sync/watchlist',
      { [key]: [{ ids: { trakt: item.traktId } }] },
      { headers: this.apiHeaders(token) },
    )
    const changed = remove
      ? response.data.deleted?.[key]
      : response.data.added?.[key]
    if (!changed) {
      throw new ServiceUnavailableException(
        `Trakt did not ${remove ? 'remove' : 'add'} the watchlist item`,
      )
    }
  }

  private async getTrending(
    type: TraktMediaType,
  ): Promise<TraktDiscoverItem[]> {
    const plural = type === 'movie' ? 'movies' : 'shows'
    const response = await this.api.get<TraktTrendingResult[]>(
      `/${plural}/trending`,
      {
        params: { extended: 'full', limit: 40 },
        headers: this.apiHeaders(),
      },
    )
    return response.data
      .map((entry) => {
        const media = type === 'movie' ? entry.movie : entry.show
        return media
          ? this.normalizeItem(type, media, entry.watchers)
          : undefined
      })
      .filter((item): item is TraktDiscoverItem => Boolean(item))
  }

  private async getPopular(type: TraktMediaType): Promise<TraktDiscoverItem[]> {
    const plural = type === 'movie' ? 'movies' : 'shows'
    const response = await this.api.get<TraktMediaObject[]>(
      `/${plural}/popular`,
      {
        params: { extended: 'full', limit: 40 },
        headers: this.apiHeaders(),
      },
    )
    return response.data.map((media) => this.normalizeItem(type, media))
  }

  private normalizeItem(
    type: TraktMediaType,
    media: TraktMediaObject,
    watchers?: number,
  ): TraktDiscoverItem {
    return {
      type,
      title: media.title,
      year: media.year,
      overview: media.overview,
      runtime: media.runtime,
      certification: media.certification,
      genres: media.genres,
      rating: media.rating,
      votes: media.votes,
      watchers,
      ids: media.ids,
      watchlisted: false,
      watched: false,
      servarr: [],
    }
  }

  private async getServarrStatuses(): Promise<
    Map<string, TraktServarrStatus[]>
  > {
    const statuses = new Map<string, TraktServarrStatus[]>()
    const add = (key: string, status: TraktServarrStatus) =>
      statuses.set(key, [...(statuses.get(key) ?? []), status])
    const [radarrSettings, sonarrSettings] = await Promise.all([
      this.settings.getRadarrSettings(),
      this.settings.getSonarrSettings(),
    ])

    await Promise.all([
      ...(Array.isArray(radarrSettings)
        ? radarrSettings.map(async (setting) => {
            try {
              const client = await this.servarr.getRadarrApiClient(setting.id)
              const [movies, queue] = await Promise.all([
                client.getMovies(),
                client.getQueue(),
              ])
              for (const movie of movies ?? []) {
                const queued = (queue ?? []).find(
                  (item) => item.movieId === movie.id,
                )
                const state: TraktServarrStatus['state'] = queued
                  ? 'downloading'
                  : movie.hasFile
                    ? 'downloaded'
                    : !movie.monitored
                      ? 'unmonitored'
                      : !movie.isAvailable
                        ? 'awaiting'
                        : 'missing'
                add(`movie:tmdb:${movie.tmdbId}`, {
                  service: 'radarr',
                  instanceName: setting.serverName,
                  monitored: movie.monitored,
                  state,
                  status:
                    state === 'downloading'
                      ? 'Downloading'
                      : state === 'downloaded'
                        ? 'Downloaded'
                        : state === 'unmonitored'
                          ? 'Unmonitored'
                          : state === 'awaiting'
                            ? 'Awaiting release'
                            : 'Missing, monitored',
                  detail: queued
                    ? this.getQueueProgress(queued.size, queued.sizeleft)
                    : movie.hasFile
                      ? movie.movieFile?.quality?.quality?.name
                      : undefined,
                })
              }
            } catch (error) {
              this.logger.warn(
                `Could not load Radarr discovery status from ${setting.serverName}: ${error}`,
              )
            }
          })
        : []),
      ...(Array.isArray(sonarrSettings)
        ? sonarrSettings.map(async (setting) => {
            try {
              const client = await this.servarr.getSonarrApiClient(setting.id)
              const [series, queue] = await Promise.all([
                client.getSeries(),
                client.getQueue(),
              ])
              for (const show of series ?? []) {
                const files = show.statistics?.episodeFileCount ?? 0
                const episodes = show.statistics?.episodeCount ?? 0
                const queued = (queue ?? []).filter(
                  (item) => item.seriesId === show.id,
                )
                const state: TraktServarrStatus['state'] =
                  queued.length > 0
                    ? 'downloading'
                    : episodes > 0 && files >= episodes
                      ? 'downloaded'
                      : files > 0
                        ? 'partial'
                        : !show.monitored
                          ? 'unmonitored'
                          : show.status === 'upcoming' || episodes === 0
                            ? 'awaiting'
                            : 'missing'
                add(`show:tvdb:${show.tvdbId}`, {
                  service: 'sonarr',
                  instanceName: setting.serverName,
                  monitored: show.monitored,
                  state,
                  status:
                    state === 'downloading'
                      ? 'Downloading'
                      : state === 'downloaded'
                        ? 'Downloaded'
                        : state === 'partial'
                          ? 'Partially downloaded'
                          : state === 'unmonitored'
                            ? 'Unmonitored'
                            : state === 'awaiting'
                              ? 'Awaiting episodes'
                              : 'Missing, monitored',
                  detail:
                    queued.length > 0
                      ? `${queued.length.toLocaleString()} episode${queued.length === 1 ? '' : 's'} in queue`
                      : episodes > 0
                        ? `${files.toLocaleString()}/${episodes.toLocaleString()} episodes`
                        : show.status
                          ? `Series ${show.status}`
                          : undefined,
                })
              }
            } catch (error) {
              this.logger.warn(
                `Could not load Sonarr discovery status from ${setting.serverName}: ${error}`,
              )
            }
          })
        : []),
    ])

    return statuses
  }

  private getItemServarrStatuses(
    item: TraktDiscoverItem,
    statuses: Map<string, TraktServarrStatus[]>,
  ): TraktServarrStatus[] {
    const key =
      item.type === 'movie' && item.ids.tmdb
        ? `movie:tmdb:${item.ids.tmdb}`
        : item.type === 'show' && item.ids.tvdb
          ? `show:tvdb:${item.ids.tvdb}`
          : undefined
    return key ? (statuses.get(key) ?? []) : []
  }

  private getQueueProgress(size: number, sizeLeft: number): string | undefined {
    if (!size || !Number.isFinite(size) || !Number.isFinite(sizeLeft)) {
      return undefined
    }
    const percent = Math.max(0, Math.min(100, ((size - sizeLeft) / size) * 100))
    return `${Math.round(percent)}% complete`
  }

  private async getWatchlistIds(): Promise<Set<string>> {
    const token = await this.getAccessToken()
    const [movies, shows] = await Promise.all([
      this.api.get<TraktWatchlistResult[]>('/sync/watchlist/movies', {
        params: { limit: 1000 },
        headers: this.apiHeaders(token),
      }),
      this.api.get<TraktWatchlistResult[]>('/sync/watchlist/shows', {
        params: { limit: 1000 },
        headers: this.apiHeaders(token),
      }),
    ])
    return new Set([
      ...movies.data
        .filter((entry) => entry.movie)
        .map((entry) => this.itemKey('movie', entry.movie.ids.trakt)),
      ...shows.data
        .filter((entry) => entry.show)
        .map((entry) => this.itemKey('show', entry.show.ids.trakt)),
    ])
  }

  private async getWatchedIds(): Promise<Set<string>> {
    const token = await this.getAccessToken()
    const [movies, fullyWatchedShows] = await Promise.all([
      this.api.get<Record<string, string[]>>('/sync/watched/movies', {
        params: { extended: 'min' },
        headers: this.apiHeaders(token),
      }),
      this.getFullyWatchedShowIds(token),
    ])
    return new Set([
      ...Object.keys(movies.data).map((id) =>
        this.itemKey('movie', Number(id)),
      ),
      ...fullyWatchedShows.map((id) => this.itemKey('show', id)),
    ])
  }

  private async getFullyWatchedShowIds(token: string): Promise<number[]> {
    const watchedShows: TraktWatchedShowResult[] = []
    let page = 1
    let pageCount: number | undefined

    do {
      const response = await this.api.get<TraktWatchedShowResult[]>(
        '/sync/watched/shows',
        {
          params: { extended: 'progress', page, limit: 100 },
          headers: this.apiHeaders(token),
        },
      )
      watchedShows.push(...response.data)
      const headerPageCount = Number(
        response.headers?.['x-pagination-page-count'],
      )
      pageCount = Number.isFinite(headerPageCount) ? headerPageCount : undefined
      if (response.data.length === 0) break
      page++
    } while (pageCount === undefined || page <= pageCount)

    return watchedShows
      .filter((entry) => {
        const airedEpisodes = entry.show.aired_episodes ?? 0
        if (!airedEpisodes) return false
        const watchedEpisodes = (entry.seasons ?? [])
          .filter((season) => season.number !== 0)
          .reduce(
            (total, season) =>
              total +
              (season.episodes ?? []).filter((episode) =>
                Boolean(episode.plays),
              ).length,
            0,
          )
        return watchedEpisodes >= airedEpisodes
      })
      .map((entry) => entry.show.ids.trakt)
  }

  private async getLibraryIds(): Promise<Set<string>> {
    const mediaServer = await this.mediaServerFactory.getService()
    const libraries = await mediaServer.getLibraries()
    const pages = await Promise.all(
      libraries.map(async (library) => {
        const items = []
        let offset = 0
        let total = 0
        do {
          const page = await mediaServer.getLibraryContents(library.id, {
            offset,
            limit: 500,
            type: library.type,
          })
          items.push(...page.items)
          total = page.totalSize
          offset += page.items.length
        } while (offset < total && offset > 0)
        return items
      }),
    )

    const ids = new Set<string>()
    pages.flat().forEach((item) => {
      item.providerIds.tmdb?.forEach((id) => ids.add(`tmdb:${id}`))
      item.providerIds.imdb?.forEach((id) => ids.add(`imdb:${id}`))
      item.providerIds.tvdb?.forEach((id) => ids.add(`tvdb:${id}`))
      if (item.year) {
        ids.add(this.titleKey(item.type, item.title, item.year))
      }
    })
    return ids
  }

  private matchesLibrary(
    item: TraktDiscoverItem,
    libraryIds: Set<string>,
  ): boolean {
    const ids = item.ids
    return Boolean(
      (ids.tmdb && libraryIds.has(`tmdb:${ids.tmdb}`)) ||
      (ids.imdb && libraryIds.has(`imdb:${ids.imdb}`)) ||
      (ids.tvdb && libraryIds.has(`tvdb:${ids.tvdb}`)) ||
      (item.year &&
        libraryIds.has(this.titleKey(item.type, item.title, item.year))),
    )
  }

  private titleKey(type: string, title: string, year: number): string {
    return `title:${type}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '')}:${year}`
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isConnected()) {
      throw new UnauthorizedException('Connect a Trakt account first')
    }
    const expiresAt = this.settings.trakt_token_expires_at
      ? new Date(this.settings.trakt_token_expires_at).getTime()
      : 0
    if (expiresAt > Date.now() + 60000 && this.settings.trakt_access_token) {
      return this.settings.trakt_access_token
    }

    if (this.refreshPromise === undefined) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = undefined
      })
    }
    return this.refreshPromise
  }

  private async refreshAccessToken(): Promise<string> {
    try {
      const response = await this.auth.post<TraktTokenResponse>(
        '/oauth/token',
        {
          refresh_token: this.settings.trakt_refresh_token,
          client_id: this.settings.trakt_client_id,
          client_secret: this.settings.trakt_client_secret,
          redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
          grant_type: 'refresh_token',
        },
      )
      await this.persistTokens(response.data)
      return response.data.access_token
    } catch (error) {
      this.logger.warn(`Failed to refresh Trakt access token: ${error}`)
      await this.settings.disconnectTrakt()
      throw new UnauthorizedException('Reconnect the Trakt account')
    }
  }

  private async persistTokens(tokens: TraktTokenResponse): Promise<void> {
    const createdAt = tokens.created_at ? tokens.created_at * 1000 : Date.now()
    await this.settings.saveTraktTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(createdAt + tokens.expires_in * 1000),
    })
  }

  private async loadConnectedUsername(): Promise<string | undefined> {
    try {
      const response = await this.api.get<TraktUserSettingsResponse>(
        '/users/settings',
        { headers: this.apiHeaders(this.settings.trakt_access_token) },
      )
      const username = response.data.user?.username
      if (username) await this.settings.saveTraktUsername(username)
      return username
    } catch (error) {
      this.logger.warn(`Could not load the connected Trakt username: ${error}`)
      return undefined
    }
  }

  private apiHeaders(accessToken?: string): Record<string, string> {
    return {
      'trakt-api-version': '2',
      'trakt-api-key': this.settings.trakt_client_id,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    }
  }

  private itemKey(type: TraktMediaType, traktId: number): string {
    return `${type}:${traktId}`
  }

  private assertValidMediaMutation(item: TraktHistoryMutation): void {
    if (!['movie', 'show'].includes(item.type) || !item.traktId) {
      throw new BadRequestException('A valid Trakt media item is required')
    }
  }

  private isConfigured(): boolean {
    return Boolean(
      this.settings.trakt_client_id && this.settings.trakt_client_secret,
    )
  }

  private isConnected(): boolean {
    return Boolean(
      this.isConfigured() &&
      this.settings.trakt_access_token &&
      this.settings.trakt_refresh_token,
    )
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException('Configure the Trakt service first')
    }
  }

  private emptySections(): TraktDiscoverResponse['sections'] {
    return {
      trendingMovies: [],
      popularMovies: [],
      trendingShows: [],
      popularShows: [],
    }
  }
}
