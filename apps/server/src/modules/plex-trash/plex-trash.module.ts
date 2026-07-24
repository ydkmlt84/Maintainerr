import { Module } from '@nestjs/common'
import { PlexApiModule } from '../api/plex-api/plex-api.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { TasksModule } from '../tasks/tasks.module'
import { PlexTrashController } from './plex-trash.controller'
import { PlexTrashEmptyTask } from './plex-trash-empty.task'
import { PlexTrashService } from './plex-trash.service'

@Module({
  imports: [PlexApiModule, NotificationsModule, TasksModule],
  controllers: [PlexTrashController],
  providers: [PlexTrashService, PlexTrashEmptyTask],
})
export class PlexTrashModule {}
