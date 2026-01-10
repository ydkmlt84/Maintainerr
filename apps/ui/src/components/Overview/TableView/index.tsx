import { DocumentAddIcon, DocumentRemoveIcon } from '@heroicons/react/solid'
import { debounce } from 'lodash-es'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tooltip } from 'react-tooltip'
import AddModal from '../../AddModal'
import Button from '../../Common/Button'
import { SmallLoadingSpinner } from '../../Common/LoadingSpinner'
import MediaModalContent from '../../Common/MediaCard/MediaModal'
import { IPlexMetadata } from '../iPlexMetadata'

interface Props {
  data: IPlexMetadata[]
  extrasLoading?: boolean
  libraryId: number
  onDataChanged?: () => void | Promise<void>
  fetchData: () => void
  dataFinished: boolean
}

const getTitle = (item: IPlexMetadata) =>
  item.grandparentTitle || item.parentTitle || item.title

const getYear = (item: IPlexMetadata) => {
  if (item.type === 'episode') return item.parentTitle ?? ''
  const raw = item.parentYear?.toString() ?? item.year?.toString() ?? ''
  return raw ? raw.slice(0, 4) : ''
}

const getTmdbId = (item: IPlexMetadata) => {
  const id = item.parentData
    ? item.parentData.Guid?.find((e) => e.id?.includes('tmdb'))?.id
    : item.Guid?.find((e) => e.id?.includes('tmdb'))?.id

  return id?.split('tmdb://')[1]
}

const toCardType = (t: IPlexMetadata['type']): 1 | 2 | 3 | 4 =>
  t === 'movie' ? 1 : t === 'show' ? 2 : t === 'season' ? 3 : 4

const OverviewTable = ({
  data,
  extrasLoading,
  libraryId,
  onDataChanged,
  fetchData,
  dataFinished,
}: Props) => {
  const [selected, setSelected] = useState<IPlexMetadata | null>(null)
  const [addModal, setAddModal] = useState<{
    type: 'add' | 'exclude'
    media: IPlexMetadata
  } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight * 0.8
    if (atBottom && !extrasLoading && !dataFinished) {
      fetchData()
    }
  }, [dataFinished, extrasLoading, fetchData])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const debounced = debounce(handleScroll, 150)
    el.addEventListener('scroll', debounced, { passive: true })
    return () => {
      el.removeEventListener('scroll', debounced)
      debounced.cancel()
    }
  }, [handleScroll])

  useEffect(() => {
    const root = containerRef.current
    const target = sentinelRef.current
    if (!root || !target) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !extrasLoading && !dataFinished) {
            fetchData()
          }
        })
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [dataFinished, extrasLoading, fetchData])

  return (
    <>
      <style>
        {`
          /* Hide scrollbar for WebKit browsers */
          [data-table-scroll]::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      <div
        ref={containerRef}
        className="h-[calc(100vh-10rem)] overflow-x-auto overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{ scrollbarWidth: 'none' }}
        data-table-scroll
      >
        <table className="w-full text-left text-sm text-zinc-200">
          <thead className="sticky top-0 z-0 border-b border-zinc-700 bg-zinc-800 text-zinc-300">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Year</th>
              <th className="px-4 py-2">Rating</th>
              <th className="px-4 py-2">Views</th>
              <th className="px-4 py-2">Last Viewed</th>
              <th className="px-4 py-2">Days Left</th>
              <th className="px-4 py-2">Collections</th>
              <th className="w-0 px-2 py-2" />
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => {
              const exclusionTooltipId = `excl-table-${item.ratingKey}`
              const manualTooltipId = `manual-table-${item.ratingKey}`
              const manualCollections =
                item.maintainerrCollections?.filter((c) => c.isManual) ?? []
              const collections = item.maintainerrCollections ?? []
              const views =
                item.viewCount ??
                (item.type === 'show' ? item.viewedLeafCount : undefined)
              const lastViewed =
                views && views > 0 && item.lastViewedAt != null
                  ? new Date(item.lastViewedAt * 1000).toLocaleDateString()
                  : undefined
              const daysLeft =
                item.maintainerrDaysLeft ??
                Math.min(
                  ...collections
                    .map((c) => c.daysLeft)
                    .filter(
                      (d): d is number => d !== undefined && !Number.isNaN(d),
                    ),
                  Number.POSITIVE_INFINITY,
                )
              const displayDaysLeft =
                daysLeft === Number.POSITIVE_INFINITY ? undefined : daysLeft
              return (
                <tr
                  key={item.ratingKey}
                  className="border-t border-zinc-800 hover:bg-zinc-800"
                >
                  <td className="px-4 py-2 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelected(item)
                      }}
                      className="cursor-alias text-left font-medium text-zinc-100 hover:underline"
                    >
                      {getTitle(item)}
                    </button>
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {getYear(item)}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {item.audienceRating ? item.audienceRating.toFixed(1) : '–'}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {views !== undefined ? views : '–'}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {lastViewed ?? '–'}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {displayDaysLeft !== undefined ? displayDaysLeft : '–'}
                  </td>

                  <td className="px-4 py-2 align-middle">
                    {collections.length > 0 ? (
                      <ul className="max-h-20 list-disc space-y-1 overflow-hidden text-ellipsis whitespace-normal pl-4 text-xs text-zinc-200">
                        {collections.map((c, idx) => (
                          <li key={`${item.ratingKey}-col-${idx}`}>
                            {c.id ? (
                              <Link
                                to={`/collections/${c.id}`}
                                className="text-amber-200 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.title}
                              </Link>
                            ) : (
                              c.title
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500">–</span>
                    )}
                  </td>

                  <td className="px-2 py-2 align-middle">
                    <div className="flex items-center gap-1">
                      {item.maintainerrExclusionType ? (
                        <>
                          <span
                            className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100"
                            data-tooltip-id={exclusionTooltipId}
                          >
                            EXCL
                          </span>
                          <Tooltip
                            id={exclusionTooltipId}
                            place="top"
                            className="z-50 max-w-xs rounded-md border-2 border-zinc-500 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg"
                            render={() => (
                              <div className="space-y-2">
                                <div className="text-[11px] font-semibold text-amber-300">
                                  Excluded From
                                </div>
                                <ul className="list-disc space-y-1 pl-4">
                                  {(
                                    item.maintainerrExclusionLabels ?? [
                                      'Excluded',
                                    ]
                                  ).map((label, idx) => (
                                    <li key={`${exclusionTooltipId}-${idx}`}>
                                      {label}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          />
                        </>
                      ) : null}
                      {item.maintainerrIsManual ? (
                        <>
                          <span
                            className="inline-flex items-center rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100"
                            data-tooltip-id={manualTooltipId}
                          >
                            MANUAL
                          </span>
                          <Tooltip
                            id={manualTooltipId}
                            place="top"
                            className="z-50 max-w-xs rounded-md border-2 border-zinc-500 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 shadow-lg"
                            render={() => (
                              <div className="space-y-2">
                                <div className="text-[11px] font-semibold text-emerald-300">
                                  Manually Added To
                                </div>
                                <ul className="list-disc space-y-1 pl-4">
                                  {manualCollections.length > 0 ? (
                                    manualCollections.map((c, idx) => (
                                      <li key={`${manualTooltipId}-${idx}`}>
                                        {c.title}
                                      </li>
                                    ))
                                  ) : (
                                    <li key={`${manualTooltipId}-none`}>
                                      Manual Collection
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-2 text-right align-middle">
                    <div className="inline-flex gap-1">
                      <Button
                        buttonType="twin-primary-l"
                        buttonSize="sm"
                        className="h-7 px-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAddModal({ type: 'add', media: item })
                        }}
                      >
                        <DocumentAddIcon className="m-auto mr-1 h-4" />
                        <span className="text-xs font-semibold uppercase">
                          Add
                        </span>
                      </Button>
                      <Button
                        buttonType="twin-primary-r"
                        buttonSize="sm"
                        className="h-7 px-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAddModal({ type: 'exclude', media: item })
                        }}
                      >
                        <DocumentRemoveIcon className="m-auto mr-1 h-4" />
                        <span className="text-xs font-semibold uppercase">
                          Excl
                        </span>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {extrasLoading ? (
              <tr className="border-t border-zinc-800">
                <td colSpan={9} className="px-4 py-3">
                  <SmallLoadingSpinner />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div ref={sentinelRef} className="h-2 w-full" />
      </div>

      {addModal ? (
        <AddModal
          plexId={+addModal.media.ratingKey}
          libraryId={libraryId}
          type={toCardType(addModal.media.type)}
          onSubmit={async () => {
            setAddModal(null)
            await onDataChanged?.()
          }}
          onCancel={() => setAddModal(null)}
          modalType={addModal.type}
        />
      ) : null}

      {selected && (
        <MediaModalContent
          id={+selected.ratingKey}
          onClose={() => setSelected(null)}
          title={getTitle(selected)}
          summary={selected.summary || 'No description available.'}
          mediaType={selected.type}
          tmdbid={getTmdbId(selected)}
          year={getYear(selected)}
          userScore={selected.audienceRating ? selected.audienceRating : 0}
          exclusionType={selected.maintainerrExclusionType}
          exclusionLabels={selected.maintainerrExclusionLabels}
          exclusionTargets={selected.maintainerrExclusionTargets}
          collections={selected.maintainerrCollections}
        />
      )}
    </>
  )
}

export default OverviewTable
