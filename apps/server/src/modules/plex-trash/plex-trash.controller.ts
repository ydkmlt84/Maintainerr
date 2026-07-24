import {
  Controller,
  InternalServerErrorException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common'
import { PlexApiService } from '../api/plex-api/plex-api.service'
import { PlexTrashService } from './plex-trash.service'

@Controller('api/plex/maintenance')
export class PlexTrashController {
  constructor(
    private readonly plexApiService: PlexApiService,
    private readonly plexTrashService: PlexTrashService,
  ) {}

  @Post('empty-trash')
  async emptyTrash() {
    if (!this.plexApiService.isPlexSetup()) {
      throw new ServiceUnavailableException('Plex is not configured')
    }

    try {
      return await this.plexTrashService.empty()
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Could not empty Plex trash',
      )
    }
  }
}
