import { Controller } from '@nestjs/common';
import { TautulliApiService } from './tautulli-api.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('/tautulli')
@Controller('api/tautulli')
export class TautulliApiController {
  constructor(private readonly tautulliApiService: TautulliApiService) {}
}
