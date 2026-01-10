import { debounce } from 'lodash-es'
import { useCallback, useEffect, useRef } from 'react'
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
  onDataChanged?: () => void | Promise<void>
  libraryId: number
  collectionPage?: boolean
  collectionInfo?: ICollectionMedia[]
  collectionId?: number
  viewMode: 'poster' | 'table'
}

const OverviewContent = (props: IOverviewContent) => {
  const {
    data,
    dataFinished,
    extrasLoading,
    fetchData,
    loading,
    onDataChanged,
    onRemove,
    viewMode,
    libraryId,
    collectionPage,
    collectionInfo,
    collectionId,
  } = props

  const isTableView = viewMode === 'table'
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const handleScroll = useCallback(() => {
    if (isTableView) return
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.scrollHeight * 0.8
    ) {
      if (!extrasLoading && !dataFinished) {
        fetchData()
      }
    }
  }, [isTableView, dataFinished, extrasLoading, fetchData])

  useEffect(() => {
    if (isTableView) return
    const debouncedScroll = debounce(handleScroll, 200)
    window.addEventListener('scroll', debouncedScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      debouncedScroll.cancel()
    }
  }, [handleScroll, isTableView])

  useEffect(() => {
    if (isTableView) return
    if (
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight * 0.8 &&
      !loading &&
      !extrasLoading &&
      !dataFinished
    ) {
      fetchData()
    }
  }, [isTableView, data, dataFinished, extrasLoading, fetchData, loading])

  useEffect(() => {
    if (isTableView) return
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            !extrasLoading &&
            !dataFinished
          ) {
            fetchData()
          }
        })
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [dataFinished, extrasLoading, fetchData, isTableView])

  const getDaysLeft = (plexId: number) => {
    if (!collectionInfo) return undefined

    const collectionData = collectionInfo.find((colEl) => colEl.plexId === +plexId)

    if (!collectionData?.collection) return undefined
    if (collectionData.collection.deleteAfterDays == null) return undefined

    const date = new Date(collectionData.addDate)
    const today = new Date()

    date.setDate(date.getDate() + collectionData.collection.deleteAfterDays)

    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) return <LoadingSpinner />
  if (!data || data.length === 0) return null

  const content =
    viewMode === 'table' ? (
      <OverviewTable
        data={data}
        extrasLoading={extrasLoading}
        libraryId={libraryId}
        onDataChanged={onDataChanged}
        fetchData={fetchData}
        dataFinished={dataFinished}
      />
    ) : (
      <OverviewPoster
        data={data}
        libraryId={libraryId}
        extrasLoading={extrasLoading}
        collectionPage={collectionPage}
        collectionInfo={collectionInfo}
        collectionId={collectionId}
        onRemove={onRemove}
        getDaysLeft={getDaysLeft}
        onDataChanged={onDataChanged}
      />
    )

  return (
    <>
      {content}
      {isTableView ? null : <div ref={sentinelRef} />}
    </>
  )
}

export default OverviewContent
