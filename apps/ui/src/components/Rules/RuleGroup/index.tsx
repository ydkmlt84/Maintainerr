import { PlayIcon, StopIcon, TrashIcon } from '@heroicons/react/solid'
import { MediaItemTypeLabels, type MediaItemType } from '@maintainerr/contracts'
import { isAxiosError } from 'axios'
import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Tooltip } from 'react-tooltip'
import { useMediaServerLibraries } from '../../../api/media-server'
import {
  useExecuteRuleGroup,
  useStopRuleGroupExecution,
} from '../../../api/rules'
import { useTaskStatusContext } from '../../../contexts/taskstatus-context'
import { DeleteApiHandler } from '../../../utils/ApiHandler'
import { logClientError } from '../../../utils/ClientLogger'
import { ICollection } from '../../Collection'
import Modal from '../../Common/Modal'
import { posterTooltipStyle } from '../../Common/ExclusionBadges'
import { AgentConfiguration } from '../../Settings/Notifications/CreateNotificationModal'
import { IRuleJson } from '../Rule'

export interface IRuleGroup {
  id: number
  name: string
  description: string
  libraryId: string
  isActive: boolean
  collectionId: number
  rules: IRuleJson[]
  useRules: boolean
  dataType: MediaItemType
  notifications?: AgentConfiguration[]
  collection?: ICollection
  ruleHandlerCronSchedule?: string | null
}

const RuleGroup = (props: {
  group: IRuleGroup
  onDelete: () => void
  onEdit: (group: IRuleGroup) => void
}) => {
  const [showsureDelete, setShowSureDelete] = useState<boolean>(false)
  const [titleTruncated, setTitleTruncated] = useState(false)
  const titleTooltipId = useId().replace(/:/g, '')
  const titleRef = useRef<HTMLDivElement>(null)
  const { data: libraries } = useMediaServerLibraries()
  const { queueStatus } = useTaskStatusContext()
  const { mutate: executeRules } = useExecuteRuleGroup({
    onError(error) {
      if (isAxiosError(error) && error.response?.data?.message) {
        toast.error(
          error.response.data.message || 'Failed to start rule execution.',
        )
      } else {
        toast.error('Failed to start rule execution.')
      }
    },
  })
  const { mutate: stopExecution } = useStopRuleGroupExecution({
    onSuccess() {
      toast.success('Requested to stop rule execution.')
    },
    onError() {
      toast.error('Failed to request stop of rule execution.')
    },
  })

  const onEdit = () => {
    props.onEdit(props.group)
  }

  const confirmedDelete = () => {
    DeleteApiHandler(`/rules/${props.group.id}`)
      .then((resp) => {
        if (resp.code === 1) {
          setShowSureDelete(false)
          props.onDelete()
        } else toast.error('Failed to delete rule group.')
      })
      .catch((err: unknown) => {
        void logClientError(
          'Failed to delete rule group.',
          err,
          'RuleGroup.confirmedDelete',
        )
        toast.error('Failed to delete rule group. Check logs for details.')
      })
  }

  const isQueued = queueStatus?.queue.includes(props.group.id)
  const ruleExecutingOrQueued =
    queueStatus?.executingRuleGroupId === props.group.id || isQueued
  const hasNoLibrary = !props.group.libraryId || props.group.libraryId === ''

  useEffect(() => {
    const updateTitleTruncation = () => {
      const titleElement = titleRef.current
      setTitleTruncated(
        Boolean(
          titleElement && titleElement.scrollWidth > titleElement.clientWidth,
        ),
      )
    }
    updateTitleTruncation()
    window.addEventListener('resize', updateTitleTruncation)
    return () => window.removeEventListener('resize', updateTitleTruncation)
  }, [props.group.name])

  return (
    <>
      {showsureDelete ? (
        <Modal
          title="Delete rule?"
          size="sm"
          onCancel={() => setShowSureDelete(false)}
          onOk={confirmedDelete}
          cancelText="Cancel"
          okText="Delete"
          okButtonType="danger"
        >
          <p>
            Are you sure you want to delete <strong>{props.group.name}</strong>?
          </p>
        </Modal>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer rounded-xl outline-none focus:ring-2 focus:ring-maintainerr-500/60"
        onClick={onEdit}
        onKeyDown={(event) => {
          if (
            event.currentTarget === event.target &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault()
            onEdit()
          }
        }}
      >
        <div className="inset-0 z-0 h-fit p-3">
          <div>
            <div
              ref={titleRef}
              className="truncate text-base font-bold text-white sm:text-lg"
              data-tooltip-id={titleTooltipId}
            >
              {props.group.name}
            </div>
            <Tooltip
              id={titleTooltipId}
              place="top"
              positionStrategy="fixed"
              portalRoot={document.body}
              opacity={1}
              hidden={!titleTruncated}
              noArrow
              className="max-w-xs"
              style={posterTooltipStyle}
            >
              {props.group.name}
            </Tooltip>
          </div>
          <div className="tiny-scrollbar mb-2 mt-1 h-12 max-h-12 overflow-y-hidden whitespace-normal pr-2 text-base text-zinc-400 hover:overflow-y-auto">
            {props.group.description}
          </div>
        </div>
        <div className="inset-0 z-0 mt-2 px-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 sm:gap-y-2 [&>div:nth-child(2n)]:text-right sm:[&>div:nth-child(2n)]:text-left sm:[&>div:nth-child(3n)]:text-right sm:[&>div:nth-child(3n-1)]:text-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Library
              </p>
              {hasNoLibrary ? (
                <p
                  className="truncate text-red-500"
                  title="Please edit this rule and select a library"
                >
                  Not set
                </p>
              ) : (
                <p className="truncate text-maintainerr">
                  {libraries?.find((lib) => lib.id === props.group.libraryId)
                    ?.title ?? '-'}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Media Type
              </p>
              <p className="text-maintainerr">
                {MediaItemTypeLabels[props.group.dataType]}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Rules
              </p>
              <p className="text-maintainerr">{props.group.rules.length}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Status
              </p>
              <p>
                {props.group.isActive ? (
                  <span className="text-green-500">Active</span>
                ) : (
                  <span className="text-red-500">Inactive</span>
                )}
              </p>
            </div>
            <div className="flex min-w-0 items-end justify-center sm:justify-center">
              {props.group.isActive ? (
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-maintainerr-500/70"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (ruleExecutingOrQueued) {
                      stopExecution(props.group.id)
                    } else {
                      executeRules(props.group.id)
                    }
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  title={
                    ruleExecutingOrQueued
                      ? 'Request stop execution'
                      : 'Start execution'
                  }
                  aria-label={
                    ruleExecutingOrQueued
                      ? 'Request stop execution'
                      : 'Start execution'
                  }
                >
                  {!ruleExecutingOrQueued ? (
                    <PlayIcon className="h-5 w-5" />
                  ) : (
                    <StopIcon
                      className={clsx('h-5 w-5', {
                        'animate-pulse': !isQueued,
                      })}
                    />
                  )}
                </button>
              ) : null}
            </div>
            <div className="flex min-w-0 items-end justify-end">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-950/60 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/70"
                title="Delete rule"
                aria-label="Delete rule"
                onClick={(event) => {
                  event.stopPropagation()
                  setShowSureDelete(true)
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default RuleGroup
