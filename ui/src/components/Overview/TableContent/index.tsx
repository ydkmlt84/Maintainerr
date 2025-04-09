import { FlagIcon, GlobeAltIcon } from '@heroicons/react/outline'
import React, { useState } from 'react'
import MediaModalContent from '../../Common/MediaCard/MediaModal'
import { IPlexMetadata } from '../Content'

interface TableViewProps {
  data: IPlexMetadata[]
}

const TableView: React.FC<TableViewProps> = ({ data }) => {
  const [selectedItem, setSelectedItem] = useState<IPlexMetadata | null>(null)

  const openModal = (item: IPlexMetadata) => setSelectedItem(item)
  const closeModal = () => setSelectedItem(null)

  const extractTmdbId = (item: IPlexMetadata): string | undefined => {
    const guidList = item.Guid ?? []
    const tmdbGuid = guidList.find((g) => g.id.startsWith('tmdb://'))
    return tmdbGuid?.id.replace('tmdb://', '')
  }

  return (
    <div className="relative overflow-x-auto rounded-lg border border-zinc-700">
      <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
        <table className="min-w-full table-auto text-left text-sm text-white">
          <thead className="bg-zinc-800 text-xs uppercase text-zinc-400">
            <tr className="sticky top-0 z-0 bg-zinc-800">
              <th className="px-4 py-3 text-amber-600">Title</th>
              <th className="px-4 py-3 text-amber-600">Year</th>
              <th className="px-4 py-3 text-center text-amber-600">PlexID</th>
              <th className="px-4 py-3 text-amber-600">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-700">
            {data.map((item) => {
              const title =
                item.grandparentTitle || item.parentTitle || item.title

              return (
                <tr
                  key={item.ratingKey}
                  className="transition focus-within:bg-zinc-800 hover:bg-zinc-800"
                >
                  <td className="flex items-center px-2 py-2" title={title}>
                    {item.maintainerrExclusionType && (
                      <span
                        className="mr-2 text-sm"
                        title={
                          item.maintainerrExclusionType === 'global'
                            ? 'Excluded globally'
                            : 'Excluded specifically'
                        }
                      >
                        {item.maintainerrExclusionType === 'global' ? (
                          <GlobeAltIcon className="h-4 w-4 text-zinc-100" />
                        ) : (
                          <FlagIcon className="h-4 w-4 text-zinc-100" />
                        )}
                      </span>
                    )}
                    <span
                      onClick={() => openModal(item)}
                      className="cursor-alias hover:underline"
                    >
                      {title}
                    </span>
                  </td>

                  <td className="px-4 py-2">
                    {item.parentYear ?? item.year ?? '-'}
                  </td>
                  <td className="px-4 py-2 text-center">{item.ratingKey}</td>
                  <td className="px-4 py-2">
                    {item.audienceRating ? item.audienceRating.toFixed(1) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedItem && extractTmdbId(selectedItem) && (
        <MediaModalContent
          id={Number(selectedItem.ratingKey)}
          onClose={closeModal}
          title={
            selectedItem.grandparentTitle ||
            selectedItem.parentTitle ||
            selectedItem.title
          }
          summary={selectedItem.summary || 'No description available.'}
          mediaType={
            selectedItem.type as 'movie' | 'show' | 'season' | 'episode'
          }
          tmdbid={extractTmdbId(selectedItem)}
          year={
            selectedItem.parentYear?.toString() ||
            selectedItem.year?.toString() ||
            undefined
          }
          userScore={selectedItem.audienceRating || 0}
        />
      )}
    </div>
  )
}

export default TableView
