import { createMockLogger } from '../../../test/utils/data'
import { CollectionsService } from '../collections/collections.service'
import { MaintainerrLogger } from '../logging/logs.service'
import { SettingsService } from '../settings/settings.service'
import { TasksService } from '../tasks/tasks.service'
import { NotificationType } from './notifications-interfaces'
import { NotificationService } from './notifications.service'
import { WeeklyDeletionDigestTask } from './weekly-deletion-digest.task'

describe('WeeklyDeletionDigestTask', () => {
  it('sends prior and upcoming deletion sections with review links', async () => {
    const collectionsService = {
      getWeeklyDeletionDigest: jest.fn().mockResolvedValue({
        deleted: ['Successfully handled "Old Movie" - Movies'],
        upcoming: ['New Movie - Leaving Soon - 8/29/2026'],
      }),
    }
    const notificationService = { sendNotification: jest.fn() }
    const task = new WeeklyDeletionDigestTask(
      {} as TasksService,
      createMockLogger() as unknown as MaintainerrLogger,
      collectionsService as unknown as CollectionsService,
      notificationService as unknown as NotificationService,
      { applicationUrl: 'https://maintainerr.example/' } as SettingsService,
    )

    await (
      task as unknown as { executeTask: () => Promise<void> }
    ).executeTask()

    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      NotificationType.WEEKLY_DELETION_DIGEST,
      expect.objectContaining({
        subject: 'Weekly deletion digest',
        message: expect.stringMatching(
          /Deleted in the last 7 days[\s\S]*Deleting in the next 7 days[\s\S]*filter=leaving-soon[\s\S]*filter=excluded/,
        ),
      }),
    )
  })
})
