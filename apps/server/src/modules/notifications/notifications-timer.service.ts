import { MaintainerrEvent } from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CollectionsService } from '../collections/collections.service'
import { ServarrAction } from '../collections/interfaces/collection.interface'
import { MaintainerrLogger } from '../logging/logs.service'
import { SettingsService } from '../settings/settings.service'
import { TaskBase } from '../tasks/task.base'
import { TasksService } from '../tasks/tasks.service'
import { NotificationType } from './notifications-interfaces'
import { NotificationService } from './notifications.service'

// This job sends notifications for the  "About to Be Removed" notificaton type. The job loops through all configured notification providers and sends one notification per provider.
// Each notification includes all media items from all active child collections that are scheduled for removal within the specified number of days.

// Each media item will only be notified once per notification provider, on the specified day. If this job runs multiple times a day, multiple notifications for the same media items would be sent out.
@Injectable()
export class NotificationTimerService extends TaskBase {
  protected name = 'Notification Timer'
  protected cronSchedule = '0 14 * * *'
  protected type = NotificationType.MEDIA_ABOUT_TO_BE_HANDLED
  private lastNextRunNotificationAt = 0

  constructor(
    protected readonly taskService: TasksService,
    protected readonly logger: MaintainerrLogger,
    protected readonly collectionService: CollectionsService,
    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
  ) {
    logger.setContext(NotificationTimerService.name)
    super(taskService, logger)
  }

  protected onBootstrapHook(): void {}

  protected async executeTask() {
    // helper submethod
    const getDayStart = (date: Date) => new Date(date.setHours(0, 0, 0, 0))

    const activeAgents = this.notificationService.getActiveAgents()
    const allNotificationConfigurations =
      await this.notificationService.getNotificationConfigurations(true)

    await Promise.allSettled(
      activeAgents.map(async (agent) => {
        const notification = allNotificationConfigurations.find(
          (n) => n.id === agent.getNotification().id,
        )

        if (!notification?.enabled || !notification.rulegroups?.length) {
          return
        }

        const itemsToNotify = (
          await Promise.all(
            notification.rulegroups.map(async (group) => {
              const notifyDate = new Date(
                new Date().getTime() -
                  group.collection.deleteAfterDays * 86400000 +
                  notification.aboutScale * 86400000,
              )

              const collectionMedia =
                await this.collectionService.getCollectionMedia(
                  group.collection?.id,
                )

              return (
                collectionMedia?.filter((media) => {
                  const mediaDate = new Date(media.addDate)
                  return (
                    getDayStart(mediaDate).getTime() ===
                    getDayStart(notifyDate).getTime()
                  )
                }) || []
              )
            }),
          )
        ).flat()

        const transformedItems = itemsToNotify.map((i) => ({
          mediaServerId: i.mediaServerId,
        }))

        // send the notification if required
        if (transformedItems.length > 0) {
          await this.notificationService.handleNotification(
            this.type,
            transformedItems,
            undefined,
            notification.aboutScale,
            agent,
          )
        }
      }),
    )
  }

  @OnEvent(MaintainerrEvent.CollectionHandler_Finished)
  private onCollectionHandlerFinished(): void {
    const now = Date.now()
    if (now - this.lastNextRunNotificationAt < 5000) return
    this.lastNextRunNotificationAt = now

    void this.sendNextRunDeletionNotification().catch((error) => {
      this.logger.error(
        'Failed to send the next-run deletion notification',
        error,
      )
    })
  }

  public async sendNextRunDeletionNotification(): Promise<void> {
    const collectionTask = (await this.taskService.getTaskSummaries()).find(
      (task) => task.name === 'Collection Handler',
    )
    if (!collectionTask?.nextRunAt) return

    const nextRunAt = collectionTask.nextRunAt.getTime()
    const collections = (await this.collectionService.getCalendarData()) ?? []
    const deletingItems = collections.flatMap((collection) => {
      if (collection.arrAction === ServarrAction.UNMONITOR) return []

      return collection.media.filter((media) => {
        const deleteAt = new Date(media.addDate).getTime()
        const scheduledAt =
          deleteAt + collection.deleteAfterDays * 24 * 60 * 60 * 1000
        return Number.isFinite(scheduledAt) && scheduledAt <= nextRunAt
      })
    })

    if (deletingItems.length === 0) return

    const link = this.getLeavingSoonUrl()
    const nextRunLabel = collectionTask.nextRunAt.toLocaleString()
    await this.notificationService.sendNotification(
      NotificationType.NEXT_RUN_DELETIONS,
      {
        subject: `${deletingItems.length} item${deletingItems.length === 1 ? '' : 's'} deleting during the next run`,
        message: [
          `The next collection run is scheduled for ${nextRunLabel}.`,
          link ? `[View Leaving Soon](${link})` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    )
  }

  private getLeavingSoonUrl(): string | undefined {
    const configuredUrl = this.settingsService.applicationUrl?.trim()
    if (!configuredUrl) return undefined

    try {
      const baseUrl = /^https?:\/\//i.test(configuredUrl)
        ? configuredUrl
        : `http://${configuredUrl}`
      return new URL(
        'media?filter=leaving-soon',
        baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
      ).toString()
    } catch {
      return undefined
    }
  }
}
