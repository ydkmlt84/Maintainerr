import { BasicResponseDto } from '@maintainerr/contracts'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  NotificationAgentKey,
  NotificationAgentOptions,
  NotificationType,
} from './notifications-interfaces'
import { NotificationService } from './notifications.service'

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('/test')
  public async sendTestNotification(
    @Body()
    payload: {
      id?: number
      agent: NotificationAgentKey
      name: string
      enabled: boolean
      types: number[]
      aboutScale: number
      options: NotificationAgentOptions
    },
  ) {
    const agent = this.notificationService.createDummyTestAgent(payload)
    // Don't use events here, wo we can return error messages
    return await this.notificationService.handleNotification(
      NotificationType.TEST_NOTIFICATION,
      undefined,
      undefined,
      0,
      agent,
    )
  }

  @Get('/agents')
  getNotificationAgents() {
    return this.notificationService.getAgentSpec()
  }

  @Get('/types')
  getNotificationTypes() {
    return this.notificationService.getTypes()
  }

  @Post('/configuration/add')
  async addNotificationConfiguration(
    @Body()
    payload: {
      id?: number
      agent: NotificationAgentKey
      name: string
      enabled: boolean
      types: number[]
      aboutScale: number
      options: NotificationAgentOptions
    },
  ): Promise<BasicResponseDto> {
    return await this.notificationService.addNotificationConfiguration(payload)
  }

  @Post('/configuration/connect')
  async connectNotificationConfiguration(
    @Body()
    payload: {
      rulegroupId: number
      notificationId: number
    },
  ) {
    return this.notificationService.connectNotificationConfigurationToRule(
      payload,
    )
  }

  @Post('/configuration/disconnect')
  async disconnectionNotificationConfiguration(
    @Body()
    payload: {
      rulegroupId: number
      notificationId: number
    },
  ) {
    return this.notificationService.disconnectNotificationConfigurationFromRule(
      payload,
    )
  }

  @Get('/configurations')
  async getNotificationConfigurations() {
    return this.notificationService.getNotificationConfigurations()
  }

  @Get('/type/:type/configurations')
  async getNotificationTypeAssignments(
    @Param('type', ParseIntPipe) type: number,
  ) {
    const notificationType = this.parseNotificationType(type)
    return this.notificationService.getNotificationTypeAssignments(
      notificationType,
    )
  }

  @Put('/type/:type/configurations/:id')
  async setNotificationTypeAssignment(
    @Param('type', ParseIntPipe) type: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: { selected: boolean; aboutScale?: number },
  ) {
    if (typeof payload.selected !== 'boolean') {
      throw new BadRequestException('selected must be a boolean')
    }

    const notificationType = this.parseNotificationType(type)
    if (payload.aboutScale !== undefined) {
      if (notificationType !== NotificationType.MEDIA_ABOUT_TO_BE_HANDLED) {
        throw new BadRequestException(
          'aboutScale is only valid for media about to be handled notifications',
        )
      }
      if (!Number.isInteger(payload.aboutScale) || payload.aboutScale < 0) {
        throw new BadRequestException(
          'aboutScale must be a non-negative integer',
        )
      }
    }

    const result = await this.notificationService.setNotificationTypeAssignment(
      id,
      notificationType,
      payload.selected,
      payload.aboutScale,
    )
    if (!result) throw new NotFoundException('Notification agent not found')
    return result
  }

  @Delete('/configuration/:id')
  async deleteNotificationConfiguration(@Param('id') notificationId: number) {
    return this.notificationService.deleteNotificationConfiguration(
      notificationId,
    )
  }

  private parseNotificationType(type: number): NotificationType {
    if (
      !Object.values(NotificationType).includes(type) ||
      type === NotificationType.TEST_NOTIFICATION
    ) {
      throw new BadRequestException('Unknown notification type')
    }
    return type as NotificationType
  }
}
