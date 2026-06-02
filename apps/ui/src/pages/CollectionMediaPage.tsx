import { type MediaItem } from '@maintainerr/contracts'
import { debounce } from 'lodash-es'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ICollection, ICollectionMedia } from '../components/Collection'
import MediaContent from '../components/Media/Content'
import GetApiHandler from '../utils/ApiHandler'

interface CollectionContextType {
  collection: ICollection
}

const CollectionMediaPage = () => {
  const { collection } = useOutletContext<CollectionContextType>()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MediaItem[]>([])
  const [media, setMedia] = useState<ICollectionMedia[]>([])
  // paging
  const pageData = useRef<number>(0)
  const fetchAmount = 25
  const [totalSize, setTotalSize] = useState<number>(999)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoadingExtra, setIsLoadingExtra] = useState<boolean>(false)

  const [page, setPage] = useState(0)
  const [pageDataCount, setPageDataCount] = useState(0)

  const fetchData = useCallback(async () => {
    setIsLoadingExtra(true)
    const resp: { totalSize: number; items: ICollectionMedia[] } =
      await GetApiHandler(
        `/collections/media/${id}/content/${pageData.current}?size=${fetchAmount}`,
      )

    setTotalSize(resp.totalSize)
    setMedia((prevMedia) => [...prevMedia, ...resp.items])

    setData((prevData) => [
      ...prevData,
      ...resp.items.map((el) => {
        if (el.mediaData) {
          return {
            ...el.mediaData,
            maintainerrIsManual: el.isManual ? el.isManual : false,
          }
        }
        return {} as MediaItem
      }),
    ])
    setIsLoading(false)
    setIsLoadingExtra(false)
  }, [id])

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.scrollHeight * 0.9
    ) {
      if (
        !isLoading &&
        !isLoadingExtra &&
        !(fetchAmount * (pageData.current - 1) >= totalSize)
      ) {
        setPage(pageData.current + 1)
      }
    }
  }, [isLoading, isLoadingExtra, totalSize])

  useEffect(() => {
    if (page !== 0) {
      // Ignore initial page render
      pageData.current = pageData.current + 1
      setPageDataCount(pageData.current)
      fetchData()
    }
  }, [fetchData, page])

  useEffect(() => {
    const debouncedScroll = debounce(handleScroll, 200)
    window.addEventListener('scroll', debouncedScroll)
    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      debouncedScroll.cancel() // Cancel pending debounced calls
    }
  }, [handleScroll])

  useEffect(() => {
    // Initial first fetch
    queueMicrotask(() => setPage(1))
  }, [])

  useEffect(() => {
    // If page is not filled yet, fetch more
    if (
      !isLoading &&
      !isLoadingExtra &&
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight * 0.9 &&
      !(fetchAmount * (pageData.current - 1) >= totalSize)
    ) {
      queueMicrotask(() => setPage((currentPage) => currentPage + 1))
    }
  }, [data, isLoading, isLoadingExtra, totalSize])

  const collectionInfo = useMemo(
    () =>
      media.map((el) => ({
        ...el,
        collection: {
          ...collection,
          media: [],
        },
      })),
    [collection, media],
  )

  return (
    <MediaContent
      dataFinished={true}
      fetchData={() => {}}
      loading={isLoading}
      data={data}
      libraryId={collection.libraryId}
      collectionPage={true}
      extrasLoading={
        isLoadingExtra && !isLoading && totalSize >= pageDataCount * fetchAmount
      }
      onRemove={(id: string) =>
        setTimeout(() => {
          setData((prevData) => prevData.filter((el) => el.id !== id))
          setMedia((prevMedia) =>
            prevMedia.filter((el) => el.mediaServerId !== id),
          )
        }, 500)
      }
      collectionInfo={collectionInfo}
    />
  )
}

export default CollectionMediaPage
