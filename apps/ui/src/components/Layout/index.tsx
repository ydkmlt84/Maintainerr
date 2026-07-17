import { ChartBarIcon } from '@heroicons/react/outline'
import {
  DocumentAddIcon,
  DocumentRemoveIcon,
  PhotographIcon,
  SearchIcon,
  XIcon,
} from '@heroicons/react/solid'
import {
  type MediaItem,
  type MediaItemWithParent,
} from '@maintainerr/contracts'
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react'
import {
  isRouteErrorResponse,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import GetApiHandler, { API_BASE_PATH } from '../../utils/ApiHandler'
import AddModal from '../AddModal'
import Button from '../Common/Button'
import { SmallLoadingSpinner } from '../Common/LoadingSpinner'
import MediaModalContent from '../Common/MediaCard/MediaModal'
import NavBar from './NavBar'

type LayoutShellProps = {
  children: ReactNode
}

const LayoutShell: React.FC<LayoutShellProps> = ({ children }) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const basePath = import.meta.env.VITE_BASE_PATH ?? ''
  const location = useLocation()
  const isMediaRoute = /^\/media(?:\/.*)?$/.test(location.pathname)
  const shouldShowStatsDrawer =
    !/^\/(?:overview)?$/.test(location.pathname) &&
    !/^\/settings(?:\/.*)?$/.test(location.pathname)

  useEffect(() => {
    // Check if setup is complete, if not redirect to appropriate settings page
    Promise.all([
      GetApiHandler('/settings/test/setup'),
      GetApiHandler('/settings'),
    ]).then(([setupDone, settings]) => {
      if (!setupDone) {
        const mediaServerType = settings?.media_server_type
        if (mediaServerType) {
          // User has chosen a media server, redirect to its settings
          navigate(`/settings/${mediaServerType}`)
        } else {
          // No media server chosen yet, go to main settings to choose
          navigate('/settings/main')
        }
      }
    })
  }, [navigate, location.pathname])

  return (
    <section>
      <title>Maintainerr</title>
      <link rel="icon" href={`${basePath}/favicon.ico`} />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href={`${basePath}/apple-touch-icon.png`}
      />
      <div className="flex h-full min-h-full min-w-0 bg-zinc-900">
        <div className="pwa-only fixed inset-0 z-20 h-1 w-full border-zinc-700 md:border-t" />
        <div className="absolute top-0 h-64 w-full bg-gradient-to-bl from-zinc-800 to-zinc-900">
          <div className="relative inset-0 h-full w-full bg-gradient-to-t from-zinc-900 to-transparent" />
        </div>
        <NavBar onSearchOpen={() => setSearchOpen(true)} />
        <SpotlightSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
        {shouldShowStatsDrawer ? <GlobalStatsDrawer /> : undefined}

        <main
          className={`relative w-full min-w-0 focus:outline-none ${
            isMediaRoute ? 'top-[6.5rem]' : 'top-[7.5rem]'
          }`}
          tabIndex={0}
        >
          <div className="mb-6">
            <div className="max-w-8xl mx-auto px-4">
              <ToastContainer
                stacked
                position="top-right"
                autoClose={4500}
                hideProgressBar={false}
                theme="dark"
                closeOnClick
              />
              {children}
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}

interface GlobalStats {
  rules?: number
  storage?: AppStorageStats
  choppingBlock?: AppChoppingBlockStats
  libraries?: AppLibraryStats[]
}

interface AppStorageStats {
  totalSpace: number
  usedSpace: number
  freeSpace: number
  sourceCount: number
}

interface AppLibraryStats {
  id: string
  title: string
  type: 'movie' | 'show'
  itemCount: number
}

interface AppChoppingBlockStats {
  totalSizeBytes: number
  collections: AppChoppingBlockCollectionStats[]
}

interface AppChoppingBlockCollectionStats {
  id: number
  title: string
  totalSizeBytes: number
}

const formatStatValue = (value?: number): string =>
  value == null ? '--' : value.toLocaleString()

const formatBytes = (value?: number): string => {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '--'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}

const getStoragePercent = (storage?: AppStorageStats): number => {
  if (!storage?.totalSpace) {
    return 0
  }

  return Math.min(
    Math.max((storage.usedSpace / storage.totalSpace) * 100, 0),
    100,
  )
}

const getStorageRemainingPercent = (storage?: AppStorageStats): number => {
  if (!storage?.totalSpace) {
    return 0
  }

  return Math.min(
    Math.max((storage.freeSpace / storage.totalSpace) * 100, 0),
    100,
  )
}

const getChoppingBlockStoragePercent = (
  storage?: AppStorageStats,
  choppingBlock?: AppChoppingBlockStats,
): number => {
  if (!storage?.totalSpace || !choppingBlock?.totalSizeBytes) {
    return 0
  }

  return Math.min(
    Math.max((choppingBlock.totalSizeBytes / storage.totalSpace) * 100, 0),
    100,
  )
}

const GlobalStatsDrawer: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<GlobalStats>({})
  const [loading, setLoading] = useState(false)
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const storagePercent = getStoragePercent(stats.storage)
  const storageRemainingPercent = getStorageRemainingPercent(stats.storage)
  const choppingBlockStoragePercent = getChoppingBlockStoragePercent(
    stats.storage,
    stats.choppingBlock,
  )

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true
    queueMicrotask(() => setLoading(true))
    GetApiHandler<GlobalStats>('/stats')
      .then((statsResponse) => {
        if (active) {
          setStats(statsResponse)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [open])

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close stats drawer"
          className="fixed inset-0 z-30 hidden cursor-default bg-transparent lg:block"
          onClick={() => setOpen(false)}
        />
      ) : undefined}
      <div
        ref={drawerRef}
        className={`fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 transition-transform duration-300 ease-out lg:block ${
          open ? 'translate-x-0' : '-translate-x-80'
        }`}
      >
        <button
          type="button"
          aria-label={open ? 'Hide stats drawer' : 'Show stats drawer'}
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          className="stats-drawer-tab absolute right-0 top-1/2 flex h-14 w-11 -translate-y-1/2 translate-x-full items-center justify-center rounded-r-2xl text-zinc-100 transition hover:text-white"
        >
          <ChartBarIcon className="h-5 w-5" />
        </button>
        <aside className="stats-drawer relative h-[min(34rem,calc(100vh-9rem))] w-80 overflow-hidden rounded-r-3xl text-zinc-100">
          <dl className="hide-scrollbar relative z-10 grid h-full grid-cols-2 gap-3 overflow-y-auto p-5">
            <div className="stats-value-block col-span-2 rounded-xl p-3">
              <dt className="text-xs font-medium uppercase text-zinc-400">
                Storage
              </dt>
              <dd className="mt-1 flex items-end justify-between gap-3">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-xl font-semibold text-white">
                    {loading ? '--' : formatBytes(stats.storage?.freeSpace)}
                  </span>
                  <span className="text-xs text-zinc-400">remaining</span>
                </span>
                <span className="pb-0.5 text-xs font-medium text-maintainerr-300">
                  {loading ? '--' : `${storageRemainingPercent.toFixed(0)}%`}
                </span>
              </dd>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-950/80">
                <div
                  className="h-full rounded-full bg-maintainerr transition-[width] duration-500"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <dd className="mt-2 flex justify-between gap-3 text-[11px] leading-4 text-zinc-400">
                <span>{formatBytes(stats.storage?.usedSpace)} used</span>
                <span>{formatBytes(stats.storage?.totalSpace)} total</span>
              </dd>
            </div>
            <div className="stats-value-block col-span-2 rounded-xl p-3">
              <dt className="text-xs font-medium uppercase text-zinc-400">
                Chopping Block
              </dt>
              <dd className="mt-1 flex items-end justify-between gap-3">
                <span className="text-lg font-semibold text-white">
                  {loading
                    ? '--'
                    : formatBytes(stats.choppingBlock?.totalSizeBytes)}
                </span>
                <span className="pb-0.5 text-xs font-medium text-maintainerr-300">
                  {loading
                    ? '--'
                    : `${choppingBlockStoragePercent.toFixed(2)}%`}
                </span>
              </dd>
              <dd className="hide-scrollbar mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                {stats.choppingBlock?.collections?.length ? (
                  stats.choppingBlock.collections.map((collection) => (
                    <Link
                      key={collection.id}
                      to={`/collections/${collection.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs leading-4 text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
                    >
                      <span className="truncate">{collection.title}</span>
                      <span className="shrink-0 font-medium text-maintainerr-300">
                        {formatBytes(collection.totalSizeBytes)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <span className="block text-xs text-zinc-400">
                    {loading
                      ? 'Loading collections...'
                      : 'No sized collections'}
                  </span>
                )}
              </dd>
            </div>
            {(stats.libraries ?? []).map((library) => (
              <div
                key={library.id}
                className="stats-value-block rounded-xl p-3"
              >
                <dt className="truncate text-xs font-medium uppercase text-zinc-400">
                  {library.title}
                </dt>
                <dd className="mt-1 text-xl font-semibold text-white">
                  {formatStatValue(library.itemCount)}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  )
}

interface SpotlightSearchProps {
  open: boolean
  onClose: () => void
}

const padMediaIndex = (value: number): string =>
  value.toString().padStart(2, '0')

const getSpotlightTitle = (item: MediaItem): string => {
  return item.grandparentTitle
    ? item.grandparentTitle
    : item.parentTitle
      ? item.parentTitle
      : item.title
}

const getSpotlightMeta = (item: MediaItem): string => {
  if (item.type === 'episode' && item.index != null) {
    if (item.parentIndex != null) {
      return `S${padMediaIndex(item.parentIndex)}E${padMediaIndex(item.index)}`
    }
    return `E${padMediaIndex(item.index)}`
  }

  if (item.type === 'season') {
    return item.index != null ? `Season ${item.index}` : item.title
  }

  return item.year ? item.year.toString().slice(0, 4) : item.type
}

const getSpotlightSecondary = (item: MediaItem): string => {
  if (item.type === 'episode') {
    return item.title
  }

  if (item.type === 'season' && item.parentTitle) {
    return item.parentTitle
  }

  return item.library?.title ?? item.type
}

const getSpotlightTmdbId = (item: MediaItem): string | undefined => {
  const parentItem = (item as MediaItemWithParent).parentItem

  if (item.type === 'season' || item.type === 'episode') {
    return parentItem?.providerIds?.tmdb?.[0]
  }

  return item.providerIds?.tmdb?.[0] ?? parentItem?.providerIds?.tmdb?.[0]
}

const getSpotlightAudienceRating = (item: MediaItem): number => {
  return item.ratings?.find((rating) => rating.type === 'audience')?.value ?? 0
}

const formatSpotlightRating = (item: MediaItem): string => {
  const rating = getSpotlightAudienceRating(item)
  return rating > 0 ? rating.toFixed(1) : '-'
}

const formatSpotlightViews = (item: MediaItem): string => {
  const views = item.viewCount ?? item.watchedChildCount
  return views != null ? views.toString() : '-'
}

const formatSpotlightDate = (value?: Date): string => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

const getSpotlightTypeLabel = (item: MediaItem): string => {
  if (item.type === 'show') {
    return 'TV'
  }

  return item.type.toUpperCase()
}

const SpotlightThumbnail = ({ item }: { item: MediaItem }) => {
  const [posterPath, setPosterPath] = useState<string>()
  const [plexPosterFailed, setPlexPosterFailed] = useState(false)
  const tmdbId = getSpotlightTmdbId(item)
  const posterType = item.type === 'movie' ? 'movie' : 'show'
  const plexPosterId =
    item.type === 'season'
      ? item.id
      : item.type === 'episode'
        ? item.grandparentId
        : undefined
  const plexPosterUrl = plexPosterId
    ? `${API_BASE_PATH}/api/tautulli/image?path=${encodeURIComponent(
        `/library/metadata/${plexPosterId}/thumb/0`,
      )}`
    : undefined

  useEffect(() => {
    if (!tmdbId) {
      queueMicrotask(() => setPosterPath(undefined))
      return
    }

    let active = true
    GetApiHandler<string>(`/moviedb/image/${posterType}/${tmdbId}`).then(
      (path) => {
        if (active) {
          setPosterPath(path || undefined)
        }
      },
    )

    return () => {
      active = false
    }
  }, [posterType, tmdbId])

  return (plexPosterUrl && !plexPosterFailed) || posterPath ? (
    <img
      src={
        plexPosterUrl && !plexPosterFailed
          ? plexPosterUrl
          : `https://image.tmdb.org/t/p/w92${posterPath}`
      }
      alt=""
      className="h-[4.5rem] w-12 flex-shrink-0 rounded-md object-cover shadow shadow-black/30"
      onError={() => {
        if (plexPosterUrl && !plexPosterFailed) {
          setPlexPosterFailed(true)
        } else {
          setPosterPath(undefined)
        }
      }}
    />
  ) : (
    <span className="flex h-[4.5rem] w-12 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-zinc-600 bg-zinc-950/70 text-zinc-500 shadow-inner shadow-black/20">
      <PhotographIcon className="h-5 w-5" />
      <span className="max-w-full truncate px-1 text-[8px] font-bold uppercase">
        {getSpotlightTypeLabel(item)}
      </span>
    </span>
  )
}

const SpotlightSearch: React.FC<SpotlightSearchProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const [submittedPlexId, setSubmittedPlexId] = useState<string>()
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | undefined>()
  const [mediaAction, setMediaAction] = useState<{
    item: MediaItem
    type: 'add' | 'exclude'
  }>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    queueMicrotask(() => {
      setQuery('')
      setSubmittedPlexId(undefined)
      setResults([])
      setLoading(false)
    })
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    const trimmedQuery = query.trim().toLowerCase()
    const isPlexIdQuery = /^\d+$/.test(trimmedQuery)
    if (isPlexIdQuery && submittedPlexId !== trimmedQuery) {
      queueMicrotask(() => {
        setResults([])
        setLoading(false)
      })
      return
    }
    if (!isPlexIdQuery && trimmedQuery.length < 2) {
      queueMicrotask(() => {
        setResults([])
        setLoading(false)
      })
      return
    }

    let active = true
    queueMicrotask(() => setLoading(true))
    const searchTimer = setTimeout(() => {
      const request = isPlexIdQuery
        ? GetApiHandler<MediaItem | undefined>(
            `/media-server/meta/${encodeURIComponent(trimmedQuery)}`,
          ).then((item) => (item ? [item] : []))
        : GetApiHandler<MediaItem[]>(
            `/media-server/search/${encodeURIComponent(trimmedQuery)}`,
          )

      request
        .then((resp) => {
          if (active) {
            setResults(resp ?? [])
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false)
          }
        })
    }, 250)

    return () => {
      active = false
      clearTimeout(searchTimer)
    }
  }, [query, open, submittedPlexId])

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    if (nextQuery.trim() !== submittedPlexId) {
      setSubmittedPlexId(undefined)
    }
  }

  const handleClose = () => {
    onClose()
    setSelectedMedia(undefined)
    setMediaAction(undefined)
  }

  const displayResults = results.slice(0, 40)

  if (!open) {
    return undefined
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={handleClose} />
      <div className="spotlight-modal fixed left-1/2 top-20 z-50 w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 overflow-hidden rounded-xl shadow-lg sm:top-[7.5rem]">
        <div className="relative z-10">
          <div className="flex items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-4 py-4">
            <SearchIcon className="h-6 w-6 flex-shrink-0 text-zinc-300" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={(event) => {
                const plexId = query.trim()
                if (event.key === 'Enter' && /^\d+$/.test(plexId)) {
                  event.preventDefault()
                  setSubmittedPlexId(plexId)
                }
              }}
              placeholder="Search media or Plex ID"
              className="min-w-0 flex-1 bg-transparent text-lg font-medium text-white placeholder-slate-400 outline-none"
            />
            <button
              className="action-lens-button inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 text-zinc-200 transition hover:border-zinc-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-maintainerr/50"
              aria-label="Close search"
              onClick={handleClose}
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 sm:max-h-[min(34rem,calc(100dvh-12rem))]">
            {loading ? (
              <div className="flex h-28 items-center justify-center">
                <SmallLoadingSpinner />
              </div>
            ) : /^\d+$/.test(query.trim()) &&
              submittedPlexId !== query.trim() ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Press Enter to look up this Plex ID.
              </div>
            ) : !/^\d+$/.test(query.trim()) && query.trim().length < 2 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Search by title or enter a Plex ID.
              </div>
            ) : displayResults.length > 0 ? (
              <div>
                <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_7rem_10rem] gap-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
                  <span>Title</span>
                  <span>Rating</span>
                  <span>Views</span>
                  <span>Last Viewed</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="space-y-1.5">
                  {displayResults.map((item) => (
                    <div
                      key={item.id}
                      className="panel-surface group grid w-full min-w-0 gap-3 rounded-lg px-3 py-3 text-left transition hover:border-zinc-500 hover:bg-zinc-800 md:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_7rem_10rem] md:items-center"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 items-start gap-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-maintainerr/50"
                        onClick={() => setSelectedMedia(item)}
                      >
                        <SpotlightThumbnail item={item} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white group-hover:text-zinc-50">
                            {getSpotlightTitle(item)}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {getSpotlightSecondary(item)} / Plex ID {item.id}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-400">
                            {getSpotlightMeta(item)}
                          </span>
                          <span className="mt-2 grid grid-cols-3 gap-2 text-[10px] md:hidden">
                            <span className="min-w-0">
                              <span className="block uppercase text-slate-500">
                                Rating
                              </span>
                              <span className="block truncate font-semibold text-slate-200">
                                {formatSpotlightRating(item)}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span className="block uppercase text-slate-500">
                                Views
                              </span>
                              <span className="block truncate text-slate-300">
                                {formatSpotlightViews(item)}
                              </span>
                            </span>
                            <span className="min-w-0">
                              <span className="block uppercase text-slate-500">
                                Last viewed
                              </span>
                              <span className="block truncate text-slate-300">
                                {formatSpotlightDate(item.lastViewedAt)}
                              </span>
                            </span>
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {item.maintainerrExclusionType ? (
                              <span className="rounded-full border border-zinc-500 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
                                Excluded
                              </span>
                            ) : undefined}
                            {item.maintainerrIsManual ? (
                              <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                                Manual
                              </span>
                            ) : undefined}
                            {item.collections?.slice(0, 2).map((collection) => (
                              <span
                                key={`${item.id}-${collection}`}
                                className="max-w-36 truncate rounded-full border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-200"
                              >
                                {collection}
                              </span>
                            ))}
                            {(item.collections?.length ?? 0) > 2 ? (
                              <span className="rounded-full border border-slate-500/25 bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                                +{(item.collections?.length ?? 0) - 2}
                              </span>
                            ) : undefined}
                          </span>
                        </span>
                      </button>
                      <span className="hidden text-sm font-semibold text-slate-200 md:block">
                        {formatSpotlightRating(item)}
                      </span>
                      <span className="hidden text-sm text-slate-300 md:block">
                        {formatSpotlightViews(item)}
                      </span>
                      <span className="hidden text-sm text-slate-300 md:block">
                        {formatSpotlightDate(item.lastViewedAt)}
                      </span>
                      <span className="flex w-full overflow-hidden rounded-md border-t border-zinc-700 pt-2 shadow-md md:border-0 md:pt-0">
                        <Button
                          type="button"
                          buttonType="twin-primary-l"
                          buttonSize="sm"
                          aria-label={`Add ${getSpotlightTitle(item)}`}
                          className="h-8 min-w-0 flex-1 px-2 text-zinc-200"
                          onClick={() => setMediaAction({ item, type: 'add' })}
                        >
                          <DocumentAddIcon className="mr-1.5 h-3.5 w-3.5" />
                          <span>Add</span>
                        </Button>
                        <Button
                          type="button"
                          buttonType="twin-primary-r"
                          buttonSize="sm"
                          aria-label={`Exclude ${getSpotlightTitle(item)}`}
                          className="h-8 min-w-0 flex-1 px-2 text-zinc-200"
                          onClick={() =>
                            setMediaAction({ item, type: 'exclude' })
                          }
                        >
                          <DocumentRemoveIcon className="mr-1.5 h-3.5 w-3.5" />
                          <span>Excl</span>
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
                {results.length > displayResults.length ? (
                  <div className="px-3 py-3 text-center text-xs text-slate-500">
                    Showing first {displayResults.length} of {results.length}{' '}
                    results.
                  </div>
                ) : undefined}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                No results found.
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedMedia ? (
        <MediaModalContent
          id={selectedMedia.id}
          onClose={() => setSelectedMedia(undefined)}
          title={getSpotlightTitle(selectedMedia)}
          summary={selectedMedia.summary || 'No description available.'}
          mediaType={selectedMedia.type}
          tmdbid={getSpotlightTmdbId(selectedMedia)}
          year={getSpotlightMeta(selectedMedia)}
          userScore={getSpotlightAudienceRating(selectedMedia)}
        />
      ) : undefined}
      {mediaAction ? (
        <AddModal
          mediaServerId={mediaAction.item.id}
          libraryId={mediaAction.item.library?.id}
          type={mediaAction.item.type}
          modalType={mediaAction.type}
          onCancel={() => setMediaAction(undefined)}
          onSubmit={() => setMediaAction(undefined)}
        />
      ) : undefined}
    </>
  )
}

const Layout: React.FC = () => {
  return (
    <LayoutShell>
      <Outlet />
    </LayoutShell>
  )
}

const describeRouteError = (
  error: unknown,
): { title: string; message: string } => {
  if (!error) {
    return {
      title: 'Unknown error',
      message: 'An unexpected error occurred.',
    }
  }

  if (isRouteErrorResponse(error)) {
    const dataMessage =
      typeof error.data === 'string'
        ? error.data
        : (error.data?.message ?? error.data?.error)

    return {
      title: `${error.status} ${error.statusText}`.trim(),
      message: dataMessage ?? 'The server returned an unexpected response.',
    }
  }

  if (error instanceof Error) {
    return {
      title: error.name ?? 'Error',
      message: error.message,
    }
  }

  return {
    title: 'Unexpected error',
    message: String(error),
  }
}

export const LayoutErrorBoundary: React.FC = () => {
  const error = useRouteError()
  const navigate = useNavigate()
  const { title, message } = describeRouteError(error)

  return (
    <LayoutShell>
      <div
        role="alert"
        className="rounded border border-red-500/60 bg-red-500/10 p-6 text-red-100 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-red-200">{title}</h2>
        <p className="mt-2 text-sm text-red-100">{message}</p>
        <p className="mt-4 text-xs text-red-200/80">
          You can try going back or reloading the page. If the problem persists,
          please check the browser console for more details.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="action-lens-button rounded bg-red-500/30 px-4 py-2 text-sm font-medium text-red-50 transition hover:bg-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-300/60"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
          <button
            className="action-lens-button rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-zinc-500/60"
            onClick={() => navigate('/media')}
          >
            Go To Media
          </button>
        </div>
      </div>
    </LayoutShell>
  )
}

export default Layout
