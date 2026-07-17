import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common'
import { MediaIdAuditService } from './media-id-audit.service'
import { MediaIdAuditTask } from './media-id-audit.task'

@Controller('/api/media-id-audit')
export class MediaIdAuditController {
  constructor(
    private readonly auditService: MediaIdAuditService,
    private readonly auditTask: MediaIdAuditTask,
  ) {}

  @Post('/run')
  runNow() {
    return this.auditTask.runNow()
  }

  @Get('/runs')
  getRuns(@Query('limit') limit?: string) {
    return this.auditService.getRuns(limit ? Number(limit) : undefined)
  }

  @Get('/runs/latest')
  async getLatestRun() {
    return this.auditService.getLatestRun()
  }

  @Get('/runs/:id')
  async getRun(@Param('id', ParseIntPipe) id: number) {
    const run = await this.auditService.getRun(id)
    if (!run) throw new NotFoundException('Media ID audit run not found')
    return run
  }
}
