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
      <table className="min-w-full table-auto text-left text-sm text-white">
        <thead className="bg-zinc-800 text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Year</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Exclusion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-700">
          {data.map((item) => {
            const title =
              item.grandparentTitle || item.parentTitle || item.title

            return (
              <tr
                key={item.ratingKey}
                className="cursor-pointer transition focus-within:bg-zinc-800 hover:bg-zinc-800"
                onClick={() => openModal(item)}
              >
                <td className="max-w-[200px] truncate px-4 py-2" title={title}>
                  {title}
                </td>
                <td className="px-4 py-2">
                  {item.parentYear ?? item.year ?? '-'}
                </td>
                <td className="px-4 py-2 capitalize">{item.type}</td>
                <td className="px-4 py-2">
                  {item.audienceRating ? item.audienceRating.toFixed(1) : '-'}
                </td>
                <td className="px-4 py-2">
                  {item.maintainerrExclusionType
                    ? item.maintainerrExclusionType.toUpperCase()
                    : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

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
