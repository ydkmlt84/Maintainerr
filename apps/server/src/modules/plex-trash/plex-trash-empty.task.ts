import { MaintainerrEvent } from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { MaintainerrLogger } from '../logging/logs.service'
import { Settings } from '../settings/entities/settings.entities'
import { SettingsService } from '../settings/settings.service'
import { TaskBase } from '../tasks/task.base'
import { TasksService } from '../tasks/tasks.service'
import { PlexTrashService } from './plex-trash.service'

@Injectable()
export class PlexTrashEmptyTask extends TaskBase {
  protected name = 'Plex Trash Empty'

  constructor(
    tasksService: TasksService,
    logger: MaintainerrLogger,
    private readonly settingsService: SettingsService,
    private readonly plexTrashService: PlexTrashService,
  ) {
    super(tasksService, logger)
    logger.setContext(PlexTrashEmptyTask.name)
  }

  protected onBootstrapHook() {
    this.cronSchedule = this.settingsService.plex_trash_empty_job_cron ?? ''
  }

  protected async executeTask(): Promise<void> {
    await this.plexTrashService.empty()
  }

  @OnEvent(MaintainerrEvent.Settings_Updated)
  private async onSettingsUpdated(data: {
    oldSettings: Settings
    settings: Settings
  }) {
    if (
      data.oldSettings.plex_trash_empty_job_cron ===
      data.settings.plex_trash_empty_job_cron
    ) {
      return
    }

    await this.updateJob(data.settings.plex_trash_empty_job_cron)
  }
}
