import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common'
import { ServarrService } from './servarr.service'

@Controller('api/servarr')
export class ServarrApiController {
  constructor(private readonly servarrService: ServarrService) {}

  @Get('sonarr/:id/diskspace')
  async getSonarrDiskspace(@Param('id', ParseIntPipe) id: number) {
    const client = await this.servarrService.getSonarrApiClient(id)
    return await client.getDiskspace()
  }

  @Get('radarr/:id/diskspace')
  async getRadarrDiskspace(@Param('id', ParseIntPipe) id: number) {
    const client = await this.servarrService.getRadarrApiClient(id)
    return await client.getDiskspace()
  }

  @Get('links')
  async getMediaLinks(
    @Query('type') type: string,
    @Query('tmdbId') tmdbId?: string,
    @Query('tvdbId') tvdbId?: string,
  ) {
    if (type !== 'movie' && type !== 'show') {
      throw new BadRequestException('Media type must be movie or show')
    }

    return this.servarrService.getMediaLinks({
      type,
      tmdbId: this.parseOptionalId(tmdbId),
      tvdbId: this.parseOptionalId(tvdbId),
    })
  }

  private parseOptionalId(value?: string): number | undefined {
    if (!value) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('Provider IDs must be positive integers')
    }
    return parsed
  }
}
