import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { createReadStream } from 'fs'
import { Response } from 'express'
import {
  TmdbImageCacheService,
  TmdbImageScope,
  TmdbImageVariant,
  TmdbMediaType,
} from './tmdb-image-cache.service'
import { TmdbApiService } from './tmdb.service'

@Controller('api/moviedb')
export class TmdbApiController {
  constructor(
    private readonly movieDbApi: TmdbApiService,
    private readonly imageCache: TmdbImageCacheService,
  ) {}

  @Get('/person/:personId')
  getPerson(@Param('personId', new ParseIntPipe()) personId: number) {
    return this.movieDbApi.getPerson({ personId: personId })
  }
  @Get('/movie/imdb/:id')
  getMovie(@Param('id') imdbId: string) {
    return this.movieDbApi.getByExternalId({
      externalId: imdbId,
      type: 'imdb',
    })
  }
  @Get('/backdrop/:type/:tmdbId')
  getBackdropImage(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
  ) {
    return this.movieDbApi.getBackdropImagePath({ tmdbId: tmdbId, type: type })
  }
  @Get('/assets/:type/:tmdbId')
  getMediaAssets(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
    @Query('seasonNumber', new ParseIntPipe({ optional: true }))
    seasonNumber?: number,
  ) {
    return this.movieDbApi.getMediaAssets({ tmdbId, type, seasonNumber })
  }
  @Get('/profile-image/:personId')
  async getProfileImage(
    @Param('personId', new ParseIntPipe()) personId: number,
    @Query('path') profilePath: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.imageCache.getActorImage({
      personId,
      profilePath,
    })
    if (!image) throw new NotFoundException('TMDB profile image not found')

    response.set({
      'Content-Type': image.contentType,
      'Cache-Control': this.getCacheControl(image),
    })
    return new StreamableFile(createReadStream(image.filePath))
  }
  @Get('/cached-image/:scope/:variant/:type/:tmdbId')
  async getCachedMediaImage(
    @Param('scope') scope: TmdbImageScope,
    @Param('variant') variant: TmdbImageVariant,
    @Param('type') type: TmdbMediaType,
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Query('path') imagePath: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (
      !['library', 'discover'].includes(scope) ||
      !['poster', 'backdrop'].includes(variant) ||
      !['movie', 'show'].includes(type)
    ) {
      throw new NotFoundException('Unsupported TMDB image cache request')
    }

    const image = await this.imageCache.getMediaImage({
      scope,
      variant,
      type,
      tmdbId,
      imagePath,
    })
    if (!image) throw new NotFoundException('TMDB image not found')

    response.set({
      'Content-Type': image.contentType,
      'Cache-Control': this.getCacheControl(image),
    })
    return new StreamableFile(createReadStream(image.filePath))
  }
  @Get('/image/:type/:tmdbId')
  getImage(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
  ) {
    return this.movieDbApi.getImagePath({ tmdbId: tmdbId, type: type })
  }

  private getCacheControl(image: {
    browserMaxAgeSeconds: number
    immutable: boolean
  }): string {
    return `public, max-age=${image.browserMaxAgeSeconds}${
      image.immutable ? ', immutable' : ''
    }`
  }
}
