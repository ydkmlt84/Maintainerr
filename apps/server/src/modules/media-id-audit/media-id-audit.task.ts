import { MaintainerrEvent } from '@maintainerr/contracts'
import { ConflictException, Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { MaintainerrLogger } from '../logging/logs.service'
import { Settings } from '../settings/entities/settings.entities'
import { SettingsService } from '../settings/settings.service'
import { TaskBase } from '../tasks/task.base'
import { TasksService } from '../tasks/tasks.service'
import { MediaIdAuditRun } from './entities/media-id-audit-run.entities'
import { MediaIdAuditService } from './media-id-audit.service'

@Injectable()
export class MediaIdAuditTask extends TaskBase {
  protected name = 'Media ID Audit'

  constructor(
    tasksService: TasksService,
    logger: MaintainerrLogger,
    private readonly settingsService: SettingsService,
    private readonly auditService: MediaIdAuditService,
  ) {
    super(tasksService, logger)
    logger.setContext(MediaIdAuditTask.name)
  }

  protected onBootstrapHook() {
    this.cronSchedule = this.settingsService.media_id_audit_job_cron
  }

  protected async executeTask(abortSignal: AbortSignal): Promise<void> {
    await this.auditService.runAudit(abortSignal, true)
  }

  public async runNow(): Promise<MediaIdAuditRun | null> {
    if (this.isRunning()) {
      throw new ConflictException('The media ID audit is already running')
    }

    await this.execute()
    return this.auditService.getLatestRun()
  }

  @OnEvent(MaintainerrEvent.Settings_Updated)
  private async onSettingsUpdated(data: {
    oldSettings: Settings
    settings: Settings
  }) {
    if (
      data.oldSettings.media_id_audit_job_cron ===
      data.settings.media_id_audit_job_cron
    ) {
      return
    }

    await this.updateJob(data.settings.media_id_audit_job_cron)
  }
}
