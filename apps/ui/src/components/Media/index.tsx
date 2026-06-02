import {
  type MediaItem,
  type MediaLibrary,
  type MediaLibrarySortParams,
} from '@maintainerr/contracts'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMediaServerLibraries } from '../../api/media-server'
import SearchContext from '../../contexts/search-context'
import GetApiHandler from '../../utils/ApiHandler'
import { dedupeMediaItems } from '../../utils/mediaIdentity'
import LibrarySwitcher from '../Common/LibrarySwitcher'
import {
  getMediaLibrarySortConfig,
  MediaLibrarySortControl,
  sortMediaItems,
  useMediaLibrarySort,
} from '../Common/MediaLibrarySortControl'
import { Select } from '../Forms/Select'
import MediaContent from './Content'

const mediaLibraryStorageKey = 'maintainerr.media.selectedLibraryId'
const defaultFilterValue = 'all'
const filterOptions = [{ value: defaultFilterValue, label: 'All items' }]

const getStoredMediaLibraryId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage.getItem(mediaLibraryStorageKey) ?? undefined
}

const Media = () => {
  // const [isLoading, setIsLoading] = useState<Boolean>(false)
  const loadingRef = useRef<boolean>(false)
  const [isLoading, setIsLoadingState] = useState(false)

  const [loadingExtra, setLoadingExtra] = useState<boolean>(false)

  const [data, setData] = useState<MediaItem[]>([])
  const dataRef = useRef<MediaItem[]>([])

  const [totalSize, setTotalSize] = useState<number>(999)
  const totalSizeRef = useRef<number>(999)

  const [selectedLibrary, setSelectedLibrary] = useState<string | undefined>(
    getStoredMediaLibraryId,
  )
  const selectedLibraryRef = useRef<string | undefined>(undefined)
  const [searchUsed, setSearchUsed] = useState<boolean>(false)
  const [filterValue, setFilterValue] = useState(defaultFilterValue)

  const pageData = useRef<number>(0)
  const [pageDataCount, setPageDataCount] = useState(0)
  const SearchCtx = useContext(SearchContext)

  const { data: libraries } = useMediaServerLibraries()
  const currentLibrary = libraries?.find(
    (library: MediaLibrary) => library.id === selectedLibrary,
  )
  const currentLibraryType = currentLibrary?.type
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
    setIsLoadingState(val)
  }

  const switchLib = useCallback((libraryId: string) => {
    setIsLoading(true)
    pageData.current = 0
    setPageDataCount(0)
    setTotalSize(999)
    setData([])
    dataRef.current = []
    setSearchUsed(false)
    setSelectedLibrary(libraryId)
    window.localStorage.setItem(mediaLibraryStorageKey, libraryId)
  }, [])

  const fetchData = useCallback(
    async (requestedSortParams: MediaLibrarySortParams = sortParams) => {
      if (
        selectedLibraryRef.current &&
        SearchCtx.search.text === '' &&
        totalSizeRef.current >= pageData.current * fetchAmount
      ) {
        const askedLib = selectedLibraryRef.current

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
          setPageDataCount(pageData.current)
          setData(
            dedupeMediaItems([
              ...dataRef.current,
              ...(resp && resp.items ? resp.items : []),
            ]),
          )
          setIsLoading(false)
        }
        setLoadingExtra(false)
        setIsLoading(false)
      }
    },
    [SearchCtx.search.text, sortParams],
  )

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
  }, [
    SearchCtx.search.text,
    data.length,
    libraries,
    selectedLibrary,
    switchLib,
  ])

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      setData([])
      dataRef.current = []
      totalSizeRef.current = 999
      pageData.current = 0
      setPageDataCount(0)
    }
  }, [])

  useEffect(() => {
    if (!libraries || libraries.length === 0) return

    if (SearchCtx.search.text !== '') {
      GetApiHandler(`/media-server/search/${SearchCtx.search.text}`).then(
        (resp: MediaItem[]) => {
          setSearchUsed(true)
          setTotalSize(resp.length)
          pageData.current = resp.length * 50
          setPageDataCount(pageData.current)
          setData(
            resp ? dedupeMediaItems(sortMediaItems(resp, sortParams)) : [],
          )
          setIsLoading(false)
        },
      )
    } else {
      pageData.current = 0
      queueMicrotask(() => {
        setSearchUsed(false)
        setData([])
        setTotalSize(999)
        setPageDataCount(0)
        setIsLoading(true)
        fetchData()
      })
    }
  }, [SearchCtx.search.text, fetchData, libraries, sortParams])

  useEffect(() => {
    selectedLibraryRef.current = selectedLibrary
    fetchData()
  }, [fetchData, selectedLibrary])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    totalSizeRef.current = totalSize
  }, [totalSize])

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
    setPageDataCount(0)
    setTotalSize(999)
    setData([])
    dataRef.current = []
    setIsLoading(true)
    fetchData(nextSortState.sortParams)
  }

  return (
    <>
      <title>Media - Maintainerr</title>
      <div className="w-full">
        {!searchUsed ? (
          <div className="top-app-chrome top-app-chrome-joined mobile-media-controls media-controls-full-bleed sticky top-[calc(6.5rem+env(safe-area-inset-top))] z-20 mb-5 flex flex-col gap-3 px-4 pb-3 pt-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full sm:w-[18rem]">
                <LibrarySwitcher
                  shouldShowAllOption={false}
                  onLibraryChange={switchLib}
                  selectedLibraryId={selectedLibrary}
                  containerClassName="w-full"
                  formClassName="w-full"
                />
              </div>
              <div className="hidden h-9 shrink-0 items-center rounded-md bg-zinc-900/80 px-3 text-xs font-medium text-zinc-200 sm:inline-flex">
                {libraryCountLabel}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
              <div className="relative w-full sm:w-[18rem]">
                {hasCustomSortSelected ? (
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.7)]" />
                ) : null}
                <MediaLibrarySortControl
                  ariaLabel="Sort media items"
                  options={sortConfig.options}
                  value={sortValue}
                  onSortChange={handleSortChange}
                  isLoading={isLoading}
                />
              </div>
              <div className="relative w-full sm:w-[12rem]">
                {hasCustomFilterSelected ? (
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-zinc-300 shadow-[0_0_10px_rgba(212,212,216,0.7)]" />
                ) : null}
                <Select
                  aria-label="Filter media items"
                  name="filter"
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        ) : undefined}
        {selectedLibrary ? (
          <MediaContent
            dataFinished={!(totalSize >= pageDataCount * fetchAmount)}
            fetchData={() => {
              setLoadingExtra(true)
              fetchData()
            }}
            loading={isLoading}
            extrasLoading={
              loadingExtra &&
              !isLoading &&
              totalSize >= pageDataCount * fetchAmount
            }
            data={data}
            libraryId={selectedLibrary!}
          />
        ) : undefined}
      </div>
    </>
  )
}
export default Media
