import { Transition } from '@headlessui/react'
import { DocumentAddIcon, DocumentRemoveIcon } from '@heroicons/react/solid'
import { MediaItemType } from '@maintainerr/contracts'
import React, { memo, useCallback, useEffect, useState } from 'react'
import GetApiHandler from '../../../utils/ApiHandler'
import AddModal from '../../AddModal'
import RemoveFromCollectionBtn from '../../Collection/CollectionDetail/RemoveFromCollectionBtn'
import Button from '../Button'
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
  collectionId?: number
  isManual?: boolean
  onRemove?: (id: string) => void
}

const MediaCard: React.FC<IMediaCard> = ({
  id,
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
  isManual = false,
  onRemove = () => {},
}) => {
  const [showDetail, setShowDetail] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [excludeModal, setExcludeModal] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [hasExclusion, setHasExclusion] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)

  const openMediaModal = () => {
    setShowMediaModal(true)
  }

  const closeMediaModal = () => setShowMediaModal(false)

  const getExclusions = useCallback(() => {
    if (!collectionPage) {
      GetApiHandler(`/rules/exclusion?mediaServerId=${id}`).then((resp: []) =>
        resp.length > 0 ? setHasExclusion(true) : setHasExclusion(false),
      )
    }
  }, [collectionPage, id])

  useEffect(() => {
    if (tmdbid) {
      const imageType = ['season', 'episode'].includes(mediaType)
        ? 'show'
        : mediaType
      GetApiHandler(`/moviedb/image/${imageType}/${tmdbid}`).then((resp) =>
        setImage(resp),
      )
    }
    getExclusions()
  }, [getExclusions, mediaType, tmdbid])

  // Just to get the year from the date
  const displayYear = year && mediaType !== 'episode' ? year.slice(0, 4) : year

  return (
    <div className={'w-full'}>
      {excludeModal ? (
        <AddModal
          mediaServerId={id}
          {...(libraryId ? { libraryId: libraryId } : {})}
          {...(type ? { type: type } : {})}
          onSubmit={() => {
            setExcludeModal(false)
          }}
          onCancel={() => setExcludeModal(false)}
          modalType="exclude"
        />
      ) : undefined}

      {addModal ? (
        <AddModal
          mediaServerId={id}
          {...(libraryId ? { libraryId: libraryId } : {})}
          {...(type ? { type: type } : {})}
          onSubmit={() => {
            setAddModal(false)
          }}
          onCancel={() => setAddModal(false)}
          modalType="add"
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
          {image ? (
            <img
              className="absolute inset-0 h-full w-full object-cover"
              alt=""
              src={`https://image.tmdb.org/t/p/w300_and_h450_face${image}`}
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
          {hasExclusion && !collectionPage ? (
            <div className="absolute right-0 flex items-center justify-between p-2">
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
                  {'EXCL'}
                </div>
              </div>
            </div>
          ) : undefined}

          {/* on collection page and for manually added */}
          {collectionPage && isManual && !showDetail ? (
            <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 transform items-center justify-between p-2">
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
                  {'MANUAL'}
                </div>
              </div>
            </div>
          ) : undefined}

          {/* on collection page and for the media items */}
          {collectionPage && !exclusionType && daysLeft !== 9999 ? (
            <div className="absolute right-0 flex items-center justify-between p-2">
              <div
                className={`pointer-events-none z-40 rounded-full shadow ${
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

          {/* on collection page and for the exclusions */}
          {collectionPage && exclusionType === 'global' ? (
            <div className="absolute right-0 flex items-center justify-between p-2">
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
                  {exclusionType.toUpperCase()}
                </div>
              </div>
            </div>
          ) : undefined}

          <Transition
            as="div"
            show={!image || showDetail}
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

                  {!collectionPage ? (
                    <div>
                      <Button
                        buttonType="twin-primary-l"
                        buttonSize="md"
                        className="mb-1 mt-2 h-6 w-1/2 text-zinc-200 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation() // Stops the MediaModal from also showing when clicked.
                          setAddModal(true)
                        }}
                      >
                        {<DocumentAddIcon className="m-auto ml-3 h-3" />}{' '}
                        <p className="rules-button-text m-auto mr-2">{'Add'}</p>
                      </Button>
                      <Button
                        buttonSize="md"
                        buttonType="twin-primary-r"
                        className="mt-2 h-6 w-1/2"
                        onClick={(e) => {
                          e.stopPropagation() // Stops the MediaModal from also showing when clicked.
                          setExcludeModal(true)
                        }}
                      >
                        {<DocumentRemoveIcon className="m-auto ml-3 h-3" />}{' '}
                        <p className="rules-button-text m-auto mr-2">
                          {'Excl'}
                        </p>
                      </Button>
                    </div>
                  ) : (
                    <RemoveFromCollectionBtn
                      mediaServerId={id}
                      popup={exclusionType && exclusionType === 'global'}
                      onRemove={() => onRemove(id.toString())}
                      collectionId={collectionId}
                      exclusionId={exclusionId}
                    />
                  )}
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      {!addModal && !excludeModal && showMediaModal && (
        <MediaModalContent
          id={id}
          onClose={closeMediaModal}
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
const propsEqual = (prev: IMediaCard, next: IMediaCard) => prev.id === next.id

export default memo(MediaCard, propsEqual)
