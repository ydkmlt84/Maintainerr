import { debounce } from 'lodash-es'
import { useEffect } from 'react'
import type { ICollectionMedia } from '../../Collection'
import LoadingSpinner from '../../Common/LoadingSpinner'
import OverviewPoster from '../PosterView'
import OverviewTable from '../TableView'
import type { IPlexMetadata } from '../iPlexMetadata'

interface IOverviewContent {
  data: IPlexMetadata[]
  dataFinished: boolean
  loading: boolean
  extrasLoading?: boolean
  fetchData: () => void
  onRemove?: (id: string) => void
  libraryId: number
  collectionPage?: boolean
  collectionInfo?: ICollectionMedia[]
  collectionId?: number
  viewMode: 'poster' | 'table'
}

const OverviewContent = (props: IOverviewContent) => {
  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.scrollHeight * 0.8
    ) {
      if (!props.extrasLoading && !props.dataFinished) {
        props.fetchData()
      }
    }
  }

  useEffect(() => {
    const debouncedScroll = debounce(handleScroll, 200)
    window.addEventListener('scroll', debouncedScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      debouncedScroll.cancel()
    }
  }, [])

  useEffect(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight * 0.8 &&
      !props.loading &&
      !props.extrasLoading &&
      !props.dataFinished
    ) {
      props.fetchData()
    }
  }, [props.data])

  const getDaysLeft = (plexId: number) => {
    if (!props.collectionInfo) return undefined

    const collectionData = props.collectionInfo.find(
      (colEl) => colEl.plexId === +plexId,
    )

    if (!collectionData?.collection) return undefined
    if (collectionData.collection.deleteAfterDays == null) return undefined

    const date = new Date(collectionData.addDate)
    const today = new Date()

    date.setDate(date.getDate() + collectionData.collection.deleteAfterDays)

    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (props.loading) return <LoadingSpinner />
  if (!props.data || props.data.length === 0) return null

  if (props.viewMode === 'table') {
    return (
      <OverviewTable data={props.data} extrasLoading={props.extrasLoading} />
    )
  }

  return (
    <OverviewPoster
      data={props.data}
      libraryId={props.libraryId}
      extrasLoading={props.extrasLoading}
      collectionPage={props.collectionPage}
      collectionInfo={props.collectionInfo}
      collectionId={props.collectionId}
      onRemove={props.onRemove}
      getDaysLeft={getDaysLeft}
    />
  )
}

export default OverviewContent
