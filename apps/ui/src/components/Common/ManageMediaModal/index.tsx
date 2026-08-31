import {
  RectangleStackIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import { type MediaItemType } from '@maintainerr/contracts'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import GetApiHandler, {
  DeleteApiHandler,
  PostApiHandler,
} from '../../../utils/ApiHandler'
import AddModal from '../../AddModal'
import type { IAddModalResult } from '../../AddModal/interfaces'
import Button from '../Button'
import { ExclusionChoices } from '../ExclusionOptionsModal'
import LoadingSpinner from '../LoadingSpinner'
import Modal from '../Modal'

export interface MediaManagementContext {
  memberships: {
    collectionId: number
    collectionTitle: string
    collectionActive: boolean
    ruleGroupActive: boolean | null
    isDirect: boolean
    addedAt: string
    isManual: boolean
    deleteAfterDays: number | null
    scheduledFor: string | null
    arrAction: number
    ruleGroupName: string | null
  }[]
  exclusions: {
    id: number
    scope: 'global' | 'collection'
    collectionId: number | null
    collectionTitle: string | null
    ruleGroupName: string | null
    expiresAt: string | null
  }[]
}

interface ManageMediaModalProps {
  mediaServerId: number | string
  title: string
  type?: MediaItemType
  libraryId?: string
  contextCollectionId?: number
  contextCollectionTitle?: string
  contextExclusionId?: number
  removeFromViewWhenNoManualMemberships?: boolean
  removeFromViewWhenNoExclusions?: boolean
  removeFromViewAfterExclusion?: boolean
  onClose: () => void
  onRemoveFromView?: (change?: {
    exclusionScope?: 'collection' | 'global'
  }) => void
  onContextChanged?: (context: MediaManagementContext) => void
}

interface ExclusionCollectionOption {
  id: number
  title: string
  status?: 'Inactive'
}

interface ExclusionRuleGroup {
  isActive?: boolean
  dataType: MediaItemType
  collection?: {
    id: number
    title: string
    isActive?: boolean
    arrAction: number
  }
}

type Confirmation =
  | {
      type: 'membership'
      id: number
      label: string
    }
  | {
      type: 'exclusion'
      id: number
      label: string
    }

const formatExpiration = (value: string | null): string => {
  if (!value) return 'Permanent'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Temporary'
  return `Until ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`
}

const getDaysLeft = (
  scheduledFor: string | null,
  arrAction: number,
  active: boolean,
): number | undefined => {
  if (!active || !scheduledFor || arrAction === 4) return undefined
  const scheduled = new Date(scheduledFor)
  if (Number.isNaN(scheduled.getTime())) return undefined
  return Math.ceil((scheduled.getTime() - Date.now()) / 86400000)
}

const ManageMediaModal = ({
  mediaServerId,
  title,
  type,
  libraryId,
  contextCollectionId,
  contextCollectionTitle,
  contextExclusionId,
  removeFromViewWhenNoManualMemberships = false,
  removeFromViewWhenNoExclusions = false,
  removeFromViewAfterExclusion = false,
  onClose,
  onRemoveFromView,
  onContextChanged,
}: ManageMediaModalProps) => {
  const [context, setContext] = useState<MediaManagementContext>()
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [addWorkflow, setAddWorkflow] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation>()
  const [exclusionCollections, setExclusionCollections] = useState<
    ExclusionCollectionOption[]
  >([])
  const [selectedExclusionCollectionId, setSelectedExclusionCollectionId] =
    useState<number>()

  const fetchContext = useCallback(async () => {
    try {
      const nextContext = await GetApiHandler<MediaManagementContext>(
        `/collections/media-context/${mediaServerId}?includeRelated=true`,
      )
      setContext(nextContext)
      onContextChanged?.(nextContext)
      return nextContext
    } catch {
      const emptyContext: MediaManagementContext = {
        memberships: [],
        exclusions: [],
      }
      setContext(emptyContext)
      onContextChanged?.(emptyContext)
      return emptyContext
    } finally {
      setLoading(false)
    }
  }, [mediaServerId, onContextChanged])

  const refreshContext = useCallback(async () => {
    setLoading(true)
    return fetchContext()
  }, [fetchContext])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchContext(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [fetchContext])

  useEffect(() => {
    if (!type) return
    let active = true
    const query = new URLSearchParams({ activeOnly: 'false' })
    if (libraryId) query.set('libraryId', libraryId)

    GetApiHandler<ExclusionRuleGroup[]>(`/rules?${query.toString()}`)
      .then((groups) => {
        if (!active) return
        const acceptsMediaType = (groupType: MediaItemType) =>
          groupType === type ||
          (type === 'show' && ['season', 'episode'].includes(groupType)) ||
          (type === 'season' && groupType === 'episode')
        const options = groups
          .filter(
            (group) => group.collection && acceptsMediaType(group.dataType),
          )
          .map((group) => ({
            id: group.collection!.id,
            title: group.collection!.title,
            status:
              group.isActive === false || group.collection!.isActive === false
                ? ('Inactive' as const)
                : undefined,
          }))
          .filter(
            (option, index, options) =>
              options.findIndex((item) => item.id === option.id) === index,
          )
        setExclusionCollections(options)
        setSelectedExclusionCollectionId((current) =>
          current && options.some((option) => option.id === current)
            ? current
            : options[0]?.id,
        )
      })
      .catch(() => {
        if (active) setExclusionCollections([])
      })

    return () => {
      active = false
    }
  }, [libraryId, type])

  useEffect(() => {
    if (!confirmation) return
    const confirmationKey = `${confirmation.type}:${confirmation.id}`
    const clearConfirmation = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(`[data-removal-confirmation="${confirmationKey}"]`)
      ) {
        return
      }
      setConfirmation(undefined)
    }
    document.addEventListener('pointerdown', clearConfirmation)
    return () => document.removeEventListener('pointerdown', clearConfirmation)
  }, [confirmation])

  const showActionToast = (result: IAddModalResult) => {
    const collection = result.collectionTitle
      ? ` ${result.collectionTitle}`
      : ''
    toast.success(
      result.modalType === 'exclude'
        ? `Exclusions updated for ${title}.`
        : result.action === 'add'
          ? `${title} added to${collection}.`
          : `${title} removed from${collection}.`,
    )
  }

  const finishWorkflow = async (result: IAddModalResult) => {
    showActionToast(result)
    setAddWorkflow(false)
    await refreshContext()
  }

  const removeConfirmedItem = async () => {
    if (!confirmation) return
    setWorking(true)
    try {
      if (confirmation.type === 'membership') {
        if (type) {
          await PostApiHandler('/collections/media/add', {
            mediaId: mediaServerId,
            context: { id: mediaServerId, type },
            collectionId: confirmation.id,
            action: 1,
          })
        } else {
          await DeleteApiHandler(
            `/collections/media?mediaId=${mediaServerId}&collectionId=${confirmation.id}`,
          )
        }
      } else {
        await DeleteApiHandler(`/rules/exclusion-family/${confirmation.id}`)
      }

      toast.success(`${confirmation.label} removed for ${title}.`)
      const removedFromCurrentView =
        (confirmation.type === 'membership' &&
          confirmation.id === contextCollectionId) ||
        (confirmation.type === 'exclusion' &&
          !removeFromViewWhenNoExclusions &&
          confirmation.id === contextExclusionId)

      setConfirmation(undefined)
      if (removedFromCurrentView) {
        onRemoveFromView?.()
        onClose()
      } else {
        const nextContext = await refreshContext()
        if (
          removeFromViewWhenNoManualMemberships &&
          !nextContext.memberships.some((membership) => membership.isManual)
        ) {
          onRemoveFromView?.()
          onClose()
        } else if (
          removeFromViewWhenNoExclusions &&
          nextContext.exclusions.length === 0
        ) {
          onRemoveFromView?.()
          onClose()
        }
      }
    } catch {
      toast.error(`Unable to update ${title}.`)
    } finally {
      setWorking(false)
    }
  }

  const addContextExclusion = async (
    scope: 'collection' | 'global',
    expiresInDays?: number,
  ) => {
    const hasContextMembership = context?.memberships.some(
      (membership) => membership.collectionId === contextCollectionId,
    )
    const collectionId = hasContextMembership
      ? contextCollectionId
      : selectedExclusionCollectionId
    if (scope === 'collection' && !collectionId) return
    setWorking(true)
    try {
      if (type) {
        await PostApiHandler('/collections/media/add', {
          mediaId: mediaServerId,
          context: { id: mediaServerId, type },
          ...(scope === 'collection' ? { collectionId } : {}),
          action: 1,
        })
      } else {
        await DeleteApiHandler(
          `/collections/media?mediaId=${mediaServerId}${
            scope === 'collection' ? `&collectionId=${collectionId}` : ''
          }`,
        )
      }
      await PostApiHandler('/rules/exclusion', {
        ...(scope === 'collection' ? { collectionId } : {}),
        mediaId: mediaServerId,
        ...(type ? { context: { id: mediaServerId, type } } : {}),
        action: 0,
        ...(expiresInDays ? { expiresInDays } : {}),
      })
      toast.success(`Exclusion added for ${title}.`)
      await refreshContext()
      if (removeFromViewAfterExclusion && !removeFromViewWhenNoExclusions) {
        onRemoveFromView?.({ exclusionScope: scope })
      }
    } catch {
      toast.error(`Unable to exclude ${title}.`)
    } finally {
      setWorking(false)
    }
  }

  if (addWorkflow) {
    return (
      <AddModal
        mediaServerId={mediaServerId}
        {...(libraryId ? { libraryId } : {})}
        {...(type ? { type } : {})}
        modalType="add"
        addOnly
        onCancel={() => setAddWorkflow(false)}
        onSubmit={(result) => void finishWorkflow(result)}
        onError={() => toast.error(`Unable to update ${title}.`)}
      />
    )
  }

  const contextMembership = context?.memberships.find(
    (membership) => membership.collectionId === contextCollectionId,
  )

  return (
    <Modal
      title={title}
      size="lg"
      onCancel={onClose}
      cancelText="Close"
      backgroundClickable={!working}
    >
      {loading ? (
        <div className="py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <Button
              buttonType="primary"
              className="w-full"
              onClick={() => setAddWorkflow(true)}
            >
              <RectangleStackIcon className="mr-2 h-4 w-4" />
              Add to Collection
            </Button>
          </div>

          <section className="rounded-lg border border-zinc-600 bg-zinc-800 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Remove &amp; Exclude
            </p>
            {contextMembership ? (
              <p className="mt-1 text-sm text-zinc-300">
                {contextCollectionTitle ?? contextMembership.collectionTitle}
              </p>
            ) : exclusionCollections.length ? (
              <label className="mt-2 block text-xs font-medium text-zinc-300">
                Collection for &ldquo;This Collection&rdquo; actions
                <select
                  className="mt-1 block w-full rounded-md border-zinc-600 bg-zinc-700 text-sm text-white focus:border-maintainerr-500 focus:ring-maintainerr-500"
                  value={selectedExclusionCollectionId ?? ''}
                  onChange={(event) =>
                    setSelectedExclusionCollectionId(+event.target.value)
                  }
                >
                  {exclusionCollections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                      {collection.status ? ` (${collection.status})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                No actionable collections are available for this media type.
                Global exclusions remain available.
              </p>
            )}
            <ExclusionChoices
              className="mt-3"
              excluding={working}
              collectionDisabled={
                !contextMembership && !selectedExclusionCollectionId
              }
              onExclude={(scope, expiresInDays) =>
                void addContextExclusion(scope, expiresInDays)
              }
            />
            {working ? (
              <p className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-maintainerr-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-maintainerr-300 border-t-transparent" />
                Saving changes…
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Collections
            </h3>
            {context?.memberships.length ? (
              <div className="mt-2 divide-y divide-zinc-700 rounded-lg border border-zinc-600 bg-zinc-800 px-3">
                {context.memberships.map((membership) => {
                  const daysLeft = getDaysLeft(
                    membership.scheduledFor,
                    membership.arrAction,
                    membership.collectionActive &&
                      membership.ruleGroupActive !== false,
                  )
                  const confirming =
                    confirmation?.type === 'membership' &&
                    confirmation.id === membership.collectionId
                  return (
                    <div
                      key={membership.collectionId}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/collections/${membership.collectionId}`}
                          onClick={onClose}
                          className="block truncate font-medium text-maintainerr-400 hover:text-maintainerr-300"
                        >
                          {membership.collectionTitle}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {membership.isManual
                            ? membership.isDirect
                              ? 'Added manually'
                              : 'Related media added manually'
                            : membership.isDirect
                              ? 'Added by rule'
                              : 'Related media added by rule'}
                        </p>
                        {!membership.collectionActive ||
                        membership.ruleGroupActive === false ? (
                          <span className="mt-1 inline-flex rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {daysLeft !== undefined ? (
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${
                              daysLeft <= 0
                                ? 'bg-red-600'
                                : 'bg-maintainerr-600'
                            }`}
                            title={`${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                          >
                            {daysLeft <= 0 ? 'Due now' : `${daysLeft}d left`}
                          </span>
                        ) : null}
                        {membership.isManual ? (
                          <Button
                            data-removal-confirmation={`membership:${membership.collectionId}`}
                            buttonType="danger"
                            buttonSize="sm"
                            disabled={working}
                            onClick={() =>
                              confirming
                                ? void removeConfirmedItem()
                                : setConfirmation({
                                    type: 'membership',
                                    id: membership.collectionId,
                                    label: membership.collectionTitle,
                                  })
                            }
                          >
                            {confirming ? 'Are you sure?' : 'Remove'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-500">
                Not currently in a Maintainerr collection.
              </p>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <ShieldExclamationIcon className="h-4 w-4" />
              Exclusions
            </h3>
            {context?.exclusions.length ? (
              <div className="mt-2 divide-y divide-zinc-700 rounded-lg border border-zinc-600 bg-zinc-800 px-3">
                {context.exclusions.map((exclusion) => {
                  const confirming =
                    confirmation?.type === 'exclusion' &&
                    confirmation.id === exclusion.id
                  return (
                    <div
                      key={exclusion.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {exclusion.scope === 'global'
                            ? 'All collections'
                            : (exclusion.collectionTitle ??
                              exclusion.ruleGroupName ??
                              'Collection exclusion')}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatExpiration(exclusion.expiresAt)}
                        </p>
                      </div>
                      <Button
                        data-removal-confirmation={`exclusion:${exclusion.id}`}
                        buttonType="danger"
                        buttonSize="sm"
                        disabled={working}
                        onClick={() =>
                          confirming
                            ? void removeConfirmedItem()
                            : setConfirmation({
                                type: 'exclusion',
                                id: exclusion.id,
                                label:
                                  exclusion.scope === 'global'
                                    ? 'Global exclusion'
                                    : 'Collection exclusion',
                              })
                        }
                      >
                        {confirming ? 'Are you sure?' : 'Remove'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-500">
                No active exclusions.
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

export default ManageMediaModal
