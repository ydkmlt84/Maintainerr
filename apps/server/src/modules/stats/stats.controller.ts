import { Controller, Get, Query } from '@nestjs/common'
import { AppStatsResponse, StatsService } from './stats.service'

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats(): Promise<AppStatsResponse> {
    return this.statsService.getStats()
  }

  @Get('leaving-soon')
  getLeavingSoon(@Query('libraryId') libraryId?: string) {
    return this.statsService.getLeavingSoon(libraryId)
  }

  @Get('excluded')
  getExcluded(@Query('libraryId') libraryId?: string) {
    return this.statsService.getActionableExclusions(libraryId)
  }

  @Get('manually-added')
  getManuallyAdded(@Query('libraryId') libraryId?: string) {
    return this.statsService.getManuallyAdded(libraryId)
  }
}
