import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('/app')
@Controller('/api/app')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/status')
  async getAppStatus() {
    return JSON.stringify(await this.appService.getAppVersionStatus());
  }
}
