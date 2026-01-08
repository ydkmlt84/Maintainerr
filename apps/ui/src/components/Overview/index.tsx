import { useMemo, useContext, useEffect, useRef, useState } from 'react'
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
  const loadingRef = useRef<boolean>(false)

  const [loadingExtra, setLoadingExtra] = useState<boolean>(false)

  const [allData, setAllData] = useState<IPlexMetadata[]>([])

  const [visibleData, setVisibleData] = useState<IPlexMetadata[]>([])

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

  const fetchAmount = 40
  const visibleCountRef = useRef<number>(0)
  const exclusionsRef = useRef<
    Map<
      number,
      { ids: number[]; type: 'global' | 'specific'; labels: string[] }
    >
  >(new Map())

  const setIsLoading = (val: boolean) => {
    loadingRef.current = val
  }

  useEffect(() => {
    if (!plexLibraries || plexLibraries.length === 0) return

    setTimeout(() => {
      if (
        loadingRef.current &&
        allData.length === 0 &&
        SearchCtx.search.text === ''
      ) {
        switchLib(selectedLibrary ? selectedLibrary : +plexLibraries[0].key)
      }
    }, 300)

    // Cleanup on unmount
    return () => {
      setAllData([])
      pageData.current = 0
    }
  }, [plexLibraries])

  useEffect(() => {
    if (!plexLibraries || plexLibraries.length === 0) return

    if (SearchCtx.search.text !== '') {
      ;(async () => {
        await fetchExclusions()
        const resp: IPlexMetadata[] = await GetApiHandler(
          `/plex/search/${SearchCtx.search.text}`,
        )
        setSearchUsed(true)
        pageData.current = resp.length * 50
        const annotated = attachExclusions(
          resp ? resp : [],
          exclusionsRef.current,
        )
        setAllData(annotated)
        setIsLoading(false)
      })()
      setSelectedLibrary(+plexLibraries[0]?.key)
    } else {
      setSearchUsed(false)
      setAllData([])
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
    if (SearchCtx.search.text === '') {
      fetchData()
    }
  }, [sortOption])

  const switchLib = (libraryId: number) => {
    // get all movies & shows from plex
    setOpenDropdown(null)
    setIsLoading(true)
    pageData.current = 0
    setSearchUsed(false)
    setSelectedLibrary(libraryId)
  }

  const plexSortFromOption = (option: SortOption) => {
    const [field, direction] = option.split(':') as [string, 'asc' | 'desc']
    if (field === 'title') return `titleSort:${direction}`
    if (field === 'added') return `addedAt:${direction}`
    return `${field}:${direction}`
  }

  const attachExclusions = (
    items: IPlexMetadata[],
    exclMap: Map<
      number,
      { ids: number[]; type: 'global' | 'specific'; labels: string[] }
    >,
  ) =>
    items.map((el) => {
      const exclusion = exclMap.get(+el.ratingKey)
      return {
        ...el,
        maintainerrExclusionId: exclusion ? exclusion.ids[0] : undefined,
        maintainerrExclusionType: exclusion ? exclusion.type : undefined,
        maintainerrExclusionLabels: exclusion ? exclusion.labels : undefined,
      }
    })

  const fetchExclusions = async () => {
    const resp: {
      id: number
      plexId: number
      ruleGroupId: number | null
      parent?: number
      collectionTitle?: string
      ruleGroupName?: string
    }[] =
      await GetApiHandler('/rules/exclusions/all')
    const map = new Map<
      number,
      { ids: number[]; type: 'global' | 'specific'; labels: string[] }
    >()

    const addToMap = (plexId: number, excl: (typeof resp)[number]) => {
      const label =
        excl.ruleGroupId === null
          ? 'Global'
          : excl.collectionTitle || excl.ruleGroupName || 'Collection'
      const type = excl.ruleGroupId === null ? 'global' : 'specific'
      const existing = map.get(plexId)
      if (existing) {
        existing.ids.push(excl.id)
        if (!existing.labels.includes(label)) {
          existing.labels.push(label)
        }
        existing.type =
          existing.type === 'global' || type === 'global'
            ? 'global'
            : 'specific'
        map.set(plexId, existing)
      } else {
        map.set(plexId, {
          ids: [excl.id],
          type: type,
          labels: [label],
        })
      }
    }

    resp?.forEach((excl) => {
      addToMap(excl.plexId, excl)
      if (excl.parent) {
        addToMap(excl.parent, excl)
      }
    })
    exclusionsRef.current = map
  }

  const fetchData = async () => {
    if (selectedLibraryRef.current && SearchCtx.search.text === '') {
      setIsLoading(true)
      await fetchExclusions()

      const sort = plexSortFromOption(sortOption)
      const resp: { totalSize: number; items: IPlexMetadata[] } =
        await GetApiHandler(
          `/plex/library/${selectedLibraryRef.current}/content/1?all=true&sort=${encodeURIComponent(
            sort,
          )}`,
        )

      pageData.current = 1
      const annotated = attachExclusions(
        resp && resp.items ? resp.items : [],
        exclusionsRef.current,
      )
      setAllData(annotated ?? [])
      setIsLoading(false)
      setLoadingExtra(false)
    }
  }

  const filteredData = useMemo(() => {
    return allData.filter((el) => {
      if (filterOption === 'excluded') return !!el.maintainerrExclusionType
      if (filterOption === 'nonExcluded') return !el.maintainerrExclusionType
      return true
    })
  }, [allData, filterOption])

  useEffect(() => {
    // reset visible slice when dataset or filters change
    visibleCountRef.current = Math.min(fetchAmount, filteredData.length)
    setVisibleData(filteredData.slice(0, visibleCountRef.current))
  }, [filteredData])

  const loadMoreVisible = () => {
    if (loadingExtra) return
    if (visibleCountRef.current >= filteredData.length) return
    setLoadingExtra(true)
    const nextCount = Math.min(
      visibleCountRef.current + fetchAmount,
      filteredData.length,
    )
    visibleCountRef.current = nextCount
    setVisibleData(filteredData.slice(0, nextCount))
    setLoadingExtra(false)
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
              dataFinished={visibleData.length >= filteredData.length}
              fetchData={loadMoreVisible}
              loading={loadingRef.current}
              extrasLoading={
                loadingExtra && !loadingRef.current && !searchUsed
              }
              data={visibleData}
              libraryId={selectedLibrary}
              viewMode={viewMode}
            />
          ) : undefined}
        </div>
      </div>
    </>
  )
}
export default Overview
