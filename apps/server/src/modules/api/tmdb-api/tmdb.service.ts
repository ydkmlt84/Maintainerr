import { Injectable } from '@nestjs/common'
import { MaintainerrLogger } from '../../logging/logs.service'
import { ExternalApiService } from '../external-api/external-api.service'
import cacheManager from '../lib/cache'
import {
  TmdbExternalIdResponse,
  TmdbMovieDetails,
  TmdbPersonDetail,
  TmdbTvDetails,
  TmdbTvSeasonDetails,
  TmdbVideo,
} from './interfaces/tmdb.interface'

@Injectable()
export class TmdbApiService extends ExternalApiService {
  constructor(protected readonly logger: MaintainerrLogger) {
    logger.setContext(TmdbApiService.name)
    super(
      'https://api.themoviedb.org/3',
      {
        api_key: 'db55323b8d3e4154498498a75642b381',
      },
      logger,
      {
        nodeCache: cacheManager.getCache('tmdb').data,
      },
    )
  }

  public getPerson = async ({
    personId,
    language = 'en',
  }: {
    personId: number
    language?: string
  }): Promise<TmdbPersonDetail> => {
    try {
      const data = await this.get<TmdbPersonDetail>(`/person/${personId}`, {
        params: { language },
      })

      return data
    } catch (e) {
      this.logger.warn(`Failed to fetch person details: ${e.message}`)
      this.logger.debug(e)
    }
  }

  public getMovie = async ({
    movieId,
    language = 'en',
  }: {
    movieId: number
    language?: string
  }): Promise<TmdbMovieDetails> => {
    try {
      const data = await this.get<TmdbMovieDetails>(
        `/movie/${movieId}`,
        {
          params: {
            language,
            append_to_response:
              'credits,external_ids,videos,release_dates,watch/providers',
          },
        },
        43200,
      )

      return data
    } catch (e) {
      this.logger.warn(`Failed to fetch movie details: ${e.message}`)
      this.logger.debug(e)
    }
  }

  public getTvShow = async ({
    tvId,
    language = 'en',
  }: {
    tvId: number
    language?: string
  }): Promise<TmdbTvDetails> => {
    try {
      const data = await this.get<TmdbTvDetails>(
        `/tv/${tvId}`,
        {
          params: {
            language,
            append_to_response:
              'aggregate_credits,credits,external_ids,keywords,videos,content_ratings,watch/providers',
          },
        },
        43200,
      )

      return data
    } catch (e) {
      this.logger.warn(`Failed to fetch TV show details: ${e.message}`)
      this.logger.debug(e)
    }
  }

  public getTvSeason = async ({
    tvId,
    seasonNumber,
    language = 'en',
  }: {
    tvId: number
    seasonNumber: number
    language?: string
  }): Promise<TmdbTvSeasonDetails> => {
    try {
      return await this.get<TmdbTvSeasonDetails>(
        `/tv/${tvId}/season/${seasonNumber}`,
        {
          params: { language, append_to_response: 'videos' },
        },
        43200,
      )
    } catch (e) {
      this.logger.debug(
        `Failed to fetch TV season ${seasonNumber} details for show ${tvId}: ${e.message}`,
      )
      return undefined
    }
  }

  // TODO: ADD CACHING!!!!
  public getImagePath = async ({
    tmdbId,
    type,
  }: {
    tmdbId: number
    type: 'movie' | 'show'
  }): Promise<string> => {
    try {
      if (type === 'movie') {
        return (await this.getMovie({ movieId: tmdbId }))?.poster_path
      } else {
        return (await this.getTvShow({ tvId: tmdbId }))?.poster_path
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch image path: ${e.message}`)
      this.logger.debug(e)
    }
  }

  public getBackdropImagePath = async ({
    tmdbId,
    type,
  }: {
    tmdbId: number
    type: 'movie' | 'show'
  }): Promise<string> => {
    try {
      if (type === 'movie') {
        return (await this.getMovie({ movieId: tmdbId }))?.backdrop_path
      } else {
        return (await this.getTvShow({ tvId: tmdbId }))?.backdrop_path
      }
    } catch (e) {
      this.logger.warn(`Failed to fetch backdrop image path: ${e.message}`)
      this.logger.debug(e)
    }
  }

  public getMediaAssets = async ({
    tmdbId,
    type,
    seasonNumber,
  }: {
    tmdbId: number
    type: 'movie' | 'show'
    seasonNumber?: number
  }): Promise<{
    backdropPath?: string
    trailerUrl?: string
    cast: {
      id: number
      name: string
      character?: string
      profilePath?: string
    }[]
  }> => {
    const details =
      type === 'movie'
        ? await this.getMovie({ movieId: tmdbId })
        : await this.getTvShow({ tvId: tmdbId })
    const videos = details?.videos?.results ?? []
    const trailers = videos.filter(
      (video) => video.site === 'YouTube' && video.type === 'Trailer',
    )
    const isSeasonSpecific = (video: TmdbVideo) =>
      /\bseason\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b\d+(?:st|nd|rd|th)\s+season\b|\bs\d{1,2}\b/i.test(
        video.name,
      )
    const chooseTrailer = (candidates: TmdbVideo[]) =>
      candidates.find((video) => video.official) ?? candidates[0]
    const cast =
      type === 'movie'
        ? ((details as TmdbMovieDetails | undefined)?.credits?.cast ?? []).map(
            (person) => ({
              id: person.id,
              name: person.name,
              character: person.character,
              profilePath: person.profile_path,
            }),
          )
        : (
            (details as TmdbTvDetails | undefined)?.aggregate_credits?.cast ??
            []
          ).map((person) => ({
            id: person.id,
            name: person.name,
            character: person.roles.find((role) => role.character)?.character,
            profilePath: person.profile_path,
          }))

    let trailer = chooseTrailer(
      trailers.filter((video) => !isSeasonSpecific(video)),
    )
    if (!trailer && type === 'show' && seasonNumber !== undefined) {
      const season = await this.getTvSeason({
        tvId: tmdbId,
        seasonNumber,
      })
      trailer = chooseTrailer(
        (season?.videos?.results ?? []).filter(
          (video) => video.site === 'YouTube' && video.type === 'Trailer',
        ),
      )
    }

    return {
      backdropPath: details?.backdrop_path,
      trailerUrl: trailer
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`
        : undefined,
      cast: cast.slice(0, 10),
    }
  }

  public async getByExternalId({
    externalId,
    type,
    language = 'en',
  }:
    | {
        externalId: string
        type: 'imdb'
        language?: string
      }
    | {
        externalId: number
        type: 'tvdb'
        language?: string
      }): Promise<TmdbExternalIdResponse> {
    try {
      const data = await this.get<TmdbExternalIdResponse>(
        `/find/${externalId}`,
        {
          params: {
            external_source: type === 'imdb' ? 'imdb_id' : 'tvdb_id',
            language,
          },
        },
      )
      return data
    } catch (e) {
      this.logger.warn(`Failed to find by external ID: ${e.message}`)
      this.logger.debug(e)
    }
  }
}
