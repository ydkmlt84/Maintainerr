import { getRepositoryToken } from '@nestjs/typeorm'
import { Mocked, TestBed } from '@suites/unit'
import { Repository } from 'typeorm'
import { Notification } from './entities/notification.entities'
import { NotificationService } from './notifications.service'
import { NotificationType } from './notifications-interfaces'

describe('NotificationService type assignments', () => {
  let service: NotificationService
  let notificationRepo: Mocked<Repository<Notification>>

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(NotificationService).compile()

    service = unit
    notificationRepo = unitRef.get(getRepositoryToken(Notification) as string)
  })

  it('reports whether each configured agent has the type selected', async () => {
    notificationRepo.find.mockResolvedValue([
      {
        id: 1,
        name: 'Discord',
        agent: 'discord',
        enabled: true,
        types: [NotificationType.MEDIA_ID_AUDIT],
      } as Notification,
      {
        id: 2,
        name: 'Email',
        agent: 'email',
        enabled: false,
        types: [],
      } as Notification,
    ])

    await expect(
      service.getNotificationTypeAssignments(NotificationType.MEDIA_ID_AUDIT),
    ).resolves.toEqual([
      {
        id: 1,
        name: 'Discord',
        agent: 'discord',
        enabled: true,
        selected: true,
      },
      {
        id: 2,
        name: 'Email',
        agent: 'email',
        enabled: false,
        selected: false,
      },
    ])
  })

  it('adds the audit type without replacing other notification types', async () => {
    const notification = {
      id: 1,
      types: [NotificationType.MEDIA_HANDLED],
    } as Notification
    notificationRepo.findOne.mockResolvedValue(notification)
    notificationRepo.save.mockResolvedValue(notification)
    jest.spyOn(service, 'registerConfiguredAgents').mockResolvedValue()

    await expect(
      service.setNotificationTypeAssignment(
        1,
        NotificationType.MEDIA_ID_AUDIT,
        true,
      ),
    ).resolves.toEqual({ id: 1, selected: true })
    expect(notification.types).toEqual([
      NotificationType.MEDIA_HANDLED,
      NotificationType.MEDIA_ID_AUDIT,
    ])
    expect(notificationRepo.save).toHaveBeenCalledWith(notification)
  })

  it('updates the lead time for media about to be handled notifications', async () => {
    const notification = {
      id: 1,
      types: [NotificationType.MEDIA_ABOUT_TO_BE_HANDLED],
      aboutScale: 3,
    } as Notification
    notificationRepo.findOne.mockResolvedValue(notification)
    notificationRepo.save.mockResolvedValue(notification)
    jest.spyOn(service, 'registerConfiguredAgents').mockResolvedValue()

    await expect(
      service.setNotificationTypeAssignment(
        1,
        NotificationType.MEDIA_ABOUT_TO_BE_HANDLED,
        true,
        7,
      ),
    ).resolves.toEqual({ id: 1, selected: true, aboutScale: 7 })
    expect(notification.aboutScale).toBe(7)
    expect(notificationRepo.save).toHaveBeenCalledWith(notification)
  })
})
