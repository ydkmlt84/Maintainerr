import {
  DownloadIcon,
  PlayIcon,
  SaveIcon,
  TrashIcon,
} from '@heroicons/react/solid'
import { isValidCron } from 'cron-validator'
import { useEffect, useRef, useState } from 'react'
import { useSettingsOutletContext } from '..'
import { useRunMediaIdAudit } from '../../../api/media-id-audit'
import { usePatchSettings } from '../../../api/settings'
import {
  ScheduledTask,
  useRunScheduledTask,
  useScheduledTasks,
} from '../../../api/tasks'
import { PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import LoadingSpinner from '../../Common/LoadingSpinner'
import DatabaseBackupModal from '../Main/DatabaseBackupModal'

const taskDescriptions: Record<string, string> = {
  'Collection Handler': 'Processes pending collection additions and removals.',
  'Collection Log Cleaner': 'Removes expired collection activity logs.',
  'Media ID Audit': 'Compares Plex provider IDs with Radarr and Sonarr.',
  'Notification Timer': 'Sends notifications for media approaching removal.',
  'Rule Handler': 'Evaluates active rule groups on the global schedule.',
  'Rule Maintenance':
    'Cleans stale exclusions, media, and orphaned collections.',
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Never'

const formatRelative = (value: string | null) => {
  if (!value) return 'Not scheduled'
  const difference = new Date(value).getTime() - Date.now()
  const absolute = Math.abs(difference)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absolute < 60 * 60 * 1000) {
    return formatter.format(Math.round(difference / 60000), 'minute')
  }
  if (absolute < 24 * 60 * 60 * 1000) {
    return formatter.format(Math.round(difference / 3600000), 'hour')
  }
  return formatter.format(Math.round(difference / 86400000), 'day')
}

const statusLabel = (task: ScheduledTask) => {
  if (task.running) return 'Running'
  if (task.lastStatus === 'failed') return 'Failed'
  if (task.lastStatus === 'success') return 'Completed'
  return 'Idle'
}

const statusClasses = (task: ScheduledTask) => {
  if (task.running) return 'bg-sky-400'
  if (task.lastStatus === 'failed') return 'bg-red-500'
  if (task.lastStatus === 'success') return 'bg-emerald-500'
  return 'bg-zinc-500'
}

const JobSettings = () => {
  const ruleHandlerRef = useRef<HTMLInputElement>(null)
  const collectionHandlerRef = useRef<HTMLInputElement>(null)
  const mediaIdAuditRef = useRef<HTMLInputElement>(null)
  const emptyTrashButtonRef = useRef<HTMLDivElement>(null)
  const [cronValidity, setCronValidity] = useState({
    rules: true,
    collections: true,
    audit: true,
  })
  const [missingValuesError, setMissingValuesError] = useState(false)
  const [cleanupPending, setCleanupPending] = useState(false)
  const [cleanupError, setCleanupError] = useState(false)
  const [cleanupRemovedCount, setCleanupRemovedCount] = useState<number>()
  const [emptyTrashPending, setEmptyTrashPending] = useState(false)
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false)
  const [emptyTrashError, setEmptyTrashError] = useState(false)
  const [emptiedLibraryCount, setEmptiedLibraryCount] = useState<number>()
  const [showDatabaseBackup, setShowDatabaseBackup] = useState(false)
  const [runningTask, setRunningTask] = useState<string>()
  const [taskError, setTaskError] = useState<string>()
  const { settings } = useSettingsOutletContext()
  const tasks = useScheduledTasks()
  const runScheduledTask = useRunScheduledTask()
  const runAudit = useRunMediaIdAudit()
  const updateSettings = usePatchSettings()

  useEffect(() => {
    if (!emptyTrashConfirm || emptyTrashPending) return

    const timeout = window.setTimeout(() => setEmptyTrashConfirm(false), 5000)
    const resetOnOutsideClick = (event: PointerEvent) => {
      if (!emptyTrashButtonRef.current?.contains(event.target as Node)) {
        setEmptyTrashConfirm(false)
      }
    }

    document.addEventListener('pointerdown', resetOnOutsideClick)
    return () => {
      window.clearTimeout(timeout)
      document.removeEventListener('pointerdown', resetOnOutsideClick)
    }
  }, [emptyTrashConfirm, emptyTrashPending])

  useEffect(() => {
    if (cleanupRemovedCount === undefined) return

    const timeout = window.setTimeout(
      () => setCleanupRemovedCount(undefined),
      5000,
    )
    return () => window.clearTimeout(timeout)
  }, [cleanupRemovedCount])

  useEffect(() => {
    if (emptiedLibraryCount === undefined) return

    const timeout = window.setTimeout(
      () => setEmptiedLibraryCount(undefined),
      5000,
    )
    return () => window.clearTimeout(timeout)
  }, [emptiedLibraryCount])

  const executeTask = async (name: string) => {
    setRunningTask(name)
    setTaskError(undefined)
    try {
      if (name === 'Media ID Audit') {
        await runAudit.mutateAsync()
      } else if (name === 'Rule Handler') {
        await PostApiHandler('/rules/execute', {})
      } else {
        await runScheduledTask.mutateAsync(name)
      }
      await tasks.refetch()
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : 'Task failed to start',
      )
    } finally {
      setRunningTask(undefined)
    }
  }

  const cleanupStaleMedia = async () => {
    setCleanupPending(true)
    setCleanupError(false)
    setCleanupRemovedCount(undefined)
    try {
      const result = await PostApiHandler<{ removedCount: number }>(
        '/collections/maintenance/stale-media',
        {},
      )
      setCleanupRemovedCount(result.removedCount)
    } catch {
      setCleanupError(true)
    } finally {
      setCleanupPending(false)
    }
  }

  const emptyPlexTrash = async () => {
    if (!emptyTrashConfirm) {
      setEmptyTrashConfirm(true)
      return
    }

    setEmptyTrashPending(true)
    setEmptyTrashError(false)
    setEmptiedLibraryCount(undefined)
    try {
      const result = await PostApiHandler<{ libraryCount: number }>(
        '/plex/maintenance/empty-trash',
        {},
      )
      setEmptiedLibraryCount(result.libraryCount)
    } catch {
      setEmptyTrashError(true)
    } finally {
      setEmptyTrashPending(false)
      setEmptyTrashConfirm(false)
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMissingValuesError(false)
    const rules = ruleHandlerRef.current?.value ?? ''
    const collections = collectionHandlerRef.current?.value ?? ''
    const audit = mediaIdAuditRef.current?.value ?? ''

    if (
      ![rules, collections, audit].every((value) => value && isValidCron(value))
    ) {
      setMissingValuesError(true)
      return
    }

    await updateSettings.mutateAsync({
      rules_handler_job_cron: rules,
      collection_handler_job_cron: collections,
      media_id_audit_job_cron: audit,
    })
    await tasks.refetch()
  }

  const cronField = (
    id: string,
    label: string,
    description: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    defaultValue: string,
    validityKey: keyof typeof cronValidity,
  ) => (
    <div className="form-row">
      <label htmlFor={id} className="text-label">
        {label}
        <p className="text-xs font-normal">{description}</p>
      </label>
      <div className="form-input">
        <div
          className={`form-input-field ${
            !cronValidity[validityKey] ? 'border-2 border-red-700' : ''
          }`}
        >
          <input
            id={id}
            name={id}
            type="text"
            ref={inputRef}
            defaultValue={defaultValue}
            onChange={(event) =>
              setCronValidity((current) => ({
                ...current,
                [validityKey]: isValidCron(event.target.value),
              }))
            }
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      <title>Tasks - Maintainerr</title>
      <div className="h-full w-full">
        {showDatabaseBackup && (
          <DatabaseBackupModal onClose={() => setShowDatabaseBackup(false)} />
        )}

        <div className="section">
          <h3 className="heading underline decoration-zinc-600 underline-offset-4">
            Maintenance
          </h3>
          {cleanupError && (
            <Alert
              type="error"
              title="Cleanup failed. Verify the media server connection."
            />
          )}
          {cleanupRemovedCount !== undefined && (
            <Alert
              type="info"
              title={
                cleanupRemovedCount === 0
                  ? 'No stale media entries found.'
                  : `Removed ${cleanupRemovedCount} stale media ${
                      cleanupRemovedCount === 1 ? 'entry' : 'entries'
                    }.`
              }
            />
          )}
          {emptyTrashError && (
            <Alert
              type="error"
              title="Plex trash could not be emptied. Verify the Plex connection and server-owner permissions."
            />
          )}
          {emptiedLibraryCount !== undefined && (
            <Alert
              type="info"
              title={`Plex trash emptied for ${emptiedLibraryCount} ${
                emptiedLibraryCount === 1 ? 'library' : 'libraries'
              }.`}
            />
          )}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-start">
              <Button
                buttonType="warning"
                type="button"
                className="w-full"
                disabled={cleanupPending}
                onClick={() => void cleanupStaleMedia()}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>
                  {cleanupPending ? 'Cleaning...' : 'Clean Stale Media'}
                </span>
              </Button>
            </div>
            <div
              ref={emptyTrashButtonRef}
              className="flex flex-col items-start"
            >
              <Button
                buttonType={emptyTrashConfirm ? 'danger' : 'warning'}
                type="button"
                className="w-full"
                disabled={emptyTrashPending}
                onClick={() => void emptyPlexTrash()}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>
                  {emptyTrashPending
                    ? 'Emptying...'
                    : emptyTrashConfirm
                      ? 'Confirm Empty Trash'
                      : 'Empty Plex Trash'}
                </span>
              </Button>
            </div>
            <div className="flex flex-col items-start">
              <Button
                buttonType="warning"
                type="button"
                className="w-full"
                onClick={() => setShowDatabaseBackup(true)}
              >
                <DownloadIcon className="mr-2 h-4 w-4" />
                <span>Backup Database</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="section w-full">
          <h3 className="heading underline decoration-zinc-600 underline-offset-4">
            Tasks
          </h3>
        </div>

        {taskError && <Alert type="error" title={taskError} />}

        <div className="section overflow-hidden rounded-md border border-zinc-700 bg-zinc-900/40 p-0 shadow-sm shadow-black/20">
          {tasks.isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : tasks.isError ? (
            <Alert type="error" title="Unable to load scheduled tasks." />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="border-b border-zinc-700 bg-zinc-800 text-xs uppercase text-zinc-400">
                    <tr>
                      <th className="w-[30%] px-4 py-3">Name</th>
                      <th className="w-[18%] px-4 py-3">Status</th>
                      <th className="w-[20%] px-4 py-3">Last Run</th>
                      <th className="w-[20%] px-4 py-3">Next Run</th>
                      <th className="w-[12%] px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700">
                    {tasks.data?.map((task) => (
                      <tr
                        key={task.name}
                        className="align-middle transition-colors hover:bg-zinc-800/60"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-100">
                            {task.name}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {taskDescriptions[task.name] ?? task.schedule}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${statusClasses(task)}`}
                            />
                            <span>{statusLabel(task)}</span>
                          </div>
                          {task.lastError && (
                            <div
                              className="mt-1 truncate text-xs text-red-400"
                              title={task.lastError}
                            >
                              {task.lastError}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(task.lastRunAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-200">
                            {formatRelative(task.nextRunAt)}
                          </div>
                          {task.nextRunAt && (
                            <div className="mt-1 text-xs text-zinc-500">
                              {formatDate(task.nextRunAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            buttonType="default"
                            buttonSize="sm"
                            type="button"
                            title={`Run ${task.name}`}
                            aria-label={`Run ${task.name}`}
                            disabled={task.running || runningTask === task.name}
                            onClick={() => void executeTask(task.name)}
                          >
                            <PlayIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-zinc-700 bg-zinc-900/40 md:hidden">
                {tasks.data?.map((task) => (
                  <div
                    key={task.name}
                    className="p-4 transition-colors hover:bg-zinc-800/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-100">
                          {task.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {taskDescriptions[task.name] ?? task.schedule}
                        </div>
                      </div>
                      <Button
                        buttonType="default"
                        buttonSize="sm"
                        type="button"
                        title={`Run ${task.name}`}
                        aria-label={`Run ${task.name}`}
                        disabled={task.running || runningTask === task.name}
                        onClick={() => void executeTask(task.name)}
                      >
                        <PlayIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-zinc-500">Status</div>
                        <div className="mt-1 flex items-center gap-2 text-zinc-200">
                          <span
                            className={`h-2 w-2 rounded-full ${statusClasses(task)}`}
                          />
                          {statusLabel(task)}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Next Run</div>
                        <div className="mt-1 text-zinc-200">
                          {formatRelative(task.nextRunAt)}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-zinc-500">Last Run</div>
                        <div className="mt-1 text-zinc-200">
                          {formatDate(task.lastRunAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="section">
          <h3 className="heading underline decoration-zinc-600 underline-offset-4">
            Task Schedules
          </h3>
          {missingValuesError && (
            <Alert
              type="error"
              title="Please make sure all cron values are valid."
            />
          )}
          {updateSettings.isError && (
            <Alert
              type="error"
              title="The task schedules could not be updated."
            />
          )}
          {updateSettings.isSuccess && (
            <Alert type="info" title="Task schedules updated." />
          )}
          <form onSubmit={submit}>
            {cronField(
              'ruleHandler',
              'Rule Handler',
              'Global schedule for rule groups without an individual override.',
              ruleHandlerRef,
              settings.rules_handler_job_cron,
              'rules',
            )}
            {cronField(
              'collectionHandler',
              'Collection Handler',
              'Schedule for processing collection additions and removals.',
              collectionHandlerRef,
              settings.collection_handler_job_cron,
              'collections',
            )}
            {cronField(
              'mediaIdAudit',
              'Media ID Audit',
              'Daily comparison of Plex IDs against Radarr and Sonarr.',
              mediaIdAuditRef,
              settings.media_id_audit_job_cron,
              'audit',
            )}
            <div className="actions mt-5 flex justify-end">
              <Button
                buttonType="primary"
                type="submit"
                disabled={updateSettings.isPending}
              >
                <SaveIcon className="mr-2 h-4 w-4" />
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default JobSettings
