export type TraktMediaType = 'movie' | 'show'

export interface TraktIds {
  trakt: number
  slug?: string
  imdb?: string
  tmdb?: number
  tvdb?: number
}

export interface TraktDiscoverItem {
  type: TraktMediaType
  title: string
  year?: number
  overview?: string
  runtime?: number
  certification?: string
  genres?: string[]
  rating?: number
  votes?: number
  watchers?: number
  ids: TraktIds
  watchlisted: boolean
  watched: boolean
  servarr: TraktServarrStatus[]
}

export interface TraktServarrStatus {
  service: 'radarr' | 'sonarr'
  instanceName: string
  href?: string
  monitored: boolean
  state:
    | 'downloaded'
    | 'downloading'
    | 'partial'
    | 'missing'
    | 'awaiting'
    | 'unmonitored'
  status: string
  detail?: string
}

export interface TraktDiscoverResponse {
  configured: boolean
  connected: boolean
  username?: string
  sections: {
    trendingMovies: TraktDiscoverItem[]
    popularMovies: TraktDiscoverItem[]
    trendingShows: TraktDiscoverItem[]
    popularShows: TraktDiscoverItem[]
  }
}

export interface TraktStatus {
  configured: boolean
  connected: boolean
  clientId?: string
  clientSecretConfigured: boolean
  username?: string
}

export interface TraktApplicationConfig {
  clientId: string
  clientSecret?: string
}

export interface TraktDeviceCode {
  deviceCode: string
  userCode: string
  verificationUrl: string
  expiresIn: number
  interval: number
}

export interface TraktDeviceAuthStatus {
  status: 'pending' | 'connected' | 'expired' | 'denied'
  username?: string
}

export interface TraktWatchlistMutation {
  type: TraktMediaType
  traktId: number
}

export interface TraktHistoryMutation {
  type: TraktMediaType
  traktId: number
}
