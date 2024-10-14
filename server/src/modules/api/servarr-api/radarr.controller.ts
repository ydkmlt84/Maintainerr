import { Controller, Get } from '@nestjs/common';
import { ServarrService } from './servarr.service';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller('api/radarr')
export class RadarrController {
  constructor(private readonly servarr: ServarrService) {}
  @Get()
  getMovie() {
    return this.servarr.RadarrApi.getMovie({ id: 2780 });
  }
}
