import {
  TraktDiscoverItem,
  TraktDiscoverResponse,
  TraktHistoryMutation,
  TraktWatchlistMutation,
} from '@maintainerr/contracts'
import {
  BookmarkIcon,
  ChartBarIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  ExternalLinkIcon,
  FilmIcon,
  PlayIcon,
  RefreshIcon,
  XIcon,
} from '@heroicons/react/outline'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import GetApiHandler, {
  DeleteApiHandler,
  PostApiHandler,
} from '../../utils/ApiHandler'
import { getTmdbImageUrl } from '../../utils/TmdbImage'
import ActorTooltip, { getActorProfileImageUrl } from '../Common/ActorTooltip'
import Button from '../Common/Button'
import LoadingSpinner from '../Common/LoadingSpinner'
import Modal from '../Common/Modal'

interface TmdbCastMember {
  id: number
  name: string
  character?: string
  profilePath?: string
}

interface TmdbMediaAssets {
  backdropPath?: string
  trailerUrl?: string
  cast: TmdbCastMember[]
}

type SectionKey = keyof TraktDiscoverResponse['sections']

const sections: { key: SectionKey; title: string }[] = [
  {
    key: 'trendingMovies',
    title: 'Trending Movies',
  },
  {
    key: 'popularMovies',
    title: 'Popular Movies',
  },
  {
    key: 'trendingShows',
    title: 'Trending TV Shows',
  },
  {
    key: 'popularShows',
    title: 'Popular TV Shows',
  },
]

const gridVisibility = (index: number): string => {
  if (index < 4) return ''
  if (index < 6) return 'hidden xs:block'
  if (index < 8) return 'hidden sm:block'
  if (index < 10) return 'hidden md:block'
  if (index < 12) return 'hidden lg:block'
  return 'hidden xl:block'
}

const itemKey = (item: TraktDiscoverItem) => `${item.type}:${item.ids.trakt}`

export const getDiscoverSnapshot = (
  data: TraktDiscoverResponse,
  limit = 15,
): TraktDiscoverItem[] => {
  const sources = [
    data.sections.trendingMovies,
    data.sections.trendingShows,
    data.sections.popularMovies,
    data.sections.popularShows,
  ]
  const snapshot: TraktDiscoverItem[] = []
  const seen = new Set<string>()
  const longestSource = Math.max(0, ...sources.map((items) => items.length))

  for (
    let index = 0;
    index < longestSource && snapshot.length < limit;
    index++
  ) {
    for (const source of sources) {
      const item = source[index]
      if (!item || seen.has(itemKey(item))) continue
      seen.add(itemKey(item))
      snapshot.push(item)
      if (snapshot.length === limit) break
    }
  }

  return snapshot
}

const Discover = () => {
  const [data, setData] = useState<TraktDiscoverResponse>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<TraktDiscoverItem>()
  const [mutating, setMutating] = useState<string>()
  const [markingWatched, setMarkingWatched] = useState<string>()

  const load = useCallback(async () => {
    setError(false)
    try {
      setData(await GetApiHandler<TraktDiscoverResponse>('/trakt/discover'))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const refresh = () => void load()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [load])

  const updateWatchlist = async (item: TraktDiscoverItem) => {
    if (!data?.connected || mutating || markingWatched) return
    const key = itemKey(item)
    setMutating(key)
    const payload: TraktWatchlistMutation = {
      type: item.type,
      traktId: item.ids.trakt,
    }

    try {
      if (item.watchlisted) {
        await DeleteApiHandler('/trakt/watchlist', payload)
      } else {
        await PostApiHandler('/trakt/watchlist', payload)
      }
      const watchlisted = !item.watchlisted
      setData((current) =>
        current
          ? {
              ...current,
              sections: Object.fromEntries(
                Object.entries(current.sections).map(([section, items]) => [
                  section,
                  items.map((candidate) =>
                    itemKey(candidate) === key
                      ? { ...candidate, watchlisted }
                      : candidate,
                  ),
                ]),
              ) as TraktDiscoverResponse['sections'],
            }
          : current,
      )
      setSelected((current) =>
        current && itemKey(current) === key
          ? { ...current, watchlisted }
          : current,
      )
      toast.success(
        watchlisted
          ? `${item.title} added to your Trakt watchlist.`
          : `${item.title} removed from your Trakt watchlist.`,
      )
    } catch {
      toast.error('Could not update the Trakt watchlist.')
    } finally {
      setMutating(undefined)
    }
  }

  const markWatched = async (item: TraktDiscoverItem) => {
    if (!data?.connected || mutating || markingWatched || item.watched) return
    const key = itemKey(item)
    const payload: TraktHistoryMutation = {
      type: item.type,
      traktId: item.ids.trakt,
    }
    setMarkingWatched(key)

    try {
      await PostApiHandler('/trakt/history', payload)
      setData((current) =>
        current
          ? {
              ...current,
              sections: Object.fromEntries(
                Object.entries(current.sections).map(([section, items]) => [
                  section,
                  items.map((candidate) =>
                    itemKey(candidate) === key
                      ? { ...candidate, watched: true }
                      : candidate,
                  ),
                ]),
              ) as TraktDiscoverResponse['sections'],
            }
          : current,
      )
      setSelected((current) =>
        current && itemKey(current) === key
          ? { ...current, watched: true }
          : current,
      )
      toast.success(`${item.title} marked as watched on Trakt.`)
    } catch {
      toast.error('Could not mark the item as watched on Trakt.')
    } finally {
      setMarkingWatched(undefined)
    }
  }

  if (loading) {
    return (
      <>
        <title>Discover - Maintainerr</title>
        <LoadingSpinner />
      </>
    )
  }

  if (error && !data) {
    return (
      <>
        <title>Discover - Maintainerr</title>
        <div className="mx-auto max-w-2xl py-12 text-center">
          <div className="rounded-xl border border-red-900 bg-red-950/30 p-8">
            <p className="text-red-200">Discovery could not be loaded.</p>
            <Button className="mt-4" onClick={() => void load()}>
              Try Again
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (!data?.configured) {
    return (
      <>
        <title>Discover - Maintainerr</title>
        <div className="mx-auto max-w-3xl py-12">
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-8 text-center shadow-xl shadow-black/20">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-maintainerr-400 ring-1 ring-zinc-700">
              <FilmIcon className="h-7 w-7" />
            </span>
            <h1 className="mt-5 text-2xl font-bold text-white">
              Discover movies and TV with Trakt
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Connect Trakt to browse trending and popular titles that are not
              already in your media library, then manage your Trakt watchlist
              directly from Maintainerr.
            </p>
            <Link
              to="/settings/services"
              className="mt-6 inline-flex rounded-md bg-maintainerr-600 px-4 py-2 font-medium text-white transition hover:bg-maintainerr-500"
            >
              Configure Trakt
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <title>Discover - Maintainerr</title>
      <div className="mx-auto w-full max-w-[96rem] space-y-8 pb-12 pt-4">
        <div className="flex justify-end">
          <Button buttonSize="sm" onClick={() => void load()}>
            <RefreshIcon className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {!data.connected && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-100">
              Connect your Trakt account to add and remove watchlist items.
            </p>
            <Link
              to="/settings/services"
              className="shrink-0 text-sm font-semibold text-maintainerr-400 hover:text-maintainerr-300"
            >
              Connect Trakt
            </Link>
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 text-center">
            <p className="text-red-200">Discovery could not be loaded.</p>
            <Button className="mt-4" onClick={() => void load()}>
              Try Again
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            <DiscoverSection
              key={section.key}
              title={section.title}
              items={data.sections[section.key]}
              onSelect={setSelected}
            />
          ))
        )}
      </div>

      {selected && (
        <DiscoverDetailsModal
          item={selected}
          connected={data.connected}
          updating={mutating === itemKey(selected)}
          markingWatched={markingWatched === itemKey(selected)}
          onWatchlist={() => void updateWatchlist(selected)}
          onMarkWatched={() => void markWatched(selected)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  )
}

const DiscoverSection = ({
  title,
  items,
  onSelect,
}: {
  title: string
  items: TraktDiscoverItem[]
  onSelect: (item: TraktDiscoverItem) => void
}) => (
  <section>
    <h2 className="text-xl font-bold text-zinc-100">{title}</h2>
    {items.length ? (
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((item, index) => (
          <li key={itemKey(item)} className={gridVisibility(index)}>
            <DiscoverPoster item={item} onSelect={() => onSelect(item)} />
          </li>
        ))}
      </ul>
    ) : (
      <div className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-800/40 px-4 py-8 text-center text-sm text-zinc-500">
        No titles to show after filtering your library.
      </div>
    )}
  </section>
)

const DiscoverPoster = ({
  item,
  onSelect,
}: {
  item: TraktDiscoverItem
  onSelect: () => void
}) => {
  const posterUrl = item.ids.tmdb
    ? getTmdbImageUrl({
        scope: 'discover',
        variant: 'poster',
        type: item.type,
        tmdbId: item.ids.tmdb,
      })
    : undefined

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group block w-full text-left focus:outline-none"
      aria-label={`View ${item.title}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg shadow-black/25 transition group-hover:border-zinc-500 group-focus:ring-2 group-focus:ring-maintainerr-400">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <FilmIcon className="h-10 w-10" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-zinc-950/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {item.type === 'movie' ? 'Movie' : 'TV'}
        </span>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {item.watched ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white shadow">
              <EyeIcon className="h-3 w-3" />
              Watched
            </span>
          ) : null}
          {item.watchlisted ? (
            <span className="flex items-center gap-1 rounded-full bg-maintainerr-600 px-2 py-1 text-[10px] font-bold text-white shadow">
              <CheckIcon className="h-3 w-3" />
              Watchlisted
            </span>
          ) : null}
        </div>
        {item.servarr.length ? (
          <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
            {item.servarr.map((status) => (
              <ServarrBadge
                key={`${status.service}-${status.instanceName}`}
                status={status}
              />
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-zinc-200">
        {item.title}
      </p>
      <p className="text-xs text-zinc-500">{item.year ?? 'Year unavailable'}</p>
    </button>
  )
}

export const DiscoverDetailsModal = ({
  item,
  connected,
  updating,
  markingWatched,
  onWatchlist,
  onMarkWatched,
  onClose,
}: {
  item: TraktDiscoverItem
  connected: boolean
  updating: boolean
  markingWatched: boolean
  onWatchlist: () => void
  onMarkWatched: () => void
  onClose: () => void
}) => {
  const [assets, setAssets] = useState<TmdbMediaAssets>()
  const [playingTrailer, setPlayingTrailer] = useState(false)
  const basePath = import.meta.env.VITE_BASE_PATH ?? ''
  const trailerVideoId = (() => {
    if (!assets?.trailerUrl) return undefined
    try {
      return new URL(assets.trailerUrl).searchParams.get('v') ?? undefined
    } catch {
      return undefined
    }
  })()

  useEffect(() => {
    if (!item.ids.tmdb) return
    let active = true
    queueMicrotask(() => {
      setAssets(undefined)
      setPlayingTrailer(false)
    })
    GetApiHandler<TmdbMediaAssets>(
      `/moviedb/assets/${item.type}/${item.ids.tmdb}`,
    )
      .then((response) => {
        if (active) setAssets(response)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [item.ids.tmdb, item.type])

  return (
    <Modal size="5xl" onCancel={onClose} hideCancelButton>
      <div className="relative h-56 w-full overflow-hidden rounded-xl bg-zinc-800 sm:h-72 lg:h-80">
        {playingTrailer && trailerVideoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerVideoId)}?autoplay=1&rel=0`}
            title={`${item.title} trailer`}
            className="h-full w-full border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : assets?.backdropPath ? (
          <div
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${getTmdbImageUrl({
                scope: 'discover',
                variant: 'backdrop',
                type: item.type,
                tmdbId: item.ids.tmdb,
                imagePath: assets.backdropPath,
              })})`,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <FilmIcon className="h-16 w-16" />
          </div>
        )}
        {playingTrailer && trailerVideoId ? (
          <div className="absolute right-2 top-2 z-20 flex gap-1.5">
            <a
              href={assets?.trailerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-black/80 text-white shadow transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Open trailer on YouTube"
              title="Open on YouTube"
            >
              <ExternalLinkIcon className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={() => setPlayingTrailer(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-black/80 text-white shadow transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Close trailer"
              title="Close trailer"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        {!playingTrailer ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
            <div className="absolute inset-0 flex justify-between gap-4 p-3 sm:p-4">
              <div className="flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="w-fit rounded-lg bg-black/75 p-2 text-xs font-medium uppercase text-zinc-200 shadow-lg">
                    {item.type === 'movie' ? 'Movie' : 'TV Show'}
                  </div>
                  {item.certification ? (
                    <div className="w-fit rounded-lg bg-black/75 p-2 text-xs font-medium uppercase text-zinc-200 shadow-lg">
                      Rated: {item.certification}
                    </div>
                  ) : null}
                  {item.watchlisted ? (
                    <div className="flex w-fit items-center gap-1 rounded-lg bg-maintainerr-600/95 p-2 text-xs font-semibold uppercase text-white shadow-lg">
                      <CheckIcon className="h-4 w-4" />
                      Watchlist
                    </div>
                  ) : null}
                  {item.watched ? (
                    <div className="flex w-fit items-center gap-1 rounded-lg bg-emerald-700/95 p-2 text-xs font-semibold uppercase text-white shadow-lg">
                      <EyeIcon className="h-4 w-4" />
                      Watched
                    </div>
                  ) : null}
                </div>
                {item.rating ? (
                  <div className="flex w-fit items-center gap-2 rounded-lg bg-black/75 px-3 py-1.5 text-white shadow-lg">
                    <img
                      src={`${basePath}/icons_logos/trakt.svg`}
                      alt="Trakt"
                      className="h-6 w-6"
                    />
                    <span className="text-sm font-medium">
                      {item.rating.toFixed(1)}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col items-end justify-between">
                <div className="space-y-1">
                  {item.ids.tmdb ? (
                    <a
                      href={`https://themoviedb.org/${item.type === 'movie' ? 'movie' : 'tv'}/${item.ids.tmdb}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      <img
                        src={`${basePath}/icons_logos/tmdb_logo.svg`}
                        alt="TMDB"
                        className="h-8 w-32 rounded-lg bg-black/75 p-2 shadow-lg"
                      />
                    </a>
                  ) : null}
                  {assets?.trailerUrl && trailerVideoId ? (
                    <button
                      type="button"
                      onClick={() => setPlayingTrailer(true)}
                      className="flex h-8 w-32 items-center justify-center gap-2 rounded-lg bg-red-600/90 px-3 text-xs font-semibold text-white shadow-lg transition hover:bg-red-500"
                      aria-label={`Play ${item.title} trailer`}
                    >
                      <PlayIcon className="h-4 w-4 fill-current" />
                      YouTube
                    </button>
                  ) : null}
                </div>
                <div className="flex max-w-full flex-wrap-reverse justify-end gap-1">
                  {item.genres?.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-lg bg-black/75 p-2 text-xs font-medium capitalize text-white shadow-lg"
                    >
                      {genre.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="py-4">
        <h2 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
          {item.title}
          {item.year ? ` (${item.year})` : ''}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300 sm:text-base">
          {item.overview || 'No overview is available.'}
        </p>
      </div>

      {assets?.cast?.length ? (
        <section className="border-b border-zinc-800 py-4">
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 lg:grid-cols-10 lg:gap-x-4">
            {assets.cast.map((person, index) => (
              <div
                key={person.id}
                className={`min-w-0 text-center ${index >= 6 ? 'hidden lg:block' : ''}`}
                data-tooltip-id={`discover-cast-${item.ids.tmdb}-${person.id}`}
                aria-label={
                  person.character
                    ? `${person.name} as ${person.character}`
                    : person.name
                }
              >
                {person.profilePath ? (
                  <img
                    src={getActorProfileImageUrl(person.id, person.profilePath)}
                    alt={person.name}
                    loading="lazy"
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 rounded-full object-cover shadow-md ring-2 ring-zinc-600"
                  />
                ) : (
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-lg font-semibold text-zinc-400 ring-2 ring-zinc-600">
                    {person.name.charAt(0)}
                  </span>
                )}
                <ActorTooltip
                  id={`discover-cast-${item.ids.tmdb}-${person.id}`}
                  name={person.name}
                  character={person.character}
                  personId={person.id}
                  profilePath={person.profilePath}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {item.runtime || item.watchers || item.votes ? (
        <div className="grid grid-cols-1 border-b border-zinc-800 sm:grid-cols-3">
          {item.runtime ? (
            <DiscoverFact
              icon={<ClockIcon className="h-4 w-4" />}
              label="Runtime"
              value={`${Math.floor(item.runtime / 60) ? `${Math.floor(item.runtime / 60)}h ` : ''}${item.runtime % 60}m`}
            />
          ) : null}
          {item.watchers ? (
            <DiscoverFact
              icon={<EyeIcon className="h-4 w-4" />}
              label="Watching"
              value={item.watchers.toLocaleString()}
            />
          ) : null}
          {item.votes ? (
            <DiscoverFact
              icon={<ChartBarIcon className="h-4 w-4" />}
              label="Trakt votes"
              value={item.votes.toLocaleString()}
            />
          ) : null}
        </div>
      ) : null}

      {item.servarr.length ? (
        <section className="border-b border-zinc-800 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {item.servarr.map((status) => {
              const content = (
                <>
                  <img
                    src={`${basePath}/icons_logos/${status.service}.svg`}
                    alt={status.service === 'radarr' ? 'Radarr' : 'Sonarr'}
                    className="h-8 w-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-500">
                      {status.instanceName}
                    </p>
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {status.status}
                    </p>
                    {status.detail ? (
                      <p className="truncate text-xs text-zinc-400">
                        {status.detail}
                      </p>
                    ) : null}
                  </div>
                </>
              )
              const className =
                'flex items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3 ring-1 ring-zinc-600'

              return status.href ? (
                <a
                  key={`${status.service}-${status.instanceName}`}
                  href={status.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${className} transition hover:bg-zinc-700 hover:ring-zinc-500 focus:outline-none focus:ring-2 focus:ring-maintainerr-400`}
                  aria-label={`Open ${status.instanceName}`}
                >
                  {content}
                </a>
              ) : (
                <div
                  key={`${status.service}-${status.instanceName}`}
                  className={className}
                >
                  {content}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!connected ? (
          <p className="text-xs text-zinc-500">
            Connect Trakt in Settings to manage your watchlist and history.
          </p>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 xs:flex-row">
          <Button
            buttonType={item.watched ? 'default' : 'success'}
            disabled={!connected || updating || markingWatched || item.watched}
            onClick={onMarkWatched}
          >
            <EyeIcon className="mr-2 h-4 w-4" />
            {markingWatched
              ? 'Marking Watched...'
              : item.watched
                ? 'Watched'
                : item.type === 'show'
                  ? 'Mark Show Watched'
                  : 'Mark as Watched'}
          </Button>
          <Button
            buttonType={item.watchlisted ? 'danger' : 'primary'}
            disabled={!connected || updating || markingWatched}
            onClick={onWatchlist}
          >
            <BookmarkIcon className="mr-2 h-4 w-4" />
            {updating
              ? 'Updating...'
              : item.watchlisted
                ? 'Remove from Watchlist'
                : 'Add to Watchlist'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const DiscoverFact = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) => (
  <div className="min-w-0 border-b border-zinc-800 px-2 py-4 last:border-b-0 sm:border-b-0 sm:px-3">
    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
      {icon}
      <span>{label}</span>
    </div>
    <p className="mt-1 truncate text-sm font-semibold text-zinc-200">{value}</p>
  </div>
)

const ServarrBadge = ({
  status,
}: {
  status: TraktDiscoverItem['servarr'][number]
}) => {
  const basePath = import.meta.env.VITE_BASE_PATH ?? ''
  const label =
    status.state === 'partial'
      ? 'Partial'
      : status.state === 'awaiting'
        ? 'Waiting'
        : status.state.charAt(0).toUpperCase() + status.state.slice(1)

  return (
    <span
      className="flex max-w-28 items-center gap-1 rounded bg-zinc-950/90 px-1.5 py-1 text-[9px] font-semibold text-zinc-100 shadow"
      title={`${status.instanceName}: ${status.status}${status.detail ? ` (${status.detail})` : ''}`}
    >
      <img
        src={`${basePath}/icons_logos/${status.service}.svg`}
        alt=""
        className="h-3.5 w-3.5 shrink-0"
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

export default Discover
