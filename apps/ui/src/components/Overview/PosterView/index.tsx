import type { ICollectionMedia } from '../../Collection'
import { SmallLoadingSpinner } from '../../Common/LoadingSpinner'
import MediaCard from '../../Common/MediaCard'
import type { IPlexMetadata } from '../iPlexMetadata'

interface Props {
  data: IPlexMetadata[]
  libraryId: number
  extrasLoading?: boolean

  onDataChanged?: () => void | Promise<void>
  collectionPage?: boolean
  collectionInfo?: ICollectionMedia[]
  collectionId?: number
  onRemove?: (id: string) => void

  getDaysLeft: (plexId: number) => number | undefined
}

const getTitle = (el: IPlexMetadata) =>
  el.grandparentTitle
    ? el.grandparentTitle
    : el.parentTitle
      ? el.parentTitle
      : el.title

const getSummary = (el: IPlexMetadata) =>
  el.type === 'movie' || el.type === 'show'
    ? el.summary
    : el.type === 'season'
      ? el.title
      : el.type === 'episode'
        ? 'Episode ' + el.index + ' - ' + el.title
        : ''

const getYear = (el: IPlexMetadata) =>
  el.type === 'episode'
    ? el.parentTitle
    : el.parentYear
      ? el.parentYear.toString()
      : el.year?.toString()

const getTmdbId = (el: IPlexMetadata) =>
  el.parentData
    ? el.parentData.Guid?.find((e) => e.id?.includes('tmdb'))?.id?.split(
        'tmdb://',
      )[1]
    : el.Guid?.find((e) => e.id?.includes('tmdb'))?.id?.split('tmdb://')[1]

const toCardType = (t: IPlexMetadata['type']): 1 | 2 | 3 | 4 =>
  t === 'movie' ? 1 : t === 'show' ? 2 : t === 'season' ? 3 : 4

const OverviewPoster = ({
  data,
  libraryId,
  extrasLoading,
  onDataChanged,
  collectionPage = false,
  collectionInfo,
  collectionId,
  onRemove,
  getDaysLeft,
}: Props) => {
  if (!data || data.length === 0) return null

  return (
    <ul className="cards-vertical">
      {data.map((el) => (
        <li key={+el.ratingKey}>
          <MediaCard
            id={+el.ratingKey}
            libraryId={libraryId}
            type={toCardType(el.type)}
            image={''}
            summary={getSummary(el)}
            year={getYear(el)}
            mediaType={el.type}
            title={getTitle(el)}
            userScore={el.audienceRating ? el.audienceRating : 0}
            exclusionId={el.maintainerrExclusionId ?? undefined}
            exclusionType={el.maintainerrExclusionType}
            exclusionLabels={el.maintainerrExclusionLabels}
            exclusionTargets={el.maintainerrExclusionTargets}
            tmdbid={getTmdbId(el)}
            collectionPage={collectionPage}
            onRemove={onRemove}
            collectionId={collectionId}
            isManual={!!el.maintainerrIsManual}
            collections={el.maintainerrCollections}
            onDataChanged={onDataChanged}
            {...(collectionInfo
              ? {
                  daysLeft: getDaysLeft(+el.ratingKey),
                  collectionId: collectionInfo.find(
                    (c) => c.plexId === +el.ratingKey,
                  )?.collectionId,
                }
              : undefined)}
          />
        </li>
      ))}

      {extrasLoading ? <SmallLoadingSpinner /> : null}
    </ul>
  )
}

export default OverviewPoster
