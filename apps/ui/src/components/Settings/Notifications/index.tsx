import {
  BellIcon,
  DocumentAddIcon,
  PlusCircleIcon,
  SaveIcon,
  TrashIcon,
} from '@heroicons/react/solid'
import { useQueryClient } from '@tanstack/react-query'

import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  MEDIA_ABOUT_TO_BE_HANDLED,
  NotificationTypeSpec,
  useNotificationTypes,
  useSetNotificationAssignment,
} from '../../../api/notifications'
import GetApiHandler, { DeleteApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import LoadingSpinner from '../../Common/LoadingSpinner'
import CreateNotificationModal, {
  AgentConfiguration,
} from './CreateNotificationModal'

const NotificationSettings = () => {
  const [addModalActive, setAddModalActive] = useState(false)
  const [configurations, setConfigurations] = useState<AgentConfiguration[]>()
  const [editConfig, setEditConfig] = useState<AgentConfiguration>()
  const [activeTab, setActiveTab] = useState<'agents' | 'events'>('agents')
  const queryClient = useQueryClient()

  const basePath = import.meta.env.VITE_BASE_PATH ?? ''

  useEffect(() => {
    GetApiHandler<AgentConfiguration[]>('/notifications/configurations').then(
      (configs) => setConfigurations(configs),
    )
  }, [])

  const updateAddModalActive = (active: boolean) => {
    setAddModalActive(active)
    GetApiHandler<AgentConfiguration[]>('/notifications/configurations').then(
      (configs) => setConfigurations(configs),
    )
    void queryClient.invalidateQueries({
      queryKey: ['notifications', 'assignments'],
    })
  }

  const doEdit = (id: number) => {
    const config = configurations?.find((c) => c.id === id)

    setEditConfig(config)
    updateAddModalActive(!addModalActive)
  }

  function confirmedDelete(id: any) {
    DeleteApiHandler(`/notifications/configuration/${id}`).then(() => {
      setConfigurations(configurations?.filter((c) => c.id !== id))
      void queryClient.invalidateQueries({
        queryKey: ['notifications', 'assignments'],
      })
    })
  }

  return (
    <>
      <title>Notification settings - Maintainerr</title>
      <div className="h-full w-full">
        <div className="mb-5 mt-6 h-full w-full text-white">
          <h3 className="heading flex items-center gap-2">
            Notification Settings
            <img
              className="h-[1em] w-[2.5em]"
              width={'0'}
              height={'0'}
              src={`${basePath}/beta.svg`}
              alt="BETA"
            />
          </h3>
        </div>

        <div
          className="mb-6 flex border-b border-zinc-700"
          role="tablist"
          aria-label="Notification settings"
        >
          {[
            { id: 'agents' as const, label: 'Agent Configuration' },
            { id: 'events' as const, label: 'Event Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-maintainerr-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => {
                setActiveTab(tab.id)
                setAddModalActive(false)
                setEditConfig(undefined)
                if (tab.id === 'agents') {
                  GetApiHandler<AgentConfiguration[]>(
                    '/notifications/configurations',
                  ).then((configs) => setConfigurations(configs))
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'events' ? (
          <NotificationEvents
            configurations={configurations}
            onAssignmentChanged={(
              notificationId,
              type,
              selected,
              aboutScale,
            ) => {
              setConfigurations((current) =>
                current?.map((configuration) => {
                  if (configuration.id !== notificationId) {
                    return configuration
                  }

                  const types = new Set(configuration.types ?? [])
                  if (selected) types.add(type)
                  else types.delete(type)

                  return {
                    ...configuration,
                    types: [...types],
                    ...(aboutScale !== undefined ? { aboutScale } : {}),
                  }
                }),
              )
            }}
          />
        ) : (
          <>
            <div>
              <ul className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {configurations?.map((config) => (
                  <li
                    key={config.id}
                    className="h-full rounded-xl bg-zinc-800 p-4 text-zinc-400 shadow ring-1 ring-zinc-700"
                  >
                    <div className="mb-2 flex items-center gap-x-3">
                      <div className="text-base font-bold text-white sm:text-lg">
                        {config.name}
                      </div>
                      {!config.enabled && (
                        <div className="rounded bg-maintainerr-600 px-2 py-0.5 text-xs text-zinc-200 shadow-md">
                          Disabled
                        </div>
                      )}
                    </div>

                    <p className="mb-4 space-x-2 truncate text-gray-300">
                      <span className="font-semibold">{config.agent}</span>
                    </p>
                    <div>
                      <Button
                        buttonType="twin-primary-l"
                        buttonSize="md"
                        className="h-10 w-1/2"
                        onClick={() => {
                          if (config.id) {
                            doEdit(config.id)
                          }
                        }}
                      >
                        {<DocumentAddIcon className="m-auto" />}{' '}
                        <p className="m-auto font-semibold">Edit</p>
                      </Button>
                      <DeleteButton
                        onDeleteRequested={() => confirmedDelete(config.id)}
                      />
                    </div>
                  </li>
                ))}

                <li className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-400 bg-zinc-800 p-4 text-zinc-400 shadow">
                  <button
                    type="button"
                    className="add-button m-auto flex h-9 rounded bg-maintainerr-600 px-4 text-zinc-200 shadow-md hover:bg-maintainerr"
                    onClick={() => updateAddModalActive(!addModalActive)}
                  >
                    {<PlusCircleIcon className="m-auto h-5" />}
                    <p className="m-auto ml-1 font-semibold">Add Agent</p>
                  </button>
                </li>
              </ul>
            </div>

            {addModalActive ? (
              <CreateNotificationModal
                onCancel={() => {
                  updateAddModalActive(!addModalActive)
                  setEditConfig(undefined)
                }}
                onSave={(bool) => {
                  updateAddModalActive(!addModalActive)
                  setEditConfig(undefined)
                  if (bool) {
                    toast.success('Successfully saved notification agent')
                  } else {
                    toast.error("Didn't save incomplete notification agent")
                  }
                }}
                onTest={() => {}}
                {...(editConfig
                  ? {
                      selected: {
                        id: editConfig.id!,
                        name: editConfig.name!,
                        enabled: editConfig.enabled!,
                        agent: editConfig.agent!,
                        types: editConfig.types!,
                        options: editConfig.options!,
                        aboutScale: editConfig.aboutScale!,
                      },
                    }
                  : {})}
              />
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

const DeleteButton = ({
  onDeleteRequested,
}: {
  onDeleteRequested: () => void
}) => {
  const [showSureDelete, setShowSureDelete] = useState(false)

  return (
    <Button
      buttonSize="md"
      buttonType="twin-secondary-r"
      className="h-10 w-1/2"
      onClick={() => {
        if (showSureDelete) {
          onDeleteRequested()
          setShowSureDelete(false)
        } else {
          setShowSureDelete(true)
        }
      }}
    >
      {<TrashIcon className="m-auto" />}{' '}
      <p className="m-auto font-semibold">
        {showSureDelete ? <>Are you sure?</> : <>Delete</>}
      </p>
    </Button>
  )
}

export default NotificationSettings

interface NotificationEventsProps {
  configurations?: AgentConfiguration[]
  onAssignmentChanged: (
    notificationId: number,
    type: number,
    selected: boolean,
    aboutScale?: number,
  ) => void
}

const NotificationEvents = ({
  configurations,
  onAssignmentChanged,
}: NotificationEventsProps) => {
  const notificationTypes = useNotificationTypes()
  const setAssignment = useSetNotificationAssignment()

  return (
    <div>
      {notificationTypes.isLoading || configurations === undefined ? (
        <div className="flex min-h-20 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : notificationTypes.data?.length && configurations.length ? (
        <div className="grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {configurations.map((configuration) => (
            <NotificationAgentEvents
              key={configuration.id}
              configuration={configuration}
              notificationTypes={notificationTypes.data}
              isUpdating={setAssignment.isPending}
              onChange={(type, selected, aboutScale) => {
                if (!configuration.id) return

                setAssignment.mutate(
                  {
                    type,
                    id: configuration.id,
                    selected,
                    ...(aboutScale !== undefined ? { aboutScale } : {}),
                  },
                  {
                    onSuccess: () =>
                      onAssignmentChanged(
                        configuration.id!,
                        type,
                        selected,
                        aboutScale,
                      ),
                  },
                )
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {notificationTypes.data?.length
            ? 'No notification agents configured.'
            : 'No notification events available.'}
        </p>
      )}
      {notificationTypes.isError && (
        <Alert type="error" title="Notification events could not be loaded." />
      )}
      {setAssignment.isError && (
        <Alert type="error" title="Notification event could not be updated." />
      )}
    </div>
  )
}

interface NotificationAgentEventsProps {
  configuration: AgentConfiguration
  notificationTypes: NotificationTypeSpec[]
  isUpdating: boolean
  onChange: (type: number, selected: boolean, aboutScale?: number) => void
}

const NotificationAgentEvents = ({
  configuration,
  notificationTypes,
  isUpdating,
  onChange,
}: NotificationAgentEventsProps) => {
  const selectedCount = notificationTypes.filter((type) =>
    (configuration.types ?? []).includes(type.id),
  ).length

  return (
    <section className="flex min-h-48 flex-col rounded-xl bg-zinc-800 p-4 text-zinc-400 shadow ring-1 ring-zinc-700">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-700 text-maintainerr-400">
          <BellIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-zinc-100">
            {configuration.name}
          </h4>
          <p className="mt-0.5 text-xs capitalize text-zinc-500">
            {configuration.agent}
            {!configuration.enabled ? ' / Disabled' : ''}
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">
          {selectedCount} of {notificationTypes.length}
        </span>
      </div>

      <div className="mt-3 divide-y divide-zinc-700">
        {notificationTypes.map((type) => {
          const selected = (configuration.types ?? []).includes(type.id)

          return (
            <div key={type.id} className="py-2.5 first:pt-2">
              <label className="flex min-h-7 cursor-pointer items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {type.title}
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900 text-maintainerr-600 focus:ring-maintainerr-600"
                  checked={selected}
                  disabled={isUpdating}
                  onChange={(event) => onChange(type.id, event.target.checked)}
                />
              </label>
              {type.id === MEDIA_ABOUT_TO_BE_HANDLED && selected && (
                <AboutToHandleSettings
                  key={`${configuration.id}-${configuration.aboutScale ?? 3}`}
                  inputId={`about-scale-${configuration.id}`}
                  value={configuration.aboutScale ?? 3}
                  disabled={isUpdating}
                  onSave={(aboutScale) => onChange(type.id, true, aboutScale)}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const AboutToHandleSettings = ({
  inputId,
  value,
  disabled,
  onSave,
}: {
  inputId: string
  value: number
  disabled: boolean
  onSave: (value: number) => void
}) => {
  const [draft, setDraft] = useState(String(value))

  const parsedValue = Number(draft)
  const isValid =
    draft.trim() !== '' && Number.isInteger(parsedValue) && parsedValue >= 0
  const hasChanged = isValid && parsedValue !== value

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-zinc-900/60 p-2 sm:flex-nowrap">
      <label htmlFor={inputId} className="min-w-0 flex-1 text-xs text-zinc-400">
        Days before handling
      </label>
      <input
        id={inputId}
        type="number"
        min="0"
        step="1"
        value={draft}
        disabled={disabled}
        aria-invalid={!isValid}
        className="h-8 w-20 rounded-md border border-zinc-600 bg-zinc-950 px-2 text-sm text-zinc-100 focus:border-maintainerr-500 focus:ring-maintainerr-500"
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        type="button"
        title="Save days before handling"
        aria-label="Save days before handling"
        disabled={disabled || !hasChanged}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-maintainerr-600 text-white hover:bg-maintainerr disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        onClick={() => onSave(parsedValue)}
      >
        <SaveIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
