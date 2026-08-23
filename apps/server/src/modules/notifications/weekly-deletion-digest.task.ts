import { Injectable } from '@nestjs/common'
import { CollectionsService } from '../collections/collections.service'
import { MaintainerrLogger } from '../logging/logs.service'
import { SettingsService } from '../settings/settings.service'
import { TaskBase } from '../tasks/task.base'
import { TasksService } from '../tasks/tasks.service'
import { NotificationType } from './notifications-interfaces'
import { NotificationService } from './notifications.service'

@Injectable()
export class WeeklyDeletionDigestTask extends TaskBase {
  protected name = 'Weekly Deletion Digest'
  protected cronSchedule = '0 9 * * 0'

  constructor(
    protected readonly taskService: TasksService,
    protected readonly logger: MaintainerrLogger,
    private readonly collectionsService: CollectionsService,
    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
  ) {
    logger.setContext(WeeklyDeletionDigestTask.name)
    super(taskService, logger)
  }

  protected async executeTask(): Promise<void> {
    const now = new Date()
    const digest = await this.collectionsService.getWeeklyDeletionDigest(
      new Date(now.getTime() - 7 * 86400000),
      new Date(now.getTime() + 7 * 86400000),
    )
    if (digest.deleted.length === 0 && digest.upcoming.length === 0) return

    const message = [
      this.formatSection('Deleted in the last 7 days', digest.deleted),
      this.formatSection('Deleting in the next 7 days', digest.upcoming),
      this.getMediaUrl('leaving-soon')
        ? `[Review Leaving Soon](${this.getMediaUrl('leaving-soon')})`
        : undefined,
      this.getMediaUrl('excluded')
        ? `[Review Exclusions](${this.getMediaUrl('excluded')})`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n\n')

    await this.notificationService.sendNotification(
      NotificationType.WEEKLY_DELETION_DIGEST,
      {
        subject: 'Weekly deletion digest',
        message,
      },
    )
  }

  private formatSection(title: string, items: string[]): string {
    const visible = items.slice(0, 15)
    return [
      `**${title} (${items.length})**`,
      ...(visible.length ? visible.map((item) => `- ${item}`) : ['- None']),
      ...(items.length > visible.length
        ? [`- …and ${items.length - visible.length} more`]
        : []),
    ].join('\n')
  }

  private getMediaUrl(filter: 'leaving-soon' | 'excluded') {
    const configuredUrl = this.settingsService.applicationUrl?.trim()
    if (!configuredUrl) return undefined

    try {
      const baseUrl = /^https?:\/\//i.test(configuredUrl)
        ? configuredUrl
        : `http://${configuredUrl}`
      return new URL(
        `media?filter=${filter}`,
        baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
      ).toString()
    } catch {
      return undefined
    }
  }
}
