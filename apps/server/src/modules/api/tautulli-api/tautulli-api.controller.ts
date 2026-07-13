import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { Response } from 'express'
import { TautulliApiService } from './tautulli-api.service'

@Controller('api/tautulli')
export class TautulliApiController {
  constructor(private readonly tautulliApiService: TautulliApiService) {}

  @Get('image')
  async getImage(
    @Query('path') path: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const image = await this.tautulliApiService.getImage(path)
    if (!image) throw new NotFoundException('Tautulli image not found')

    response.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=3600',
    })
    return new StreamableFile(image.data)
  }
}
