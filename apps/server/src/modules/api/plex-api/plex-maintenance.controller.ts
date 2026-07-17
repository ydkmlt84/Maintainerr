import {
  Controller,
  InternalServerErrorException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common'
import { PlexApiService } from './plex-api.service'

@Controller('api/plex/maintenance')
export class PlexMaintenanceController {
  constructor(private readonly plexApiService: PlexApiService) {}

  @Post('empty-trash')
  async emptyTrash() {
    if (!this.plexApiService.isPlexSetup()) {
      throw new ServiceUnavailableException('Plex is not configured')
    }

    try {
      return await this.plexApiService.emptyTrash()
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Could not empty Plex trash',
      )
    }
  }
}
