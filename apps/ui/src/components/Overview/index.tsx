import { clone } from 'lodash'
import { useContext, useEffect, useRef, useState } from 'react'
import { usePlexLibraries } from '../../api/plex'
import SearchContext from '../../contexts/search-context'
import GetApiHandler from '../../utils/ApiHandler'
import FilterDropdown, { FilterOption } from '../Common/FilterDropdown'
import LibrarySwitcher from '../Common/OverviewLibrarySwitcher'
import SortDropdown, { SortOption } from '../Common/SortDropdown'
import ViewToggleDropdown, { ViewMode } from '../Common/ViewModeDropdown'
import OverviewContent, { IPlexMetadata } from './Content'

const Overview = () => {
  // const [isLoading, setIsLoading] = useState<Boolean>(false)
  const loadingRef = useRef<boolean>(false)

  const [loadingExtra, setLoadingExtra] = useState<boolean>(false)

  const [data, setData] = useState<IPlexMetadata[]>([])
  const dataRef = useRef<IPlexMetadata[]>([])

  const [totalSize, setTotalSize] = useState<number>(999)
  const totalSizeRef = useRef<number>(999)

  const [selectedLibrary, setSelectedLibrary] = useState<number>()
  const selectedLibraryRef = useRef<number>(undefined)
  const [searchUsed, setSearchUsed] = useState<boolean>(false)

  const pageData = useRef<number>(0)
  const SearchCtx = useContext(SearchContext)

  const { data: plexLibraries } = usePlexLibraries()

  const [viewMode, setViewMode] = useState<ViewMode>('poster')
  const [sortOption, setSortOption] = useState<SortOption>('title:asc')
  const [filterOption, setFilterOption] = useState<FilterOption>('all')

  type OpenDropdown = 'view' | 'sort' | 'filter' | null

  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null)

  const fetchAmount = 30

  const setIsLoading = (val: boolean) => {
    loadingRef.current = val
  }

  useEffect(() => {
    if (!plexLibraries || plexLibraries.length === 0) return

    setTimeout(() => {
      if (
        loadingRef.current &&
        data.length === 0 &&
        SearchCtx.search.text === ''
      ) {
        switchLib(selectedLibrary ? selectedLibrary : +plexLibraries[0].key)
      }
    }, 300)

    // Cleanup on unmount
    return () => {
      setData([])
      dataRef.current = []
      totalSizeRef.current = 999
      pageData.current = 0
    }
  }, [plexLibraries])

  useEffect(() => {
    if (!plexLibraries || plexLibraries.length === 0) return

    if (SearchCtx.search.text !== '') {
      GetApiHandler(`/plex/search/${SearchCtx.search.text}`).then(
        (resp: IPlexMetadata[]) => {
          setSearchUsed(true)
          setTotalSize(resp.length)
          pageData.current = resp.length * 50
          setData(resp ? resp : [])
          setIsLoading(false)
        },
      )
      setSelectedLibrary(+plexLibraries[0]?.key)
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
    if (SearchCtx.search.text !== '') {
      setOpenDropdown(null)
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

  const switchLib = (libraryId: number) => {
    // get all movies & shows from plex
    setOpenDropdown(null)
    setIsLoading(true)
    pageData.current = 0
    setTotalSize(999)
    setData([])
    dataRef.current = []
    setSearchUsed(false)
    setSelectedLibrary(libraryId)
  }

  const fetchData = async () => {
    // This function didn't work with normal state. Used a state/ref hack as a result.
    if (
      selectedLibraryRef.current &&
      SearchCtx.search.text === '' &&
      totalSizeRef.current >= pageData.current * fetchAmount
    ) {
      const askedLib = clone(selectedLibraryRef.current)

      const resp: { totalSize: number; items: IPlexMetadata[] } =
        await GetApiHandler(
          `/plex/library/${selectedLibraryRef.current}/content/${
            pageData.current + 1
          }?amount=${fetchAmount}`,
        )

      if (askedLib === selectedLibraryRef.current) {
        // check lib again, we don't want to change array when lib was changed
        setTotalSize(resp.totalSize)
        pageData.current = pageData.current + 1
        setData([...dataRef.current, ...(resp && resp.items ? resp.items : [])])
        setIsLoading(false)
      }
      setLoadingExtra(false)
      setIsLoading(false)
    }
  }

  return (
    <>
      <title>Overview - Maintainerr</title>
      <div className="w-full">
        {!searchUsed && (
          <div className="sticky top-16 z-10 flex flex-col items-center justify-center overflow-visible bg-zinc-900 pt-2 md:flex-row">
            <div className="w-full px-4 md:w-1/2">
              <LibrarySwitcher
                shouldShowAllOption={false}
                onLibraryChange={switchLib}
              />
            </div>

            <div className="mt-2 flex w-full flex-row items-center justify-end gap-2 px-4 md:mt-0 md:w-1/2 md:pr-4">
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
        <div className="mt-4 px-4">
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
              libraryId={selectedLibrary}
            />
          ) : undefined}
        </div>
      </div>
    </>
  )
}
export default Overview
