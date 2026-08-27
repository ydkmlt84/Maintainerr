import {
  TraktApplicationConfig,
  TraktHistoryMutation,
  TraktWatchlistMutation,
} from '@maintainerr/contracts'
import { Body, Controller, Delete, Get, Post } from '@nestjs/common'
import { TraktApiService } from './trakt-api.service'

@Controller('api/trakt')
export class TraktApiController {
  constructor(private readonly trakt: TraktApiService) {}

  @Get('status')
  getStatus() {
    return this.trakt.getStatus()
  }

  @Post('configuration')
  configure(@Body() payload: TraktApplicationConfig) {
    return this.trakt.configure(payload)
  }

  @Delete('configuration')
  removeConfiguration() {
    return this.trakt.removeConfiguration()
  }

  @Post('oauth/device')
  startDeviceAuth() {
    return this.trakt.startDeviceAuth()
  }

  @Post('oauth/device/poll')
  pollDeviceAuth(@Body() payload: { deviceCode: string }) {
    return this.trakt.pollDeviceAuth(payload.deviceCode)
  }

  @Delete('oauth')
  disconnect() {
    return this.trakt.disconnect()
  }

  @Get('discover')
  getDiscover() {
    return this.trakt.getDiscover()
  }

  @Post('watchlist')
  addToWatchlist(@Body() payload: TraktWatchlistMutation) {
    return this.trakt.addToWatchlist(payload)
  }

  @Delete('watchlist')
  removeFromWatchlist(@Body() payload: TraktWatchlistMutation) {
    return this.trakt.removeFromWatchlist(payload)
  }

  @Post('history')
  markWatched(@Body() payload: TraktHistoryMutation) {
    return this.trakt.markWatched(payload)
  }
}
