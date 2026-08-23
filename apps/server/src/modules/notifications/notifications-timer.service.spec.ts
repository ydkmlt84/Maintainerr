import { createMockLogger } from '../../../test/utils/data'
import { CollectionsService } from '../collections/collections.service'
import { ServarrAction } from '../collections/interfaces/collection.interface'
import { MaintainerrLogger } from '../logging/logs.service'
import { SettingsService } from '../settings/settings.service'
import { TasksService } from '../tasks/tasks.service'
import { NotificationType } from './notifications-interfaces'
import { NotificationTimerService } from './notifications-timer.service'
import { NotificationService } from './notifications.service'

describe('NotificationTimerService next-run deletions', () => {
  it('reports items due by the next collection run and links to the filter', async () => {
    const nextRunAt = new Date('2026-08-23T02:00:00.000Z')
    const taskService = {
      getTaskSummaries: jest
        .fn()
        .mockResolvedValue([{ name: 'Collection Handler', nextRunAt }]),
    }
    const collectionService = {
      getCalendarData: jest.fn().mockResolvedValue([
        {
          arrAction: ServarrAction.DELETE,
          deleteAfterDays: 7,
          media: [
            { mediaServerId: '1', addDate: '2026-08-16T01:00:00.000Z' },
            { mediaServerId: '2', addDate: '2026-08-17T03:00:00.000Z' },
          ],
        },
        {
          arrAction: ServarrAction.UNMONITOR,
          deleteAfterDays: 1,
          media: [{ mediaServerId: '3', addDate: '2026-08-01T00:00:00.000Z' }],
        },
      ]),
    }
    const notificationService = { sendNotification: jest.fn() }
    const settingsService = {
      applicationUrl: 'https://maintainerr.example/app/',
    }
    const service = new NotificationTimerService(
      taskService as unknown as TasksService,
      createMockLogger() as unknown as MaintainerrLogger,
      collectionService as unknown as CollectionsService,
      notificationService as unknown as NotificationService,
      settingsService as unknown as SettingsService,
    )

    await service.sendNextRunDeletionNotification()

    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      NotificationType.NEXT_RUN_DELETIONS,
      expect.objectContaining({
        subject: '1 item deleting during the next run',
        message: expect.stringContaining(
          'https://maintainerr.example/app/media?filter=leaving-soon',
        ),
      }),
    )
  })
})
