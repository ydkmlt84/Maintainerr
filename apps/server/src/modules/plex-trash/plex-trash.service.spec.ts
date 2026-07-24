import { createMockLogger } from '../../../test/utils/data'
import { PlexApiService } from '../api/plex-api/plex-api.service'
import { MaintainerrLogger } from '../logging/logs.service'
import { NotificationService } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/notifications-interfaces'
import { PlexTrashService } from './plex-trash.service'

describe('PlexTrashService', () => {
  const plexApiService = {
    getLibraries: jest.fn(),
    getLibraryContents: jest.fn(),
    emptyTrash: jest.fn(),
    isPlexSetup: jest.fn(),
  }
  const notificationService = {
    sendNotification: jest.fn(),
  }
  const logger = createMockLogger() as unknown as MaintainerrLogger
  let service: PlexTrashService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new PlexTrashService(
      plexApiService as unknown as PlexApiService,
      notificationService as unknown as NotificationService,
      logger,
    )
  })

  it('reports items returned by the Plex trash inventory', async () => {
    plexApiService.getLibraries.mockResolvedValue([
      { key: '1', title: 'Movies', type: 'movie' },
    ])
    plexApiService.getLibraryContents.mockResolvedValue({
      totalSize: 1,
      items: [
        {
          ratingKey: '10',
          title: 'Deleted Movie',
          year: 2024,
        },
      ],
    })

    await service.sendNotification()

    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      NotificationType.PLEX_TRASH_ABOUT_TO_BE_EMPTIED,
      expect.objectContaining({
        subject: 'Plex trash contains 1 item',
        message: expect.stringContaining('Deleted Movie (2024)'),
      }),
    )
  })

  it('does not notify when Plex trash is empty', async () => {
    plexApiService.getLibraries.mockResolvedValue([
      { key: '1', title: 'Movies', type: 'movie' },
    ])
    plexApiService.getLibraryContents.mockResolvedValue({
      totalSize: 0,
      items: [],
    })

    await service.sendNotification()

    expect(notificationService.sendNotification).not.toHaveBeenCalled()
  })

  it('uses the existing Plex empty trash operation', async () => {
    plexApiService.getLibraries.mockResolvedValue([
      { key: '1', title: 'Movies', type: 'movie' },
    ])
    plexApiService.getLibraryContents.mockResolvedValue({
      totalSize: 1,
      items: [
        {
          ratingKey: '10',
          title: 'Deleted Movie',
          year: 2024,
        },
      ],
    })
    plexApiService.emptyTrash.mockResolvedValue({
      libraryCount: 1,
      libraries: ['Movies'],
    })

    await service.empty()

    expect(plexApiService.emptyTrash).toHaveBeenCalledTimes(1)
    expect(notificationService.sendNotification).toHaveBeenCalledWith(
      NotificationType.PLEX_TRASH_EMPTIED,
      expect.objectContaining({
        subject: 'Plex trash emptied: 1 item removed',
        message: expect.stringContaining('Deleted Movie (2024)'),
      }),
    )
  })

  it('sends the configured event after collection handling finishes', async () => {
    plexApiService.isPlexSetup.mockReturnValue(true)
    const sendNotification = jest
      .spyOn(service, 'sendNotification')
      .mockResolvedValue()

    const onCollectionHandlerFinished = (
      service as unknown as { onCollectionHandlerFinished: () => void }
    ).onCollectionHandlerFinished.bind(service)
    onCollectionHandlerFinished()
    await new Promise((resolve) => setImmediate(resolve))

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })
})
