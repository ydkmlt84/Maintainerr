import { TaskStatusDto } from '@maintainerr/contracts'
import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { TasksService } from './tasks.service'

@Controller('/api/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getTasks() {
    return this.tasksService.getTaskSummaries()
  }

  @Post(':id/run')
  runTask(@Param('id') id: string) {
    this.tasksService.startTask(id)
    return { status: 'started' }
  }

  @Get(':id/status')
  async getTaskStatus(@Param('id') id: string): Promise<TaskStatusDto> {
    const task = this.tasksService.getTask(id)
    if (!task) {
      throw new NotFoundException('Task not found')
    }

    return {
      time: new Date(),
      running: task.running,
      runningSince: task.runningSince,
    }
  }
}
