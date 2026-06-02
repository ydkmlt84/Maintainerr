import { Controller, Get } from '@nestjs/common';
import { AppStatsResponse, StatsService } from './stats.service';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats(): Promise<AppStatsResponse> {
    return this.statsService.getStats();
  }
}
