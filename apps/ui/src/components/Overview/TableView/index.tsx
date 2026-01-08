import { useState } from 'react'
import { Tooltip } from 'react-tooltip'
import { SmallLoadingSpinner } from '../../Common/LoadingSpinner'
import MediaModalContent from '../../Common/MediaCard/MediaModal'
import { IPlexMetadata } from '../iPlexMetadata'

interface Props {
  data: IPlexMetadata[]
  extrasLoading?: boolean
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

const OverviewTable = ({ data, extrasLoading }: Props) => {
  const [selected, setSelected] = useState<IPlexMetadata | null>(null)

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-900">
        <table className="w-full text-left text-sm text-zinc-200">
          <thead className="bg-zinc-800 text-zinc-300">
            <tr>
              <th className="w-0 px-2 py-2" />
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Year</th>
              <th className="px-4 py-2">Rating</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => {
              const tooltipId = `excl-table-${item.ratingKey}`
              return (
                <tr
                  key={item.ratingKey}
                  className="border-t border-zinc-800 hover:bg-zinc-800"
                >
                  <td className="px-2 py-2 align-middle">
                    {item.maintainerrExclusionType ? (
                      <>
                        <span
                          className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100"
                          data-tooltip-id={tooltipId}
                          data-tooltip-content={
                            item.maintainerrExclusionLabels?.length
                              ? item.maintainerrExclusionLabels.join(', ')
                              : 'Excluded'
                          }
                        >
                          EXCL
                        </span>
                        <Tooltip
                          id={tooltipId}
                          place="top"
                          className="z-50 max-w-xs whitespace-pre-wrap break-words text-xs"
                        />
                      </>
                    ) : null}
                  </td>

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
                    {item.type}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {getYear(item)}
                  </td>

                  <td className="cursor-text select-text px-4 py-2 align-middle">
                    {item.audienceRating ? item.audienceRating.toFixed(1) : 'ƒ?"'}
                  </td>
                </tr>
              )
            })}
            {extrasLoading ? (
              <tr className="border-t border-zinc-800">
                <td colSpan={5} className="px-4 py-3">
                  <SmallLoadingSpinner />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
        />
      )}
    </>
  )
}

export default OverviewTable
