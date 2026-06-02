import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MediaServerModule } from '../api/media-server/media-server.module'
import { ServarrApiModule } from '../api/servarr-api/servarr-api.module'
import { CollectionsModule } from '../collections/collections.module'
import { CollectionLog } from '../collections/entities/collection_log.entities'
import { CollectionMedia } from '../collections/entities/collection_media.entities'
import { RuleGroup } from '../rules/entities/rule-group.entities'
import { SonarrSettings } from '../settings/entities/sonarr_settings.entities'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  imports: [
    CollectionsModule,
    MediaServerModule,
    ServarrApiModule,
    TypeOrmModule.forFeature([
      CollectionLog,
      CollectionMedia,
      RuleGroup,
      SonarrSettings,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
