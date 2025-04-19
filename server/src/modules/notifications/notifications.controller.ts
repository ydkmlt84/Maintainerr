import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { NotificationType } from './notifications-interfaces';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
      id?: number;
      agent: string;
      name: string;
      enabled: boolean;
      types: number[];
      aboutScale: number;
      options: object;
    },
  ) {
    const agent = this.notificationService.createDummyTestAgent(payload);
    // Don't use events here, wo we can return error messages
    return await this.notificationService.handleNotification(
      NotificationType.TEST_NOTIFICATION,
      undefined,
      undefined,
      0,
      agent,
    );
  }

  @Get('/agents')
  getNotificationAgents() {
    return this.notificationService.getAgentSpec();
  }

  @Get('/types')
  getNotificationTypes() {
    return this.notificationService.getTypes();
  }

  @Post('/configuration/add')
  async addNotificationConfiguration(
    @Body()
    payload: {
      id?: number;
      agent: string;
      name: string;
      enabled: boolean;
      types: number[];
      aboutScale: number;
      options: object;
    },
  ) {
    return this.notificationService.addNotificationConfiguration(payload);
  }

  @Post('/configuration/connect')
  async connectNotificationConfiguration(
    @Body()
    payload: {
      rulegroupId: number;
      notificationId: number;
    },
  ) {
    return this.notificationService.connectNotificationConfigurationToRule(
      payload,
    );
  }

  @Post('/configuration/disconnect')
  async disconnectionNotificationConfiguration(
    @Body()
    payload: {
      rulegroupId: number;
      notificationId: number;
    },
  ) {
    return this.notificationService.disconnectNotificationConfigurationFromRule(
      payload,
    );
  }

  @Get('/configurations')
  async getNotificationConfigurations() {
    return this.notificationService.getNotificationConfigurations();
  }

  @Delete('/configuration/:id')
  async deleteNotificationConfiguration(@Param('id') notificationId: number) {
    return this.notificationService.deleteNotificationConfiguration(
      notificationId,
    );
  }
}
