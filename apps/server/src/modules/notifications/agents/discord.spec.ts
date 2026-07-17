import axios from 'axios'
import { MaintainerrLogger } from '../../logging/logs.service'
import { Notification } from '../entities/notification.entities'
import {
  NotificationAgentKey,
  NotificationType,
} from '../notifications-interfaces'
import DiscordAgent from './discord'

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

const createAgent = (mentionRoleId?: string) => {
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  } as unknown as MaintainerrLogger
  const notification = {
    id: 1,
    name: 'Discord',
    agent: NotificationAgentKey.DISCORD,
    enabled: true,
    types: [NotificationType.MEDIA_HANDLED],
  } as Notification

  return new DiscordAgent(
    {
      enabled: true,
      types: notification.types,
      options: {
        agent: NotificationAgentKey.DISCORD,
        webhookUrl: 'https://discord.example/webhook',
        mentionRoleId,
      },
    },
    logger,
    notification,
  )
}

describe('DiscordAgent role mentions', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset()
    mockedAxios.post.mockResolvedValue({} as never)
  })

  it('mentions only the configured Discord role', async () => {
    const roleId = '123456789012345678'
    const agent = createAgent(roleId)

    await expect(
      agent.send(NotificationType.MEDIA_HANDLED, {
        subject: 'Media handled',
        message: 'A media item was handled.',
      }),
    ).resolves.toBe('Success')

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://discord.example/webhook',
      expect.objectContaining({
        content: `<@&${roleId}>`,
        allowed_mentions: {
          parse: [],
          roles: [roleId],
        },
      }),
    )
  })

  it('does not add mention fields when no role is configured', async () => {
    const agent = createAgent()

    await agent.send(NotificationType.MEDIA_HANDLED, {
      subject: 'Media handled',
      message: 'A media item was handled.',
    })

    const payload = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('content')
    expect(payload).not.toHaveProperty('allowed_mentions')
  })

  it('rejects an invalid role ID without sending the webhook', async () => {
    const agent = createAgent('@everyone')

    await expect(
      agent.send(NotificationType.MEDIA_HANDLED, {
        subject: 'Media handled',
        message: 'A media item was handled.',
      }),
    ).resolves.toContain('17 to 20 digit numeric ID')
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })
})
