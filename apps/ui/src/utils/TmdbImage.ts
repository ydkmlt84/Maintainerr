import { API_BASE_PATH } from './ApiHandler'

export type TmdbImageScope = 'library' | 'discover'
export type TmdbImageVariant = 'poster' | 'backdrop'
export type TmdbImageType = 'movie' | 'show'

export const getTmdbImageUrl = ({
  scope,
  variant,
  type,
  tmdbId,
  imagePath,
}: {
  scope: TmdbImageScope
  variant: TmdbImageVariant
  type: TmdbImageType
  tmdbId: number | string
  imagePath?: string
}) => {
  const query = imagePath
    ? `?path=${encodeURIComponent(imagePath.startsWith('/') ? imagePath : `/${imagePath}`)}`
    : ''
  return `${API_BASE_PATH}/api/moviedb/cached-image/${scope}/${variant}/${type}/${tmdbId}${query}`
}

export const getTmdbActorImageUrl = (personId: number, profilePath?: string) =>
  profilePath
    ? `${API_BASE_PATH}/api/moviedb/profile-image/${personId}?path=${encodeURIComponent(profilePath)}`
    : undefined
