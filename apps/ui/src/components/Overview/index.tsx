import {
  type MediaItem,
  type MediaLibrary,
  type MediaLibrarySortParams,
} from '@maintainerr/contracts'
import { clone } from 'lodash'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMediaServerLibraries } from '../../api/media-server'
import SearchContext from '../../contexts/search-context'
import GetApiHandler from '../../utils/ApiHandler'
import LibrarySwitcher from '../Common/LibrarySwitcher'
import {
  getMediaLibrarySortConfig,
  MediaLibrarySortControl,
  sortMediaItems,
  useMediaLibrarySort,
} from '../Common/MediaLibrarySortControl'
import OverviewContent from './Content'

const overviewLibraryStorageKey = 'maintainerr.overview.selectedLibraryId'
const defaultFilterValue = 'all'
const overviewSelectClassName =
  'block w-full min-w-0 flex-1 rounded-md border border-sky-500/25 bg-slate-900/80 text-white shadow-sm shadow-slate-950/20 transition duration-150 ease-in-out focus:border-sky-400 focus:ring-1 focus:ring-sky-400/40 sm:text-sm sm:leading-5'

const getStoredOverviewLibraryId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage.getItem(overviewLibraryStorageKey) ?? undefined
}

const Overview = () => {
  // const [isLoading, setIsLoading] = useState<Boolean>(false)
  const loadingRef = useRef<boolean>(false)

  const [loadingExtra, setLoadingExtra] = useState<boolean>(false)

  const [data, setData] = useState<MediaItem[]>([])
  const dataRef = useRef<MediaItem[]>([])

  const [totalSize, setTotalSize] = useState<number>(999)
  const totalSizeRef = useRef<number>(999)

  const [selectedLibrary, setSelectedLibrary] = useState<string | undefined>(
    getStoredOverviewLibraryId,
  )
  const selectedLibraryRef = useRef<string | undefined>(undefined)
  const [searchUsed, setSearchUsed] = useState<boolean>(false)
  const [filterValue, setFilterValue] = useState(defaultFilterValue)

  const pageData = useRef<number>(0)
  const SearchCtx = useContext(SearchContext)

  const { data: libraries } = useMediaServerLibraries()
  const currentLibraryType = libraries?.find(
    (library: MediaLibrary) => library.id === selectedLibrary,
  )?.type
  const sortConfig = useMemo(
    () => getMediaLibrarySortConfig(currentLibraryType),
    [currentLibraryType],
  )
  const { sortValue, sortParams, onSortChange } =
    useMediaLibrarySort(sortConfig)
  const hasCustomSortSelected = sortValue !== sortConfig.defaultValue
  const hasCustomFilterSelected = filterValue !== defaultFilterValue
  const hasResolvedTotalSize = totalSize !== 999 || data.length > 0
  const libraryCountLabel = hasResolvedTotalSize
    ? `${totalSize.toLocaleString()} items`
    : 'Loading count'

  const fetchAmount = 30

  const setIsLoading = (val: boolean) => {
    loadingRef.current = val
  }

  useEffect(() => {
    if (!libraries || libraries.length === 0) {
      return
    }

    setTimeout(() => {
      if (
        loadingRef.current &&
        data.length === 0 &&
        SearchCtx.search.text === ''
      ) {
        switchLib(selectedLibrary ? selectedLibrary : libraries[0].id)
      }
    }, 300)

    // Cleanup on unmount
    return () => {
      setData([])
      dataRef.current = []
      totalSizeRef.current = 999
      pageData.current = 0
    }
  }, [libraries])

  useEffect(() => {
    if (!libraries || libraries.length === 0) return

    if (SearchCtx.search.text !== '') {
      GetApiHandler(`/media-server/search/${SearchCtx.search.text}`).then(
        (resp: MediaItem[]) => {
          setSearchUsed(true)
          setTotalSize(resp.length)
          pageData.current = resp.length * 50
          setData(resp ? sortMediaItems(resp, sortParams) : [])
          setIsLoading(false)
        },
      )
    } else {
      setSearchUsed(false)
      setData([])
      setTotalSize(999)
      pageData.current = 0
      setIsLoading(true)
      fetchData()
    }
  }, [SearchCtx.search.text])

  useEffect(() => {
    selectedLibraryRef.current = selectedLibrary
    fetchData()
  }, [selectedLibrary])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    totalSizeRef.current = totalSize
  }, [totalSize])

  const switchLib = (libraryId: string) => {
    setIsLoading(true)
    pageData.current = 0
    setTotalSize(999)
    setData([])
    dataRef.current = []
    setSearchUsed(false)
    setSelectedLibrary(libraryId)
    window.localStorage.setItem(overviewLibraryStorageKey, libraryId)
  }

  const fetchData = async (
    requestedSortParams: MediaLibrarySortParams = sortParams,
  ) => {
    if (
      selectedLibraryRef.current &&
      SearchCtx.search.text === '' &&
      totalSizeRef.current >= pageData.current * fetchAmount
    ) {
      const askedLib = clone(selectedLibraryRef.current)

      const resp: { totalSize: number; items: MediaItem[] } =
        await GetApiHandler(
          `/media-server/library/${selectedLibraryRef.current}/content?page=${
            pageData.current + 1
          }&limit=${fetchAmount}&${new URLSearchParams({
            sort: requestedSortParams.sort,
            sortOrder: requestedSortParams.sortOrder,
          }).toString()}`,
        )

      if (askedLib === selectedLibraryRef.current) {
        setTotalSize(resp.totalSize)
        pageData.current = pageData.current + 1
        setData([...dataRef.current, ...(resp && resp.items ? resp.items : [])])
        setIsLoading(false)
      }
      setLoadingExtra(false)
      setIsLoading(false)
    }
  }

  const handleSortChange = (nextSortValue: string) => {
    const nextSortState = onSortChange(nextSortValue)
    if (!nextSortState) {
      return
    }

    if (SearchCtx.search.text !== '') {
      setData((currentData) =>
        sortMediaItems(currentData, nextSortState.sortParams),
      )
      return
    }

    pageData.current = 0
    setTotalSize(999)
    setData([])
    dataRef.current = []
    setIsLoading(true)
    fetchData(nextSortState.sortParams)
  }

  return (
    <>
      <title>Overview - Maintainerr</title>
      <div className="w-full">
        {!searchUsed ? (
          <div className="sticky top-16 z-20 -mx-4 mb-5 flex w-auto flex-col gap-3 bg-slate-950 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full sm:w-[18rem]">
                <LibrarySwitcher
                  shouldShowAllOption={false}
                  onLibraryChange={switchLib}
                  selectedLibraryId={selectedLibrary}
                  containerClassName="w-full"
                  formClassName="w-full"
                  selectClassName={overviewSelectClassName}
                />
              </div>
              <div className="hidden h-9 shrink-0 items-center rounded-md border border-sky-500/20 bg-slate-950/70 px-3 text-xs font-medium text-sky-100 shadow-sm shadow-slate-950/20 sm:inline-flex">
                {libraryCountLabel}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
              <div className="relative w-full sm:w-[18rem]">
                {hasCustomSortSelected ? (
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
                ) : null}
                <MediaLibrarySortControl
                  ariaLabel="Sort overview items"
                  options={sortConfig.options}
                  value={sortValue}
                  onSortChange={handleSortChange}
                  isLoading={loadingRef.current}
                />
              </div>
              <div className="relative w-full sm:w-[12rem]">
                {hasCustomFilterSelected ? (
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
                ) : null}
                <select
                  aria-label="Filter overview items"
                  className={overviewSelectClassName}
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                >
                  <option value={defaultFilterValue}>All items</option>
                </select>
              </div>
            </div>
          </div>
        ) : undefined}
        {selectedLibrary ? (
          <OverviewContent
            dataFinished={
              !(totalSizeRef.current >= pageData.current * fetchAmount)
            }
            fetchData={() => {
              setLoadingExtra(true)
              fetchData()
            }}
            loading={loadingRef.current}
            extrasLoading={
              loadingExtra &&
              !loadingRef.current &&
              totalSizeRef.current >= pageData.current * fetchAmount
            }
            data={data}
            libraryId={selectedLibrary!}
          />
        ) : undefined}
      </div>
    </>
  )
}
export default Overview
