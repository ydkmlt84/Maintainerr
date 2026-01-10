import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { TmdbApiService } from './tmdb.service';

@Controller('api/moviedb')
export class TmdbApiController {
  constructor(private readonly movieDbApi: TmdbApiService) {}

  @Get('/person/:personId')
  getPerson(@Param('personId', new ParseIntPipe()) personId: number) {
    return this.movieDbApi.getPerson({ personId: personId });
  }
  @Get('/movie/imdb/:id')
  getMovie(@Param('id') imdbId: number) {
    return this.movieDbApi.getByExternalId({
      externalId: imdbId.toString(),
      type: 'imdb',
    });
  }
  @Get('/backdrop/:type/:tmdbId')
  getBackdropImage(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
  ) {
    return this.movieDbApi.getBackdropImagePath({ tmdbId: tmdbId, type: type });
  }
  @Get('/image/:type/:tmdbId')
  getImage(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
  ) {
    return this.movieDbApi.getImagePath({ tmdbId: tmdbId, type: type });
  }

  @Get('/imagefile/:type/:tmdbId')
  async getImageFile(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
    @Query('size') size = 'w342',
    @Res() res: Response,
  ) {
    const { filePath, remoteUrl } = await this.movieDbApi.getCachedImage({
      tmdbId,
      type,
      variant: 'poster',
      size,
    });
    // allow to cache for 7 days
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    if (remoteUrl && !filePath) {
      return res.redirect(remoteUrl);
    }
    if (!filePath) {
      return res.status(404).send();
    }
    return res.sendFile(filePath);
  }

  @Get('/backdropfile/:type/:tmdbId')
  async getBackdropFile(
    @Param('tmdbId', new ParseIntPipe()) tmdbId: number,
    @Param('type') type: 'movie' | 'show',
    @Query('size') size = 'w1280',
    @Res() res: Response,
  ) {
    const { filePath, remoteUrl } = await this.movieDbApi.getCachedImage({
      tmdbId,
      type,
      variant: 'backdrop',
      size,
    });
    // allow to cache for 7 days
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    if (remoteUrl && !filePath) {
      return res.redirect(remoteUrl);
    }
    if (!filePath) {
      return res.status(404).send();
    }
    return res.sendFile(filePath);
  }

  @Post('/cache/clear')
  @HttpCode(200)
  async clearCache() {
    return this.movieDbApi.clearCache();
  }
}
