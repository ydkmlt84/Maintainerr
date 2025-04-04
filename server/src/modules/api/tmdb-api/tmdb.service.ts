import { Logger } from '@nestjs/common';
import { warn } from 'console';
import { sortBy } from 'lodash';
import { ExternalApiService } from '../external-api/external-api.service';
import cacheManager from '../lib/cache';
import {
  DiscoverMovieOptions,
  DiscoverTvOptions,
  SearchOptions,
  TmdbCollection,
  TmdbExternalIdResponse,
  TmdbGenre,
  TmdbGenresResult,
  TmdbLanguage,
  TmdbMovieDetails,
  TmdbNetwork,
  TmdbPersonCombinedCredits,
  TmdbPersonDetail,
  TmdbProductionCompany,
  TmdbRegion,
  TmdbSearchMovieResponse,
  TmdbSearchMultiResponse,
  TmdbSearchTvResponse,
  TmdbSeasonWithEpisodes,
  TmdbTvDetails,
  TmdbUpcomingMoviesResponse,
} from './interfaces/tmdb.interface';

export class TmdbApiService extends ExternalApiService {
  private region?: string;
  private originalLanguage?: string;
  constructor({
    region,
    originalLanguage,
  }: { region?: string; originalLanguage?: string } = {}) {
    super(
      'https://api.themoviedb.org/3',
      {
        api_key: 'db55323b8d3e4154498498a75642b381',
      },
      {
        nodeCache: cacheManager.getCache('tmdb').data,
      },
    );
    this.region = region;
    this.originalLanguage = originalLanguage;
    this.logger = new Logger(TmdbApiService.name);
  }

  public searchMulti = async ({
    query,
    page = 1,
    includeAdult = true,
    language = 'en',
  }: SearchOptions): Promise<TmdbSearchMultiResponse> => {
    try {
      const data = await this.get<TmdbSearchMultiResponse>('/search/multi', {
        params: { query, page, include_adult: includeAdult, language },
      });

      return data;
    } catch (e) {
      this.logger.debug(e);
      return {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };
    }
  };

  public getPerson = async ({
    personId,
    language = 'en',
  }: {
    personId: number;
    language?: string;
  }): Promise<TmdbPersonDetail> => {
    try {
      const data = await this.get<TmdbPersonDetail>(`/person/${personId}`, {
        params: { language },
      });

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch person details: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getPersonCombinedCredits = async ({
    personId,
    language = 'en',
  }: {
    personId: number;
    language?: string;
  }): Promise<TmdbPersonCombinedCredits> => {
    try {
      const data = await this.get<TmdbPersonCombinedCredits>(
        `/person/${personId}/combined_credits`,
        {
          params: { language },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch person combined credits: ${e.message}`);
    }
  };

  public getMovie = async ({
    movieId,
    language = 'en',
  }: {
    movieId: number;
    language?: string;
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
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch movie details: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getTvShow = async ({
    tvId,
    language = 'en',
  }: {
    tvId: number;
    language?: string;
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
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV show details: ${e.message}`);
      this.logger.debug(e);
    }
  };

  // TODO: ADD CACHING!!!!
  public getImagePath = async ({
    tmdbId,
    type,
  }: {
    tmdbId: number;
    type: 'movie' | 'show';
  }): Promise<string> => {
    try {
      if (type === 'movie') {
        return (await this.getMovie({ movieId: tmdbId }))?.poster_path;
      } else {
        return (await this.getTvShow({ tvId: tmdbId }))?.poster_path;
      }
    } catch (e) {
      warn(`[TMDb] Failed to fetch image path: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getBackdropImagePath = async ({
    tmdbId,
    type,
  }: {
    tmdbId: number;
    type: 'movie' | 'show';
  }): Promise<string> => {
    try {
      if (type === 'movie') {
        return (await this.getMovie({ movieId: tmdbId }))?.backdrop_path;
      } else {
        return (await this.getTvShow({ tvId: tmdbId }))?.backdrop_path;
      }
    } catch (e) {
      warn(`[TMDb] Failed to fetch backdrop image path: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getTvSeason = async ({
    tvId,
    seasonNumber,
    language,
  }: {
    tvId: number;
    seasonNumber: number;
    language?: string;
  }): Promise<TmdbSeasonWithEpisodes> => {
    try {
      const data = await this.get<TmdbSeasonWithEpisodes>(
        `/tv/${tvId}/season/${seasonNumber}`,
        {
          params: {
            language,
            append_to_response: 'external_ids',
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV show details: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public async getMovieRecommendations({
    movieId,
    page = 1,
    language = 'en',
  }: {
    movieId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/movie/${movieId}/recommendations`,
        {
          params: {
            page,
            language,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch discover movies: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getMovieSimilar({
    movieId,
    page = 1,
    language = 'en',
  }: {
    movieId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/movie/${movieId}/similar`,
        {
          params: {
            page,
            language,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch discover movies: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getMoviesByKeyword({
    keywordId,
    page = 1,
    language = 'en',
  }: {
    keywordId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchMovieResponse> {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/keyword/${keywordId}/movies`,
        {
          params: {
            page,
            language,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch movies by keyword: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getTvRecommendations({
    tvId,
    page = 1,
    language = 'en',
  }: {
    tvId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchTvResponse> {
    try {
      const data = await this.get<TmdbSearchTvResponse>(
        `/tv/${tvId}/recommendations`,
        {
          params: {
            page,
            language,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV recommendations: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getTvSimilar({
    tvId,
    page = 1,
    language = 'en',
  }: {
    tvId: number;
    page?: number;
    language?: string;
  }): Promise<TmdbSearchTvResponse> {
    try {
      const data = await this.get<TmdbSearchTvResponse>(`/tv/${tvId}/similar`, {
        params: {
          page,
          language,
        },
      });

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV similar: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public getDiscoverMovies = async ({
    sortBy = 'popularity.desc',
    page = 1,
    includeAdult = true,
    language = 'en',
    primaryReleaseDateGte,
    primaryReleaseDateLte,
    originalLanguage,
    genre,
    studio,
  }: DiscoverMovieOptions = {}): Promise<TmdbSearchMovieResponse> => {
    try {
      const data = await this.get<TmdbSearchMovieResponse>('/discover/movie', {
        params: {
          sort_by: sortBy,
          page,
          include_adult: includeAdult,
          language,
          region: this.region,
          with_original_language: originalLanguage ?? this.originalLanguage,
          'primary_release_date.gte': primaryReleaseDateGte,
          'primary_release_date.lte': primaryReleaseDateLte,
          with_genres: genre,
          with_companies: studio,
        },
      });

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch discover movies: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getDiscoverTv = async ({
    sortBy = 'popularity.desc',
    page = 1,
    language = 'en',
    firstAirDateGte,
    firstAirDateLte,
    includeEmptyReleaseDate = false,
    originalLanguage,
    genre,
    network,
  }: DiscoverTvOptions = {}): Promise<TmdbSearchTvResponse> => {
    try {
      const data = await this.get<TmdbSearchTvResponse>('/discover/tv', {
        params: {
          sort_by: sortBy,
          page,
          language,
          region: this.region,
          'first_air_date.gte': firstAirDateGte,
          'first_air_date.lte': firstAirDateLte,
          with_original_language: originalLanguage ?? this.originalLanguage,
          include_null_first_air_dates: includeEmptyReleaseDate,
          with_genres: genre,
          with_networks: network,
        },
      });

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch discover TV: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getUpcomingMovies = async ({
    page = 1,
    language = 'en',
  }: {
    page: number;
    language: string;
  }): Promise<TmdbUpcomingMoviesResponse> => {
    try {
      const data = await this.get<TmdbUpcomingMoviesResponse>(
        '/movie/upcoming',
        {
          params: {
            page,
            language,
            region: this.region,
            originalLanguage: this.originalLanguage,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch upcoming movies: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getAllTrending = async ({
    page = 1,
    timeWindow = 'day',
    language = 'en',
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
    language?: string;
  } = {}): Promise<TmdbSearchMultiResponse> => {
    try {
      const data = await this.get<TmdbSearchMultiResponse>(
        `/trending/all/${timeWindow}`,
        {
          params: {
            page,
            language,
            region: this.region,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch all trending: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getMovieTrending = async ({
    page = 1,
    timeWindow = 'day',
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
  } = {}): Promise<TmdbSearchMovieResponse> => {
    try {
      const data = await this.get<TmdbSearchMovieResponse>(
        `/trending/movie/${timeWindow}`,
        {
          params: {
            page,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch all trending: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public getTvTrending = async ({
    page = 1,
    timeWindow = 'day',
  }: {
    page?: number;
    timeWindow?: 'day' | 'week';
  } = {}): Promise<TmdbSearchTvResponse> => {
    try {
      const data = await this.get<TmdbSearchTvResponse>(
        `/trending/tv/${timeWindow}`,
        {
          params: {
            page,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch all trending: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public async getByExternalId({
    externalId,
    type,
    language = 'en',
  }:
    | {
        externalId: string;
        type: 'imdb';
        language?: string;
      }
    | {
        externalId: number;
        type: 'tvdb';
        language?: string;
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
      );
      return data;
    } catch (e) {
      warn(`[TMDb] Failed to find by external ID: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getMovieByImdbId({
    imdbId,
    language = 'en',
  }: {
    imdbId: string;
    language?: string;
  }): Promise<TmdbMovieDetails> {
    try {
      const extResponse = await this.getByExternalId({
        externalId: imdbId,
        type: 'imdb',
      });

      if (extResponse.movie_results[0]) {
        const movie = await this.getMovie({
          movieId: extResponse.movie_results[0].id,
          language,
        });

        return movie;
      }

      warn('[TMDb] Failed to find a title with the provided IMDB id');
    } catch (e) {
      warn(`[TMDb] Failed to get movie by external imdb ID: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getShowByTvdbId({
    tvdbId,
    language = 'en',
  }: {
    tvdbId: number;
    language?: string;
  }): Promise<TmdbTvDetails> {
    try {
      const extResponse = await this.getByExternalId({
        externalId: tvdbId,
        type: 'tvdb',
      });

      if (extResponse.tv_results[0]) {
        const tvshow = await this.getTvShow({
          tvId: extResponse.tv_results[0].id,
          language,
        });

        return tvshow;
      }

      warn(`No show returned from API for ID ${tvdbId}`);
    } catch (e) {
      warn(
        `[TMDb] Failed to get TV show using the external TVDB ID: ${e.message}`,
      );
      this.logger.debug(e);
    }
  }

  public async getCollection({
    collectionId,
    language = 'en',
  }: {
    collectionId: number;
    language?: string;
  }): Promise<TmdbCollection> {
    try {
      const data = await this.get<TmdbCollection>(
        `/collection/${collectionId}`,
        {
          params: {
            language,
          },
        },
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch collection: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getRegions(): Promise<TmdbRegion[]> {
    try {
      const data = await this.get<TmdbRegion[]>(
        '/configuration/countries',
        {},
        86400, // 24 hours
      );

      const regions = sortBy(data, 'english_name');

      return regions;
    } catch (e) {
      warn(`[TMDb] Failed to fetch countries: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getLanguages(): Promise<TmdbLanguage[]> {
    try {
      const data = await this.get<TmdbLanguage[]>(
        '/configuration/languages',
        {},
        86400, // 24 hours
      );

      const languages = sortBy(data, 'english_name');

      return languages;
    } catch (e) {
      warn(`[TMDb] Failed to fetch langauges: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getStudio(studioId: number): Promise<TmdbProductionCompany> {
    try {
      const data = await this.get<TmdbProductionCompany>(
        `/company/${studioId}`,
      );

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch movie studio: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getNetwork(networkId: number): Promise<TmdbNetwork> {
    try {
      const data = await this.get<TmdbNetwork>(`/network/${networkId}`);

      return data;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV network: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getMovieGenres({
    language = 'en',
  }: {
    language?: string;
  } = {}): Promise<TmdbGenre[]> {
    try {
      const data = await this.get<TmdbGenresResult>(
        '/genre/movie/list',
        {
          params: {
            language,
          },
        },
        86400, // 24 hours
      );

      if (
        !language.startsWith('en') &&
        data.genres.some((genre) => !genre.name)
      ) {
        const englishData = await this.get<TmdbGenresResult>(
          '/genre/movie/list',
          {
            params: {
              language: 'en',
            },
          },
          86400, // 24 hours
        );

        data.genres
          .filter((genre) => !genre.name)
          .forEach((genre) => {
            genre.name =
              englishData.genres.find(
                (englishGenre) => englishGenre.id === genre.id,
              )?.name ?? '';
          });
      }

      const movieGenres = sortBy(
        data.genres.filter((genre) => genre.name),
        'name',
      );

      return movieGenres;
    } catch (e) {
      warn(`[TMDb] Failed to fetch movie genres: ${e.message}`);
      this.logger.debug(e);
    }
  }

  public async getTvGenres({
    language = 'en',
  }: {
    language?: string;
  } = {}): Promise<TmdbGenre[]> {
    try {
      const data = await this.get<TmdbGenresResult>(
        '/genre/tv/list',
        {
          params: {
            language,
          },
        },
        86400, // 24 hours
      );

      if (
        !language.startsWith('en') &&
        data.genres.some((genre) => !genre.name)
      ) {
        const englishData = await this.get<TmdbGenresResult>(
          '/genre/tv/list',
          {
            params: {
              language: 'en',
            },
          },
          86400, // 24 hours
        );

        data.genres
          .filter((genre) => !genre.name)
          .forEach((genre) => {
            genre.name =
              englishData.genres.find(
                (englishGenre) => englishGenre.id === genre.id,
              )?.name ?? '';
          });
      }

      const tvGenres = sortBy(
        data.genres.filter((genre) => genre.name),
        'name',
      );

      return tvGenres;
    } catch (e) {
      warn(`[TMDb] Failed to fetch TV genres: ${e.message}`);
      this.logger.debug(e);
    }
  }
}
