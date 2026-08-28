import { MediaServerType } from '@maintainerr/contracts'

export class SettingDto {
  id: number

  clientId: string

  applicationTitle: string

  applicationUrl: string

  apikey: string

  locale: string

  // Media server type selection
  media_server_type?: MediaServerType

  // Plex settings
  plex_name: string

  plex_hostname: string

  plex_port: number

  plex_ssl: number

  plex_auth_token: string

  // Jellyfin settings
  jellyfin_url?: string

  jellyfin_api_key?: string

  jellyfin_user_id?: string

  jellyfin_server_name?: string

  // Seerr integration
  seerr_url: string

  seerr_api_key: string

  tautulli_url: string

  tautulli_api_key: string

  trakt_client_id?: string

  trakt_client_secret?: string

  trakt_access_token?: string

  trakt_refresh_token?: string

  trakt_token_expires_at?: Date

  trakt_username?: string

  collection_handler_job_cron: string

  rules_handler_job_cron: string

  media_id_audit_job_cron: string

  plex_trash_empty_job_cron: string

  image_cache_max_gb: number
}
