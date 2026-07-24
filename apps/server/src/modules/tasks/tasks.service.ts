import { MaintainerrEvent } from '@maintainerr/contracts'
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { CronJob } from 'cron'
import { Repository } from 'typeorm'
import { MaintainerrLogger } from '../logging/logs.service'
import { TaskExecution } from './entities/task-execution.entities'
import { Status } from './interfaces/status.interface'
import { StatusService } from './status.service'

interface TaskState {
  name: string
  schedulerName: string
  schedule: string
  enabled: boolean
  task: () => void | Promise<void>
  running: boolean
  runningSince: Date | null
  lastRunAt: Date | null
  lastCompletedAt: Date | null
  lastStatus: 'never' | 'running' | 'success' | 'failed'
  lastError: string | null
}

export interface ScheduledTaskSummary {
  name: string
  schedule: string
  enabled: boolean
  running: boolean
  runningSince: Date | null
  lastRunAt: Date | null
  nextRunAt: Date | null
  lastStatus: TaskState['lastStatus']
  lastError: string | null
}

@Injectable()
export class TasksService {
  private readonly runningTasks = new Map<string, TaskState>()
  private readonly persistenceQueue = new Map<string, Promise<void>>()

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    @InjectRepository(TaskExecution)
    private readonly taskExecutionRepository: Repository<TaskExecution>,
    private readonly status: StatusService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(TasksService.name)
  }

  public createJob(
    name: string,
    cronExp: CronExpression | string,
    task: () => void | Promise<void>,
  ): Status {
    try {
      if (
        this.schedulerRegistry.getCronJobs().has(name) ||
        this.runningTasks.has(name)
      ) {
        throw new Error(`Task ${name} already exists.`)
      }

      const schedule = cronExp.toString().trim()
      const enabled = schedule.length > 0
      this.runningTasks.set(name, {
        name,
        schedulerName: name,
        schedule,
        enabled,
        task,
        running: false,
        runningSince: null,
        lastRunAt: null,
        lastCompletedAt: null,
        lastStatus: 'never',
        lastError: null,
      })

      if (enabled) {
        const job = new CronJob(schedule, () => {
          void Promise.resolve()
            .then(task)
            .catch((error) => {
              this.logger.error(`Scheduled execution of ${name} failed`, error)
            })
        })
        this.schedulerRegistry.addCronJob(name, job)
        job.start()
      }

      this.logger.log(
        `Task ${name} created successfully${enabled ? '' : ' (disabled)'}`,
      )
      return this.status.createStatus(true, `Task ${name} created successfully`)
    } catch (e) {
      const message = `An error occurred while creating the ${name} task.`
      this.logger.error(message, e)
      return this.status.createStatus(false, message)
    }
  }

  public async updateJob(
    name: string,
    cronExp: CronExpression | string,
  ): Promise<Status> {
    try {
      const task = this.runningTasks.get(name)

      if (!task) {
        const message = `Task ${name} does not exist.`
        this.logger.error(message)
        return this.status.createStatus(false, message)
      }

      const existingJob = this.schedulerRegistry.getCronJobs().get(name)
      if (existingJob) {
        await existingJob.stop()
        this.schedulerRegistry.deleteCronJob(name)
      }

      const schedule = cronExp.toString().trim()
      task.schedule = schedule
      task.enabled = schedule.length > 0

      if (task.enabled) {
        const job = new CronJob(schedule, () => {
          void Promise.resolve()
            .then(() => task.task())
            .catch((error) => {
              this.logger.error(`Scheduled execution of ${name} failed`, error)
            })
        })
        this.schedulerRegistry.addCronJob(name, job)
        job.start()
      }

      this.logger.log(
        `Task ${name} updated successfully${task.enabled ? '' : ' (disabled)'}`,
      )
      return this.status.createStatus(true, `Task ${name} updated successfully`)
    } catch (e) {
      const message = `An error occurred while updating the ${name} task.`
      this.logger.error(message, e)
      return this.status.createStatus(false, message)
    }
  }

  public setRunning(name: string) {
    const task = this.getTask(name)

    if (!task) {
      throw new Error(`Task ${name} does not exist.`)
    }

    const now = new Date()
    task.running = true
    task.runningSince = now
    task.lastRunAt = now
    task.lastStatus = 'running'
    task.lastError = null
    this.persistTaskState(task)
  }

  public isRunning(name: string) {
    const task = this.getTask(name)
    return task?.running ?? false
  }

  public getTask(name: string): TaskState | undefined {
    return this.runningTasks.get(name)
  }

  public clearRunning(name: string, error?: unknown) {
    const task = this.getTask(name)

    if (!task) {
      throw new Error(`Task ${name} does not exist.`)
    }

    task.running = false
    task.runningSince = null
    task.lastCompletedAt = new Date()
    task.lastStatus = error ? 'failed' : 'success'
    task.lastError = error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null
    this.persistTaskState(task)
  }

  public registerExternalJob(
    name: string,
    schedulerName: string,
    schedule: string,
    task: () => void | Promise<void>,
  ) {
    const existing = this.runningTasks.get(name)
    if (existing) {
      existing.schedulerName = schedulerName
      existing.schedule = schedule
      existing.enabled = schedule.trim().length > 0
      existing.task = task
      return
    }

    this.runningTasks.set(name, {
      name,
      schedulerName,
      schedule,
      enabled: schedule.trim().length > 0,
      task,
      running: false,
      runningSince: null,
      lastRunAt: null,
      lastCompletedAt: null,
      lastStatus: 'never',
      lastError: null,
    })
  }

  public async getTaskSummaries(): Promise<ScheduledTaskSummary[]> {
    await Promise.all(this.persistenceQueue.values())
    const persistedExecutions = new Map(
      (await this.taskExecutionRepository.find()).map((execution) => [
        execution.name,
        execution,
      ]),
    )

    return [...this.runningTasks.values()]
      .map((task) => {
        const job = this.schedulerRegistry.getCronJobs().get(task.schedulerName)
        let nextRunAt: Date | null = null

        try {
          nextRunAt = job?.nextDate().toJSDate() ?? null
        } catch {
          nextRunAt = null
        }

        const persisted = persistedExecutions.get(task.name)
        const persistedStatus =
          persisted?.status === 'running' ? 'failed' : persisted?.status

        return {
          name: task.name,
          schedule: task.schedule,
          enabled: task.enabled,
          running: task.running,
          runningSince: task.runningSince,
          lastRunAt:
            task.lastRunAt ?? persisted?.lastRunAt ?? job?.lastDate() ?? null,
          nextRunAt,
          lastStatus: task.lastRunAt
            ? task.lastStatus
            : (persistedStatus ?? task.lastStatus),
          lastError:
            task.lastError ??
            (persisted?.status === 'running'
              ? 'Interrupted by a server restart'
              : (persisted?.error ?? null)),
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  public startTask(name: string) {
    const task = this.runningTasks.get(name)
    if (!task) throw new NotFoundException('Task not found')
    if (task.running) {
      throw new ConflictException(`${name} is already running`)
    }

    void Promise.resolve(task.task()).catch((error) => {
      this.logger.error(`Manual execution of ${name} failed`, error)
    })
  }

  @OnEvent(MaintainerrEvent.RuleHandler_Started)
  private onRuleHandlerStarted() {
    if (this.runningTasks.has('Rule Handler')) {
      this.setRunning('Rule Handler')
    }
  }

  @OnEvent(MaintainerrEvent.RuleHandler_Finished)
  private onRuleHandlerFinished() {
    if (this.runningTasks.has('Rule Handler')) {
      this.clearRunning('Rule Handler')
    }
  }

  private persistTaskState(task: TaskState) {
    const snapshot: TaskExecution = {
      name: task.name,
      lastRunAt: task.lastRunAt,
      lastCompletedAt: task.lastCompletedAt,
      status: task.lastStatus,
      error: task.lastError,
    }
    const previous = this.persistenceQueue.get(task.name) ?? Promise.resolve()
    const next = previous
      .then(async () => {
        await this.taskExecutionRepository.upsert(snapshot, ['name'])
      })
      .catch((error) => {
        this.logger.error(
          `Failed to persist task status for ${task.name}`,
          error,
        )
      })
    this.persistenceQueue.set(task.name, next)
  }
}
