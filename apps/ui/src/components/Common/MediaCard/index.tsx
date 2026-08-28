import { Transition } from '@headlessui/react'
import { AdjustmentsIcon } from '@heroicons/react/outline'
import { MediaItemType } from '@maintainerr/contracts'
import React, { memo, useCallback, useEffect, useId, useState } from 'react'
import GetApiHandler from '../../../utils/ApiHandler'
import { getTmdbImageUrl } from '../../../utils/TmdbImage'
import Button from '../Button'
import CollectionMembershipTooltip from '../CollectionMembershipTooltip'
import ExclusionBadges from '../ExclusionBadges'
import ManageMediaModal, {
  type MediaManagementContext,
} from '../ManageMediaModal'
import MediaModalContent from './MediaModal'

interface IMediaCard {
  id: number | string
  image?: string
  summary?: string
  year?: string
  mediaType: 'movie' | 'show' | 'season' | 'episode'
  title: string
  seasonLabel?: string
  userScore: number
  inProgress?: boolean
  tmdbid?: string
  libraryId?: string
  type?: MediaItemType
  collectionPage: boolean
  daysLeft?: number
  exclusionId?: number
  exclusionType?: 'global' | 'specific' | undefined
  exclusionCollectionTitle?: string
  exclusionExpiresAt?: string
  reviewExclusion?: boolean
  collectionId?: number
  isManual?: boolean
  manualFilter?: boolean
  leavingSoonFilter?: boolean
  countdownCollectionNames?: string[]
  onRemove?: (id: string) => void
}

const MediaCard: React.FC<IMediaCard> = ({
  id,
  image: imagePath,
  summary,
  year,
  mediaType,
  title,
  seasonLabel,
  libraryId,
  type,
  collectionId = 0,
  daysLeft = 9999,
  exclusionId = undefined,
  tmdbid = undefined,
  userScore,
  collectionPage = false,
  exclusionType = undefined,
  exclusionCollectionTitle,
  exclusionExpiresAt,
  reviewExclusion = false,
  isManual = false,
  manualFilter = false,
  leavingSoonFilter = false,
  countdownCollectionNames = [],
  onRemove = () => {},
}) => {
  const [showDetail, setShowDetail] = useState(false)
  const [failedPosterUrl, setFailedPosterUrl] = useState<string>()
  const [exclusions, setExclusions] = useState<
    MediaManagementContext['exclusions']
  >(() =>
    reviewExclusion && exclusionId
      ? [
          {
            id: exclusionId,
            scope: exclusionType === 'global' ? 'global' : 'collection',
            collectionId,
            collectionTitle: exclusionCollectionTitle ?? null,
            ruleGroupName: null,
            expiresAt: exclusionExpiresAt ?? null,
          },
        ]
      : [],
  )
  const [manageModal, setManageModal] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [hasManualMembership, setHasManualMembership] = useState(isManual)
  const [memberships, setMemberships] = useState<
    MediaManagementContext['memberships']
  >([])
  const daysLeftTooltipId = useId().replace(/:/g, '')

  const openMediaModal = () => {
    setShowMediaModal(true)
  }

  const closeMediaModal = () => setShowMediaModal(false)

  const getExclusions = useCallback(() => {
    GetApiHandler<MediaManagementContext>(`/collections/media-context/${id}`)
      .then((context) => {
        setExclusions(context.exclusions)
        setMemberships(context.memberships)
        setHasManualMembership(
          context.memberships.some((membership) => membership.isManual),
        )
      })
      .catch(() => {
        setExclusions([])
        setMemberships([])
        setHasManualMembership(isManual)
      })
  }, [id, isManual])

  const handleContextChanged = useCallback(
    (context: MediaManagementContext) => {
      setExclusions(context.exclusions)
      setMemberships(context.memberships)
      setHasManualMembership(
        context.memberships.some((membership) => membership.isManual),
      )
    },
    [],
  )

  useEffect(() => {
    getExclusions()
  }, [getExclusions])

  const imageType = ['season', 'episode'].includes(mediaType)
    ? 'show'
    : mediaType
  const posterUrl = tmdbid
    ? getTmdbImageUrl({
        scope: 'library',
        variant: 'poster',
        type: imageType,
        tmdbId: tmdbid,
        imagePath,
      })
    : undefined

  const posterFailed = posterUrl === failedPosterUrl

  // Just to get the year from the date
  const displayYear = year && mediaType !== 'episode' ? year.slice(0, 4) : year

  return (
    <div className={'w-full'}>
      {manageModal ? (
        <ManageMediaModal
          mediaServerId={id}
          title={title}
          type={type}
          libraryId={libraryId}
          contextCollectionId={collectionId || undefined}
          contextCollectionTitle={exclusionCollectionTitle}
          contextExclusionId={reviewExclusion ? exclusionId : undefined}
          removeFromViewWhenNoManualMemberships={manualFilter}
          removeFromViewWhenNoExclusions={reviewExclusion}
          removeFromViewAfterExclusion={
            leavingSoonFilter || (collectionPage && !reviewExclusion)
          }
          onClose={() => setManageModal(false)}
          onContextChanged={handleContextChanged}
          onRemoveFromView={() =>
            onRemove(
              reviewExclusion && exclusionId
                ? `exclusion:${exclusionId}`
                : id.toString(),
            )
          }
        />
      ) : undefined}
      <div
        className={`media-card relative transform-gpu cursor-pointer overflow-hidden rounded-xl bg-zinc-800 bg-cover pb-[150%] outline-none ring-1 transition duration-300 ${showDetail ? 'show-detail' : ''}`}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        onClick={() => {
          if (showDetail) {
            openMediaModal()
          } else {
            setShowDetail(true) // First tap on mobile shows buttons
          }
        }}
        role="link"
        tabIndex={0}
      >
        <div className="absolute inset-0 h-full w-full overflow-hidden">
          {posterUrl && !posterFailed ? (
            <img
              className="absolute inset-0 h-full w-full object-cover"
              alt=""
              src={posterUrl}
              onError={() => setFailedPosterUrl(posterUrl)}
            />
          ) : undefined}
          <div className="absolute left-0 right-0 flex items-center justify-between p-2">
            <div
              className={`pointer-events-none z-40 rounded-full shadow ${
                mediaType === 'movie'
                  ? 'bg-slate-950/90 ring-1 ring-slate-500/30'
                  : mediaType === 'show'
                    ? 'bg-maintainerrdark/90 ring-1 ring-maintainerr-600/30'
                    : mediaType === 'season'
                      ? 'bg-maintainerr-800/90 ring-1 ring-maintainerr-500/30'
                      : 'bg-indigo-900/90 ring-1 ring-indigo-400/30'
              }`}
            >
              <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-200 sm:h-5">
                {mediaType}
              </div>
            </div>
          </div>
          <ExclusionBadges
            exclusions={exclusions}
            className={daysLeft !== 9999 ? 'top-7' : ''}
          />

          {hasManualMembership ? (
            <div className="pointer-events-none absolute bottom-0 left-0 h-14 w-14 overflow-hidden">
              <span className="absolute -left-5 bottom-3 w-20 rotate-45 bg-maintainerrdark-700/90 py-0.5 text-center text-[8px] font-semibold uppercase tracking-wider text-maintainerr-100">
                Manual
              </span>
            </div>
          ) : null}

          {/* on collection page and for the media items */}
          {!exclusionType && daysLeft !== 9999 ? (
            <div className="absolute right-0 z-40 flex items-center justify-between p-2">
              <div
                data-tooltip-id={daysLeftTooltipId}
                className={`pointer-events-auto z-40 rounded-full shadow ${
                  daysLeft < 0
                    ? 'bg-red-700'
                    : mediaType === 'movie'
                      ? 'bg-slate-950/90 ring-1 ring-slate-500/30'
                      : mediaType === 'show'
                        ? 'bg-maintainerrdark/90 ring-1 ring-maintainerr-600/30'
                        : mediaType === 'season'
                          ? 'bg-maintainerr-800/90 ring-1 ring-maintainerr-500/30'
                          : 'bg-indigo-900/90 ring-1 ring-indigo-400/30'
                } `}
              >
                <div className="flex h-4 items-center px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-200 sm:h-5">
                  {daysLeft}
                </div>
              </div>
            </div>
          ) : undefined}
          {!exclusionType && daysLeft !== 9999 ? (
            <CollectionMembershipTooltip
              id={daysLeftTooltipId}
              memberships={memberships}
              fallbackCollectionNames={
                exclusionCollectionTitle
                  ? [exclusionCollectionTitle, ...countdownCollectionNames]
                  : countdownCollectionNames
              }
            />
          ) : null}

          <Transition
            as="div"
            show={!posterUrl || posterFailed || showDetail}
            className="absolute inset-0 transform cursor-alias overflow-hidden rounded-xl transition"
            enter="opacity-0"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="opacity-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="absolute inset-0 h-full w-full overflow-hidden text-left"
              style={{
                background:
                  'linear-gradient(180deg, rgba(15, 23, 42, 0.34) 0%, rgba(2, 6, 23, 0.94) 100%)',
              }}
            >
              <div className="flex h-full w-full items-end">
                <div className={`w-full px-2 pb-1 text-zinc-200`}>
                  {displayYear && (
                    <div className="text-sm font-medium">{displayYear}</div>
                  )}

                  <h1
                    className="w-full whitespace-normal text-sm font-bold leading-tight"
                    style={{
                      WebkitLineClamp: 3,
                      display: '-webkit-box',
                      overflow: 'hidden',
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                    }}
                  >
                    {title}
                  </h1>
                  {seasonLabel && ['season', 'episode'].includes(mediaType) && (
                    <div className="mt-0.5 text-xs font-semibold text-zinc-200">
                      {seasonLabel}
                    </div>
                  )}
                  {mediaType == 'episode' && (
                    <div
                      className="whitespace-normal text-xs"
                      style={{
                        WebkitLineClamp: 5,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                      }}
                    >
                      {summary}
                    </div>
                  )}

                  <Button
                    buttonType="primary"
                    buttonSize="md"
                    className="mb-1 mt-2 h-7 w-full text-zinc-100 shadow-md"
                    onClick={(e) => {
                      e.stopPropagation()
                      setManageModal(true)
                    }}
                  >
                    <AdjustmentsIcon className="mr-1.5 h-3.5 w-3.5" />
                    Manage
                  </Button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      {!manageModal && showMediaModal && (
        <MediaModalContent
          id={id}
          onClose={closeMediaModal}
          onManage={() => {
            setShowMediaModal(false)
            setManageModal(true)
          }}
          title={title}
          summary={summary || 'No description available.'}
          mediaType={mediaType}
          tmdbid={tmdbid}
          year={displayYear}
          userScore={userScore}
        />
      )}
    </div>
  )
}

export default memo(MediaCard)
