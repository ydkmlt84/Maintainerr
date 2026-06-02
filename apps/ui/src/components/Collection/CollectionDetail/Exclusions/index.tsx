import { type MediaItem } from '@maintainerr/contracts'
import { debounce } from 'lodash-es'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ICollection } from '../..'
import GetApiHandler from '../../../../utils/ApiHandler'
import MediaContent from '../../../Media/Content'

interface ICollectionExclusions {
  collection: ICollection
  libraryId: string
}

export interface IExclusionMedia {
  id: number
  mediaServerId: string
  ruleGroupId: number
  parent: number
  type: number
  /** Server-agnostic media metadata */
  mediaData?: MediaItem
}

const CollectionExcludions = (props: ICollectionExclusions) => {
  const [data, setData] = useState<MediaItem[]>([])
  // paging
  const pageData = useRef<number>(0)
  const fetchAmount = 25
  const [totalSize, setTotalSize] = useState<number>(999)
  const totalSizeRef = useRef<number>(999)
  const dataRef = useRef<MediaItem[]>([])
  const loadingRef = useRef<boolean>(true)
  const loadingExtraRef = useRef<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingExtra, setIsLoadingExtra] = useState(false)
  const [page, setPage] = useState(0)
  const [pageDataCount, setPageDataCount] = useState(0)

  useEffect(() => {
    // Initial first fetch
    queueMicrotask(() => setPage(1))
  }, [])

  const fetchData = useCallback(async () => {
    if (!loadingRef.current) {
      loadingExtraRef.current = true
      setIsLoadingExtra(true)
    }
    // setLoading(true)
    const resp: { totalSize: number; items: IExclusionMedia[] } =
      await GetApiHandler(
        `/collections/exclusions/${props.collection.id}/content/${pageData.current}?size=${fetchAmount}`,
      )

    setTotalSize(resp.totalSize)
    // pageData.current = pageData.current + 1

    setData([
      ...dataRef.current,
      ...resp.items.map((el) => {
        if (el.mediaData) {
          return {
            ...el.mediaData,
            maintainerrExclusionId: el.id,
            maintainerrExclusionType: el.ruleGroupId ? 'specific' : 'global',
          } as MediaItem
        }
        return {} as MediaItem
      }),
    ])
    loadingRef.current = false
    loadingExtraRef.current = false
    setIsLoading(false)
    setIsLoadingExtra(false)
  }, [props.collection.id])

  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.scrollHeight * 0.9
    ) {
      if (
        !loadingRef.current &&
        !loadingExtraRef.current &&
        !(fetchAmount * (pageData.current - 1) >= totalSizeRef.current)
      ) {
        setPage(pageData.current + 1)
      }
    }
  }

  useEffect(() => {
    if (page !== 0) {
      // Ignore initial page render
      pageData.current = pageData.current + 1
      queueMicrotask(() => {
        setPageDataCount(pageData.current)
        fetchData()
      })
    }
  }, [fetchData, page])

  useEffect(() => {
    const debouncedScroll = debounce(handleScroll, 200)
    window.addEventListener('scroll', debouncedScroll)
    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      debouncedScroll.cancel() // Cancel pending debounced calls
    }
  }, [])

  useEffect(() => {
    dataRef.current = data

    // If page is not filled yet, fetch more
    if (
      !loadingRef.current &&
      !loadingExtraRef.current &&
      window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.scrollHeight * 0.9 &&
      !(fetchAmount * (pageData.current - 1) >= totalSizeRef.current)
    ) {
      queueMicrotask(() => setPage((currentPage) => currentPage + 1))
    }
  }, [data])

  useEffect(() => {
    totalSizeRef.current = totalSize
  }, [totalSize])

  return (
    <MediaContent
      dataFinished={true}
      fetchData={() => {}}
      loading={isLoading}
      data={data}
      libraryId={props.libraryId}
      collectionPage={true}
      collectionId={props.collection.id}
      extrasLoading={
        isLoadingExtra && !isLoading && totalSize >= pageDataCount * fetchAmount
      }
      onRemove={(id: string) =>
        setTimeout(() => {
          setData(dataRef.current.filter((el) => el.id !== id))
        }, 500)
      }
    />
  )
}
export default CollectionExcludions
