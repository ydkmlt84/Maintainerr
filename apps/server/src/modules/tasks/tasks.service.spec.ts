import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
import { createMockLogger } from '../../../test/utils/data'
import { MaintainerrLogger } from '../logging/logs.service'
import { StatusService } from './status.service'
import { TasksService } from './tasks.service'

describe('TasksService', () => {
  class MockSchedulerRegistry implements Partial<SchedulerRegistry> {
    private readonly jobs = new Map<string, CronJob>()

    getCronJobs(): Map<string, CronJob> {
      return this.jobs
    }

    addCronJob(name: string, job: CronJob): void {
      this.jobs.set(name, job)
    }

    deleteCronJob(name: string): void {
      this.jobs.delete(name)
    }
  }

  let schedulerRegistry: MockSchedulerRegistry
  let tasksService: TasksService
  const taskExecutionRepository = {
    find: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue(undefined),
  }
  const logger = createMockLogger() as unknown as MaintainerrLogger

  beforeEach(() => {
    jest.clearAllMocks()
    taskExecutionRepository.find.mockResolvedValue([])
    taskExecutionRepository.upsert.mockResolvedValue(undefined)
    schedulerRegistry = new MockSchedulerRegistry()
    tasksService = new TasksService(
      schedulerRegistry as unknown as SchedulerRegistry,
      taskExecutionRepository as never,
      new StatusService(),
      logger,
    )
  })

  afterEach(() => {
    schedulerRegistry.getCronJobs().forEach((job) => {
      void job.stop()
    })
    jest.clearAllTimers()
  })

  it('creates and stores a job with initial task state', () => {
    const result = tasksService.createJob(
      'test-task',
      '* * * * * *',
      () => undefined,
    )

    expect(result.code).toBe(1)
    expect(schedulerRegistry.getCronJobs().has('test-task')).toBe(true)

    const taskState = tasksService.getTask('test-task')
    expect(taskState?.running).toBe(false)
    expect(taskState?.runningSince).toBeNull()
  })

  it('returns failure status when creating a duplicate job', () => {
    // seed an existing job
    schedulerRegistry.addCronJob(
      'dupe-task',
      new CronJob('* * * * * *', () => undefined),
    )

    const result = tasksService.createJob(
      'dupe-task',
      '* * * * * *',
      () => undefined,
    )

    expect(result.code).toBe(0)
    expect(logger.error).toHaveBeenCalled()
  })

  it('reports running state for existing and missing tasks', () => {
    expect(tasksService.isRunning('missing')).toBe(false)

    tasksService.createJob('stateful', '* * * * * *', () => undefined)
    tasksService.setRunning('stateful')

    expect(tasksService.isRunning('stateful')).toBe(true)
  })

  it('returns task state when requested', () => {
    tasksService.createJob('introspect', '* * * * * *', () => undefined)

    const task = tasksService.getTask('introspect')
    expect(task).toMatchObject({ name: 'introspect', running: false })
  })

  it('clears running state and throws for unknown task', () => {
    expect(() => tasksService.clearRunning('nope')).toThrow(
      'Task nope does not exist.',
    )

    tasksService.createJob('clear-me', '* * * * * *', () => undefined)
    tasksService.setRunning('clear-me')

    tasksService.clearRunning('clear-me')
    expect(tasksService.isRunning('clear-me')).toBe(false)
  })

  it('throws when setting running state for an unknown task', () => {
    expect(() => tasksService.setRunning('missing-task')).toThrow(
      'Task missing-task does not exist.',
    )
  })

  it('returns error status when updating a missing job', async () => {
    const result = await tasksService.updateJob('absent', '*/5 * * * * *')

    expect(result.code).toBe(0)
    expect(logger.error).toHaveBeenCalledWith('Task absent does not exist.')
  })

  it('updates the cron timing for an existing job', async () => {
    tasksService.createJob('update-me', '* * * * * *', () => undefined)

    const result = await tasksService.updateJob('update-me', '*/2 * * * * *')

    expect(result.code).toBe(1)
    expect(tasksService.getTask('update-me')).toMatchObject({
      schedule: '*/2 * * * * *',
      enabled: true,
    })
    expect(schedulerRegistry.getCronJobs().has('update-me')).toBe(true)
  })

  it('registers a task with a blank schedule as disabled', async () => {
    const result = tasksService.createJob('disabled', '', () => undefined)

    expect(result.code).toBe(1)
    expect(schedulerRegistry.getCronJobs().has('disabled')).toBe(false)
    expect(tasksService.getTask('disabled')?.enabled).toBe(false)

    const summaries = await tasksService.getTaskSummaries()
    expect(summaries[0]).toMatchObject({
      name: 'disabled',
      enabled: false,
      nextRunAt: null,
    })
  })

  it('can disable and re-enable an existing task', async () => {
    tasksService.createJob('toggle-me', '* * * * * *', () => undefined)

    await tasksService.updateJob('toggle-me', '')
    expect(tasksService.getTask('toggle-me')?.enabled).toBe(false)
    expect(schedulerRegistry.getCronJobs().has('toggle-me')).toBe(false)

    await tasksService.updateJob('toggle-me', '*/2 * * * * *')
    expect(tasksService.getTask('toggle-me')?.enabled).toBe(true)
    expect(schedulerRegistry.getCronJobs().has('toggle-me')).toBe(true)
  })

  it('persists execution state and exposes task timing', async () => {
    tasksService.createJob('tracked', '0 0 * * *', () => undefined)
    tasksService.setRunning('tracked')
    tasksService.clearRunning('tracked')

    const summaries = await tasksService.getTaskSummaries()

    expect(taskExecutionRepository.upsert).toHaveBeenCalledTimes(2)
    expect(summaries[0]).toMatchObject({
      name: 'tracked',
      enabled: true,
      running: false,
      lastStatus: 'success',
    })
    expect(summaries[0].lastRunAt).toBeInstanceOf(Date)
    expect(summaries[0].nextRunAt).toBeInstanceOf(Date)
  })

  it('restores the last execution summary after a restart', async () => {
    const lastRunAt = new Date('2026-07-15T12:00:00.000Z')
    taskExecutionRepository.find.mockResolvedValue([
      {
        name: 'restored',
        lastRunAt,
        lastCompletedAt: lastRunAt,
        status: 'success',
        error: null,
      },
    ])
    tasksService.createJob('restored', '0 0 * * *', () => undefined)

    const summaries = await tasksService.getTaskSummaries()

    expect(summaries[0].lastRunAt).toEqual(lastRunAt)
    expect(summaries[0].lastStatus).toBe('success')
  })
})
