import { Module } from '@nestjs/common'
import { MediaServerModule } from '../media-server/media-server.module'
import { ServarrApiModule } from '../servarr-api/servarr-api.module'
import { TraktApiController } from './trakt-api.controller'
import { TraktApiService } from './trakt-api.service'

@Module({
  imports: [MediaServerModule, ServarrApiModule],
  controllers: [TraktApiController],
  providers: [TraktApiService],
  exports: [TraktApiService],
})
export class TraktApiModule {}
