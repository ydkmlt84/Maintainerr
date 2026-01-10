import { Injectable } from '@nestjs/common';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MaintainerrLogger } from '../../logging/logs.service';
import { SettingsService } from '../../settings/settings.service';
import { ExternalApiService } from '../external-api/external-api.service';
import cacheManager from '../lib/cache';
import {
  TmdbExternalIdResponse,
  TmdbMovieDetails,
  TmdbPersonDetail,
  TmdbTvDetails,
} from './interfaces/tmdb.interface';

@Injectable()
export class TmdbApiService extends ExternalApiService {
  private readonly cacheRoot: string;
  private readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 days

  constructor(
    protected readonly logger: MaintainerrLogger,
    private readonly settingsService: SettingsService,
  ) {
    logger.setContext(TmdbApiService.name);
    super(
      'https://api.themoviedb.org/3',
      {
        api_key: 'db55323b8d3e4154498498a75642b381',
      },
      logger,
      {
        nodeCache: cacheManager.getCache('tmdb').data,
      },
    );

    const baseCacheDir =
      process.env.IMAGE_CACHE_DIR ||
      (process.env.NODE_ENV === 'production'
        ? '/opt/data/cache/tmdb'
        : path.resolve(process.cwd(), '../../data/cache/tmdb'));
    this.cacheRoot = baseCacheDir;
    this.ensureCacheDir();
  }

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
      this.logger.warn(`Failed to fetch person details: ${e.message}`);
      this.logger.debug(e);
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
      this.logger.warn(`Failed to fetch movie details: ${e.message}`);
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
      this.logger.warn(`Failed to fetch TV show details: ${e.message}`);
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
      this.logger.warn(`Failed to fetch image path: ${e.message}`);
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
      this.logger.warn(`Failed to fetch backdrop image path: ${e.message}`);
      this.logger.debug(e);
    }
  };

  public async getCachedImage({
    tmdbId,
    type,
    size = 'w342',
    variant = 'poster',
  }: {
    tmdbId: number;
    type: 'movie' | 'show';
    size?: string;
    variant?: 'poster' | 'backdrop';
  }): Promise<{ filePath?: string; remoteUrl?: string }> {
    const cacheConfig = await this.getCacheConfig();

    const pathResolver =
      variant === 'backdrop' ? this.getBackdropImagePath : this.getImagePath;
    const imagePath = await pathResolver({ tmdbId, type });
    if (!imagePath) return {};

    const ext = path.extname(imagePath) || '.jpg';
    const filename = `${type}-${tmdbId}-${variant}-${size}${ext}`;
    const filePath = path.join(this.cacheRoot, filename);

    const fileFresh = this.isFileFresh(filePath);
    const remoteUrl = `https://image.tmdb.org/t/p/${size}${imagePath}`;
    if (!cacheConfig.enabled) {
      return { remoteUrl };
    }

    if (fileFresh) return { filePath };

    try {
      const response = await axios.get<ArrayBuffer>(remoteUrl, {
        responseType: 'arraybuffer',
      });
      fs.writeFileSync(filePath, Buffer.from(response.data));
      this.enforceCacheLimit(cacheConfig.maxBytes).catch((e) =>
        this.logger.debug(`Failed cache cleanup: ${e.message}`),
      );
      return { filePath };
    } catch (e) {
      this.logger.warn(
        `Failed to fetch image for tmdb ${tmdbId} (${variant}): ${e.message}`,
      );
      this.logger.debug(e);
      return fileFresh ? { filePath } : { remoteUrl };
    }
  }

  public async clearCache(): Promise<{ deleted: number }> {
    let deleted = 0;
    try {
      if (fs.existsSync(this.cacheRoot)) {
        const files = fs.readdirSync(this.cacheRoot);
        deleted = files.length;
        fs.rmSync(this.cacheRoot, { recursive: true, force: true });
      }
      this.ensureCacheDir();
      cacheManager.getCache('tmdb').data.flushAll();
    } catch (e) {
      this.logger.warn(`Failed to clear TMDB cache: ${e.message}`);
      this.logger.debug(e);
      throw e;
    }
    return { deleted };
  }

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
      this.logger.warn(`Failed to find by external ID: ${e.message}`);
      this.logger.debug(e);
    }
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheRoot)) {
      fs.mkdirSync(this.cacheRoot, { recursive: true });
    }
  }

  private isFileFresh(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtimeMs;
      return age < this.cacheTtlMs;
    } catch (e) {
      return false;
    }
  }

  private async enforceCacheLimit(maxBytes: number) {
    try {
      const files = fs.readdirSync(this.cacheRoot).map((name) => {
        const fullPath = path.join(this.cacheRoot, name);
        const stats = fs.statSync(fullPath);
        return { fullPath, size: stats.size, mtime: stats.mtimeMs };
      });

      let total = files.reduce((sum, f) => sum + f.size, 0);
      if (total <= maxBytes) return;

      const sorted = files.sort((a, b) => a.mtime - b.mtime); // oldest first
      for (const file of sorted) {
        fs.unlinkSync(file.fullPath);
        total -= file.size;
        if (total <= maxBytes * 0.9) break;
      }
    } catch (e) {
      this.logger.debug(`Failed to enforce TMDB cache limit: ${e.message}`);
    }
  }

  private async getCacheConfig(): Promise<{
    enabled: boolean;
    maxBytes: number;
  }> {
    try {
      const settings = await this.settingsService.getSettings();
      const enabled =
        (settings as any)?.image_cache_enabled !== undefined
          ? !!(settings as any).image_cache_enabled
          : true;
      const maxMbRaw =
        (settings as any)?.image_cache_max_mb !== undefined
          ? Number((settings as any).image_cache_max_mb)
          : 200;
      const maxMb = Number.isFinite(maxMbRaw) ? Math.max(100, maxMbRaw) : 200;
      return { enabled, maxBytes: maxMb * 1024 * 1024 };
    } catch {
      return { enabled: true, maxBytes: 200 * 1024 * 1024 };
    }
  }
}
