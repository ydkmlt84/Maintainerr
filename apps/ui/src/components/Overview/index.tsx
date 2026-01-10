import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePlexLibraries } from '../../api/plex'
import SearchContext from '../../contexts/search-context'
import GetApiHandler from '../../utils/ApiHandler'
import FilterDropdown, { FilterOption } from '../Common/FilterDropdown'
import LibrarySwitcher from '../Common/OverviewLibrarySwitcher'
import SortDropdown, { SortOption } from '../Common/SortDropdown'
import ViewToggleDropdown, { ViewMode } from '../Common/ViewModeDropdown'
import OverviewContent from './Content'
import type { IPlexMetadata } from './iPlexMetadata'

const Overview = () => {
  const [loading, setLoading] = useState(false)
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [allData, setAllData] = useState<IPlexMetadata[]>([])
  const [visibleData, setVisibleData] = useState<IPlexMetadata[]>([])
  const [totalSize, setTotalSize] = useState<number>(0)
  const [collectionsCount, setCollectionsCount] = useState<number>(0)
  const [selectedLibrary, setSelectedLibrary] = useState<number>()
  const [searchUsed, setSearchUsed] = useState(false)

  const SearchCtx = useContext(SearchContext)
  const { data: plexLibraries } = usePlexLibraries()

  const [viewMode, setViewMode] = useState<ViewMode>('poster')
  const [sortOption, setSortOption] = useState<SortOption>('title:asc')
  const [filterOption, setFilterOption] = useState<FilterOption>('all')

  type OpenDropdown = 'view' | 'sort' | 'filter' | null
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const fetchAmount = 40
  const visibleCountRef = useRef<number>(0)
  const filteredDataRef = useRef<IPlexMetadata[]>([])
  const loadingExtraRef = useRef<boolean>(false)
  const loadingTimeoutRef = useRef<number | null>(null)

  const setIsLoading = (val: boolean) => setLoading(val)

  const switchLib = useCallback((libraryId: number) => {
    setOpenDropdown(null)
    setIsLoading(true)
    setSearchUsed(false)
    setSelectedLibrary(libraryId)
  }, [])

  const plexSortFromOption = useCallback((option: SortOption) => {
    const [field, direction] = option.split(':') as [string, 'asc' | 'desc']
    if (field === 'daysLeft') return 'titleSort:asc'
    if (field === 'title') return `titleSort:${direction}`
    if (field === 'added') return `addedAt:${direction}`
    if (field === 'released') return `originallyAvailableAt:${direction}`
    return `${field}:${direction}`
  }, [])

  const fetchData = useCallback(async () => {
    if (!selectedLibrary || SearchCtx.search.text !== '') return

    setIsLoading(true)
    const sort = plexSortFromOption(sortOption)
    const resp: { totalSize: number; items: IPlexMetadata[] } =
      await GetApiHandler(
        `/plex/library/${selectedLibrary}/enriched/1?all=true&sort=${encodeURIComponent(
          sort,
        )}`,
      )

    const items = resp?.items ?? []
    setAllData(items)
    setTotalSize(resp?.totalSize ?? 0)
    setCollectionsCount(
      items.filter((el) => (el.maintainerrCollections?.length ?? 0) > 0).length,
    )
    setIsLoading(false)
    setLoadingExtra(false)
  }, [plexSortFromOption, SearchCtx.search.text, selectedLibrary, sortOption])

  const refreshData = useCallback(async () => {
    if (SearchCtx.search.text !== '') {
      setIsLoading(true)
      const resp: IPlexMetadata[] = await GetApiHandler(
        `/plex/search/${SearchCtx.search.text}`,
      )
      setSearchUsed(true)
      setAllData(resp ?? [])
      setTotalSize(resp?.length ?? 0)
      setIsLoading(false)
      setLoadingExtra(false)
      return
    }

    await fetchData()
  }, [SearchCtx.search.text, fetchData])

  const filteredData = useMemo(() => {
    const base = allData.filter((el) => {
      if (filterOption === 'excluded') return !!el.maintainerrExclusionType
      if (filterOption === 'nonExcluded') return !el.maintainerrExclusionType
      if (filterOption === 'manual') return !!el.maintainerrIsManual
      if (filterOption === 'inCollection')
        return (el.maintainerrCollections?.length ?? 0) > 0
      return true
    })
    if (sortOption.startsWith('daysLeft')) {
      const asc = sortOption.endsWith('asc')
      return [...base].sort((a, b) => {
        const av =
          a.maintainerrDaysLeft !== undefined
            ? a.maintainerrDaysLeft
            : Number.POSITIVE_INFINITY
        const bv =
          b.maintainerrDaysLeft !== undefined
            ? b.maintainerrDaysLeft
            : Number.POSITIVE_INFINITY
        return asc ? av - bv : bv - av
      })
    }
    return base
  }, [allData, filterOption, sortOption])

  useEffect(() => {
    filteredDataRef.current = filteredData
  }, [filteredData])

  useEffect(() => {
    loadingExtraRef.current = loadingExtra
  }, [loadingExtra])

  useEffect(() => {
    // reset visible slice when dataset or filters change
    visibleCountRef.current = Math.min(fetchAmount, filteredData.length)
    setVisibleData(filteredData.slice(0, visibleCountRef.current))
  }, [filteredData])

  const loadMoreVisible = useCallback(() => {
    if (loadingExtraRef.current) return
    if (visibleCountRef.current >= filteredDataRef.current.length) return

    loadingExtraRef.current = true
    setLoadingExtra(true)

    const nextCount = Math.min(
      visibleCountRef.current + fetchAmount,
      filteredDataRef.current.length,
    )
    visibleCountRef.current = nextCount
    setVisibleData(filteredDataRef.current.slice(0, nextCount))

    loadingExtraRef.current = false
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    loadingTimeoutRef.current = window.setTimeout(() => {
      setLoadingExtra(false)
      loadingTimeoutRef.current = null
    }, 0)
  }, [])

  useEffect(() => {
    if (!plexLibraries || plexLibraries.length === 0) return
    if (!selectedLibrary) {
      setSelectedLibrary(+plexLibraries[0].key)
    }

    return () => {
      setAllData([])
    }
  }, [plexLibraries, selectedLibrary])

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [])

  // Handle search changes
  useEffect(() => {
    const run = async () => {
      if (!plexLibraries || plexLibraries.length === 0) return

      if (SearchCtx.search.text !== '') {
        const resp: IPlexMetadata[] = await GetApiHandler(
          `/plex/search/${SearchCtx.search.text}`,
        )
        setSearchUsed(true)
        const items = resp ?? []
        setAllData(items)
        setTotalSize(items.length)
        setCollectionsCount(
          items.filter((el) => (el.maintainerrCollections?.length ?? 0) > 0)
            .length,
        )
        setIsLoading(false)
      } else {
        setSearchUsed(false)
        setAllData([])
        setTotalSize(0)
        setCollectionsCount(0)
        setIsLoading(true)
        await fetchData()
      }
    }
    run()
  }, [SearchCtx.search.text, plexLibraries, fetchData])

  useEffect(() => {
    if (SearchCtx.search.text !== '') {
      setOpenDropdown(null)
    }
  }, [SearchCtx.search.text])

  // Refresh when library or sort changes (non-search)
  useEffect(() => {
    if (SearchCtx.search.text === '' && selectedLibrary) {
      setIsLoading(true)
      fetchData()
    }
  }, [selectedLibrary, sortOption, fetchData, SearchCtx.search.text])

  const displayCount =
    filterOption === 'all' ? (totalSize ?? 0) : filteredData.length
  const displayCollectionsCount =
    filterOption === 'all' ? (collectionsCount ?? 0) : null

  return (
    <>
      <title>Overview - Maintainerr</title>
      <div className="w-full">
        {!searchUsed && (
          <div className="sticky top-16 z-10 flex flex-col items-center justify-center overflow-visible bg-zinc-900 pt-2 md:flex-row">
            <div className="w-full px-4 md:w-1/2">
              <div className="flex items-center gap-3">
                <LibrarySwitcher
                  shouldShowAllOption={false}
                  onLibraryChange={switchLib}
                />
                <div className="flex items-center gap-2">
                  <div className="whitespace-nowrap rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold text-zinc-200">
                    {displayCount.toLocaleString()} items
                  </div>
                  {displayCollectionsCount !== null ? (
                    <div className="whitespace-nowrap rounded-md bg-zinc-800 px-3 py-1 text-sm font-semibold text-zinc-200">
                      {displayCollectionsCount.toLocaleString()} Collected
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-2 flex w-full flex-row items-center justify-end gap-2 px-4 py-4 md:mt-0 md:w-1/2 md:pr-4">
              <ViewToggleDropdown
                viewMode={viewMode}
                onChange={setViewMode}
                isOpen={openDropdown === 'view'}
                onToggle={() =>
                  setOpenDropdown((prev) => (prev === 'view' ? null : 'view'))
                }
                onClose={() => setOpenDropdown(null)}
              />
              <SortDropdown
                sortOption={sortOption}
                onChange={setSortOption}
                isOpen={openDropdown === 'sort'}
                onToggle={() =>
                  setOpenDropdown((prev) => (prev === 'sort' ? null : 'sort'))
                }
                onClose={() => setOpenDropdown(null)}
              />

              <FilterDropdown
                filterOption={filterOption}
                onChange={setFilterOption}
                isOpen={openDropdown === 'filter'}
                onToggle={() =>
                  setOpenDropdown((prev) =>
                    prev === 'filter' ? null : 'filter',
                  )
                }
                onClose={() => setOpenDropdown(null)}
              />
            </div>
          </div>
        )}
        <div className="px-4">
          {selectedLibrary ? (
            <OverviewContent
              dataFinished={visibleData.length >= filteredData.length}
              fetchData={loadMoreVisible}
              loading={loading}
              extrasLoading={loadingExtra && !loading && !searchUsed}
              data={visibleData}
              libraryId={selectedLibrary}
              viewMode={viewMode}
              onDataChanged={refreshData}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
export default Overview
