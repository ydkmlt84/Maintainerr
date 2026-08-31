import {
  type MediaItem,
  type MediaLibrary,
  type MediaLibrarySortParams,
} from '@maintainerr/contracts'
import {
  FunnelIcon,
  ArrowPathIcon,
  BarsArrowUpIcon,
} from '@heroicons/react/24/outline'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
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
const leavingSoonFilterValue = 'leaving-soon'
const excludedFilterValue = 'excluded'
const manuallyAddedFilterValue = 'manually-added'
const recentlyAddedFilterValue = 'recently-added'
const filterOptions = [
  { value: defaultFilterValue, label: 'All items' },
  { value: recentlyAddedFilterValue, label: 'Recently Added' },
  { value: leavingSoonFilterValue, label: 'Leaving Soon' },
  { value: excludedFilterValue, label: 'Excluded' },
  { value: manuallyAddedFilterValue, label: 'Manually Added' },
]

type LeavingSoonItem = {
  media: MediaItem
  collectionId: number
  collectionTitle: string
  deleteDate: string
  daysLeft: number
}

type ActionableExclusionItem = {
  media: MediaItem
  exclusionId: number
  scope: 'global' | 'collection'
  collectionId?: number
  collectionTitle?: string
  expiresAt?: string
}

type ManuallyAddedItem = {
  media: MediaItem
}

const getStoredMediaLibraryId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage.getItem(mediaLibraryStorageKey) ?? undefined
}

const Media = () => {
  const [searchParams, setSearchParams] = useSearchParams()
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
  const requestedFilter = searchParams.get('filter')
  const [filterValue, setFilterValue] = useState(
    requestedFilter === leavingSoonFilterValue ||
      requestedFilter === excludedFilterValue ||
      requestedFilter === manuallyAddedFilterValue ||
      requestedFilter === recentlyAddedFilterValue
      ? requestedFilter
      : defaultFilterValue,
  )
  const filterValueRef = useRef(filterValue)

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
      if (filterValueRef.current !== defaultFilterValue) {
        return
      }

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
    } else if (filterValue === defaultFilterValue) {
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
  }, [SearchCtx.search.text, fetchData, filterValue, libraries, sortParams])

  useEffect(() => {
    filterValueRef.current = filterValue

    if (
      ![
        leavingSoonFilterValue,
        excludedFilterValue,
        manuallyAddedFilterValue,
        recentlyAddedFilterValue,
      ].includes(filterValue) ||
      !selectedLibrary ||
      SearchCtx.search.text !== ''
    ) {
      return
    }

    let active = true
    queueMicrotask(() => {
      if (!active) return
      setIsLoading(true)
      setData([])
      setTotalSize(999)
    })

    const endpoint =
      filterValue === recentlyAddedFilterValue
        ? `/media-server/library/${encodeURIComponent(selectedLibrary)}/recent?limit=50`
        : filterValue === leavingSoonFilterValue
          ? '/stats/leaving-soon'
          : filterValue === excludedFilterValue
            ? '/stats/excluded'
            : '/stats/manually-added'

    GetApiHandler<
      | MediaItem[]
      | LeavingSoonItem[]
      | ActionableExclusionItem[]
      | ManuallyAddedItem[]
    >(
      filterValue === recentlyAddedFilterValue
        ? endpoint
        : `${endpoint}?${new URLSearchParams({
            libraryId: selectedLibrary,
          }).toString()}`,
    )
      .then((items) => {
        if (!active) return

        if (filterValue === recentlyAddedFilterValue) {
          const recentlyAdded = dedupeMediaItems(items as MediaItem[])
          setData(recentlyAdded)
          setTotalSize(recentlyAdded.length)
          pageData.current = recentlyAdded.length
          setPageDataCount(recentlyAdded.length)
          return
        }

        const filteredMedia = (
          items as (
            LeavingSoonItem | ActionableExclusionItem | ManuallyAddedItem
          )[]
        ).map((item) => {
          if (filterValue === leavingSoonFilterValue) {
            return { ...item.media, maintainerrLeavingSoon: item }
          }
          if (filterValue === excludedFilterValue) {
            return { ...item.media, maintainerrExcluded: item }
          }
          return {
            ...item.media,
            maintainerrIsManual: true,
            maintainerrManualFilter: true,
          }
        })
        const visibleMedia =
          filterValue === leavingSoonFilterValue ||
          filterValue === excludedFilterValue
            ? dedupeMediaItems(filteredMedia)
            : filteredMedia
        setData(visibleMedia)
        setTotalSize(visibleMedia.length)
        pageData.current = visibleMedia.length
        setPageDataCount(visibleMedia.length)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [SearchCtx.search.text, filterValue, selectedLibrary])

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

    if (SearchCtx.search.text !== '' || filterValue !== defaultFilterValue) {
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

  const handleFilterChange = (nextFilterValue: string) => {
    filterValueRef.current = nextFilterValue
    setFilterValue(nextFilterValue)
    const nextParams = new URLSearchParams(searchParams)

    if (nextFilterValue === defaultFilterValue) {
      nextParams.delete('filter')
    } else {
      nextParams.set('filter', nextFilterValue)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const resetSort = () => handleSortChange(sortConfig.defaultValue)
  const resetFilter = () => handleFilterChange(defaultFilterValue)
  const resetAll = () => {
    handleFilterChange(defaultFilterValue)
    handleSortChange(sortConfig.defaultValue)
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
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-maintainerr-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]" />
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
                  <span className="pointer-events-none absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-maintainerr-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]" />
                ) : null}
                <Select
                  aria-label="Filter media items"
                  name="filter"
                  value={filterValue}
                  onChange={(event) => handleFilterChange(event.target.value)}
                >
                  {filterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex h-9 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-800 shadow-sm">
                <ResetControl
                  label="Reset sort"
                  disabled={!hasCustomSortSelected}
                  onClick={resetSort}
                >
                  <BarsArrowUpIcon className="h-4 w-4" />
                </ResetControl>
                <ResetControl
                  label="Reset filter"
                  disabled={!hasCustomFilterSelected}
                  onClick={resetFilter}
                >
                  <FunnelIcon className="h-4 w-4" />
                </ResetControl>
                <ResetControl
                  label="Reset sort and filter"
                  disabled={!hasCustomSortSelected && !hasCustomFilterSelected}
                  onClick={resetAll}
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </ResetControl>
              </div>
            </div>
          </div>
        ) : undefined}
        {selectedLibrary ? (
          <MediaContent
            dataFinished={
              filterValue !== defaultFilterValue ||
              !(totalSize >= pageDataCount * fetchAmount)
            }
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
            emptyTitle={
              filterValue === leavingSoonFilterValue
                ? 'Nothing is leaving soon'
                : filterValue === excludedFilterValue
                  ? 'No excluded media'
                  : filterValue === manuallyAddedFilterValue
                    ? 'No manually added media'
                    : filterValue === recentlyAddedFilterValue
                      ? 'No recently added media'
                      : 'No media found'
            }
            onRemove={(id) =>
              setData((currentData) => {
                if (id.startsWith('exclusion:')) {
                  const exclusionId = Number(id.slice('exclusion:'.length))
                  return currentData.filter(
                    (item) =>
                      (
                        item as MediaItem & {
                          maintainerrExcluded?: { exclusionId: number }
                        }
                      ).maintainerrExcluded?.exclusionId !== exclusionId,
                  )
                }

                return currentData.filter((item) => item.id.toString() !== id)
              })
            }
          />
        ) : undefined}
      </div>
    </>
  )
}

const ResetControl = ({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="flex h-9 w-9 items-center justify-center border-l border-zinc-600 text-zinc-300 transition first:border-l-0 hover:bg-maintainerr-600 hover:text-white disabled:cursor-default disabled:text-zinc-600 disabled:hover:bg-transparent"
  >
    {children}
  </button>
)

export default Media
