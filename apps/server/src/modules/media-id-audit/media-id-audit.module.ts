import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MediaServerModule } from '../api/media-server/media-server.module'
import { PlexApiModule } from '../api/plex-api/plex-api.module'
import { ServarrApiModule } from '../api/servarr-api/servarr-api.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { TasksModule } from '../tasks/tasks.module'
import { MediaIdAuditFinding } from './entities/media-id-audit-finding.entities'
import { MediaIdAuditRun } from './entities/media-id-audit-run.entities'
import { MediaIdAuditController } from './media-id-audit.controller'
import { MediaIdAuditService } from './media-id-audit.service'
import { MediaIdAuditTask } from './media-id-audit.task'

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaIdAuditRun, MediaIdAuditFinding]),
    MediaServerModule,
    PlexApiModule,
    ServarrApiModule,
    NotificationsModule,
    TasksModule,
  ],
  controllers: [MediaIdAuditController],
  providers: [MediaIdAuditService, MediaIdAuditTask],
  exports: [MediaIdAuditService],
})
export class MediaIdAuditModule {}
