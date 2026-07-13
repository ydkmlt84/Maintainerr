import {
  CalendarIcon,
  ClockIcon,
  DatabaseIcon,
  EyeIcon,
  ExternalLinkIcon,
  FilmIcon,
  InformationCircleIcon,
  PlayIcon,
  ShieldExclamationIcon,
  XIcon,
} from '@heroicons/react/outline'
import { MediaItem } from '@maintainerr/contracts'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaServerType } from '../../../../hooks/useMediaServerType'
import GetApiHandler from '../../../../utils/ApiHandler'

interface ModalContentProps {
  onClose: () => void
  id: number | string
  image?: string
  userScore?: number
  backdrop?: string
  summary?: string
  year?: string
  mediaType: 'movie' | 'show' | 'season' | 'episode'
  title: string
  canExpand?: boolean
  inProgress?: boolean
  tmdbid?: string
  libraryId?: string
  type?: 1 | 2 | 3 | 4
  daysLeft?: number
  exclusionId?: number
  exclusionType?: 'global' | 'specific' | undefined
  collectionId?: number
  isManual?: boolean
}

interface MediaMaintainerrContext {
  memberships: {
    collectionId: number
    collectionTitle: string
    collectionActive: boolean
    addedAt: string
    isManual: boolean
    deleteAfterDays: number | null
    scheduledFor: string | null
    ruleGroupName: string | null
  }[]
  exclusions: {
    id: number
    scope: 'global' | 'collection'
    collectionId: number | null
    collectionTitle: string | null
    ruleGroupName: string | null
  }[]
}

interface TmdbMediaAssets {
  backdropPath?: string
  trailerUrl?: string
}

const basePath = import.meta.env.VITE_BASE_PATH ?? ''
const ratingIcons: Record<string, string> = {
  audience: `${basePath}/icons_logos/tmdb_icon.svg`,
  critic: `${basePath}/icons_logos/rt_critic.svg`,
}

const formatDate = (value?: string | Date | null): string => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatDuration = (durationMs?: number): string => {
  if (!durationMs) return 'Not available'
  const totalMinutes = Math.round(durationMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

const formatBytes = (value?: number): string => {
  if (!value) return 'Not available'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  )
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`
}

const getScheduleLabel = (scheduledFor: string | null): string | null => {
  if (!scheduledFor) return null
  const scheduled = new Date(scheduledFor)
  if (Number.isNaN(scheduled.getTime())) return null
  const days = Math.ceil((scheduled.getTime() - Date.now()) / 86400000)
  if (days < 0) return `Eligible since ${formatDate(scheduled)}`
  if (days === 0) return 'Eligible today'
  return `Eligible in ${days} day${days === 1 ? '' : 's'}`
}

const MediaModalContent: React.FC<ModalContentProps> = memo(
  ({ onClose, mediaType, id, summary, year, title, tmdbid }) => {
    const { isPlex, isJellyfin } = useMediaServerType()
    const [loading, setLoading] = useState<boolean>(true)
    const [backdrop, setBackdrop] = useState<string | null>(null)
    const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
    const [playingTrailerFor, setPlayingTrailerFor] = useState<string | null>(
      null,
    )
    const [machineId, setMachineId] = useState<string | null>(null)
    const [serverUrl, setServerUrl] = useState<string | null>(null)
    const [tautulliModalUrl, setTautulliModalUrl] = useState<string | null>(
      null,
    )
    const [metadata, setMetadata] = useState<MediaItem | null>(null)
    const [maintainerrContext, setMaintainerrContext] =
      useState<MediaMaintainerrContext | null>(null)
    const [contextLoading, setContextLoading] = useState(true)

    const mediaTypeOf = useMemo(
      () =>
        ['show', 'season', 'episode'].includes(mediaType) ? 'tv' : mediaType,
      [mediaType],
    )

    const basePath = import.meta.env.VITE_BASE_PATH ?? ''

    useEffect(() => {
      GetApiHandler('/media-server').then((resp) => {
        setMachineId(resp?.machineId)
        // For Jellyfin, we need the server URL to construct links
        if (resp?.url) {
          setServerUrl(resp.url)
        }
      })
      GetApiHandler('/settings').then((resp) =>
        setTautulliModalUrl(resp?.tautulli_url || null),
      )
      GetApiHandler<MediaItem>(`/media-server/meta/${id}`)
        .then(setMetadata)
        .catch(() => setMetadata(null))
        .finally(() => setLoading(false))
      GetApiHandler<MediaMaintainerrContext>(`/collections/media-context/${id}`)
        .then(setMaintainerrContext)
        .catch(() => setMaintainerrContext(null))
        .finally(() => setContextLoading(false))
      // Fetch the backdrop and trailer from one cached TMDB detail response.
      if (tmdbid) {
        const backdropType = ['season', 'episode'].includes(mediaType)
          ? 'show'
          : mediaType
        GetApiHandler<TmdbMediaAssets>(
          `/moviedb/assets/${backdropType}/${tmdbid}`,
        )
          .then((resp) => {
            setBackdrop(resp?.backdropPath ?? null)
            setTrailerUrl(resp?.trailerUrl ?? null)
          })
          .catch((error) => {
            console.error(
              'Error fetching media artwork. Check your media server metadata',
              error,
            )
            setBackdrop(null)
            setTrailerUrl(null)
          })
      } else {
        console.warn(
          `No TMDB ID found for "${title}" (id: ${id}). Backdrop image unavailable. ` +
            'Please check your media server metadata - the item may not be matched correctly.',
        )
      }
    }, [id, mediaType, tmdbid, title])

    const totalFileSize = useMemo(
      () =>
        metadata?.mediaSources.reduce(
          (total, source) => total + (source.sizeBytes ?? 0),
          0,
        ),
      [metadata],
    )

    const primarySource = metadata?.mediaSources[0]
    const trailerVideoId = useMemo(() => {
      if (!trailerUrl) return null
      try {
        return new URL(trailerUrl).searchParams.get('v')
      } catch {
        return null
      }
    }, [trailerUrl])
    const trailerIdentity = `${mediaType}:${id}:${tmdbid ?? ''}`
    const trailerPlaying = playingTrailerFor === trailerIdentity
    const playCount = metadata?.viewCount ?? metadata?.watchedChildCount
    const hasMaintainerrData = Boolean(
      maintainerrContext &&
      (maintainerrContext.memberships.length ||
        maintainerrContext.exclusions.length),
    )
    const mediaFacts = [
      {
        label: 'Library',
        value: metadata?.library.title || 'Not available',
        icon: FilmIcon,
      },
      {
        label: mediaType === 'movie' ? 'Runtime' : 'Episodes',
        value:
          mediaType === 'movie'
            ? formatDuration(metadata?.durationMs ?? primarySource?.duration)
            : metadata?.childCount?.toLocaleString() || 'Not available',
        icon: ClockIcon,
      },
      {
        label: mediaType === 'movie' ? 'Plays' : 'Watched',
        value:
          playCount !== undefined
            ? mediaType === 'movie'
              ? playCount.toLocaleString()
              : `${playCount}${metadata?.childCount ? ` / ${metadata.childCount}` : ''}`
            : 'Not available',
        icon: EyeIcon,
      },
      {
        label: 'Last watched',
        value: formatDate(metadata?.lastViewedAt),
        icon: CalendarIcon,
      },
      {
        label: 'Added to server',
        value: formatDate(metadata?.addedAt),
        icon: CalendarIcon,
      },
      {
        label: primarySource?.videoResolution || 'Media size',
        value: formatBytes(totalFileSize),
        icon: DatabaseIcon,
      },
    ]

    useEffect(() => {
      document.body.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = ''
      }
    }, [])
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3"
        onClick={onClose} // Close modal when clicking outside
      >
        <div
          className="relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg border border-zinc-600 bg-zinc-700 shadow-[0_0_32px_rgba(212,212,216,0.16),0_24px_48px_rgba(0,0,0,0.45)] ring-1 ring-zinc-300/20"
          onClick={(e) => e.stopPropagation()} // Prevent modal close on content click
        >
          {/* Top Half with Background Image */}
          <div className="relative h-56 w-full overflow-hidden p-2 sm:h-72 lg:h-80">
            {trailerPlaying && trailerVideoId ? (
              <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerVideoId)}?autoplay=1&rel=0`}
                  title={`${title} trailer`}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div className="absolute right-2 top-2 z-20 flex gap-1.5">
                  <a
                    href={trailerUrl ?? undefined}
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
                    onClick={() => setPlayingTrailerFor(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-black/80 text-white shadow transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
                    aria-label="Close trailer"
                    title="Close trailer"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="h-full w-full rounded-xl bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: backdrop
                    ? `url(https://image.tmdb.org/t/p/w1280${backdrop})`
                    : 'linear-gradient(to bottom, #1e293b, #1e293b)',
                }}
              />
            )}
            {loading && !trailerPlaying && (
              <div className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-4 border-maintainerr-600 border-t-maintainerr-200"></div>
              </div>
            )}

            {!trailerPlaying && (
              <div className="absolute left-0 top-0 z-10 flex h-full w-full gap-x-4 p-4">
                <div className="flex grow flex-col">
                  <div className="max-w-fit grow">
                    <div
                      className={`pointer-events-none flex justify-center rounded-lg bg-opacity-70 p-2 text-xs font-medium uppercase text-zinc-200 ${
                        mediaType === 'movie'
                          ? 'bg-black'
                          : mediaType === 'show'
                            ? 'bg-zinc-800'
                            : mediaType === 'season'
                              ? 'bg-zinc-800'
                              : 'bg-zinc-800'
                      }`}
                    >
                      {mediaType}
                    </div>
                    {metadata?.contentRating && (
                      <div className="pointer-events-none mt-1 rounded-lg bg-black bg-opacity-70 p-2 text-xs font-medium uppercase text-zinc-200">
                        {`Rated: ${metadata.contentRating}`}
                      </div>
                    )}
                  </div>
                  {metadata?.ratings && metadata.ratings.length > 0 ? (
                    <div className="flex flex-wrap-reverse gap-1">
                      {metadata.ratings.map((rating, index) => {
                        const icon = rating.type
                          ? ratingIcons[rating.type]
                          : undefined
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-center space-x-1.5 rounded-lg bg-black bg-opacity-70 px-3 py-1 text-white shadow-lg"
                          >
                            {icon && (
                              <img
                                src={icon}
                                alt={`${rating.type} rating`}
                                width={24}
                                height={24}
                                className="h-6 w-6"
                              />
                            )}
                            <span className="cursor-default text-sm font-medium">
                              {rating.value.toFixed(1)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    ''
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <div className="max-w-fit grow">
                    {tmdbid && (
                      <div>
                        <a
                          href={`https://themoviedb.org/${mediaTypeOf}/${tmdbid}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`${basePath}/icons_logos/tmdb_logo.svg`}
                            alt="TMDB Logo"
                            width={128}
                            height={32}
                            className="h-8 w-32 rounded-lg bg-black bg-opacity-70 p-2 shadow-lg"
                          />
                        </a>
                      </div>
                    )}
                    {isPlex && (
                      <div>
                        <a
                          href={`https://app.plex.tv/desktop#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`${basePath}/icons_logos/plex_logo.svg`}
                            alt="Plex Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1 shadow-lg"
                          />
                        </a>
                      </div>
                    )}
                    {isJellyfin && serverUrl && (
                      <div>
                        <a
                          href={`${serverUrl}/web/#/details?id=${id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`${basePath}/icons_logos/jellyfin.svg`}
                            alt="Jellyfin Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1 shadow-lg"
                          />
                        </a>
                      </div>
                    )}
                    {isPlex && tautulliModalUrl && (
                      <div>
                        <a
                          href={`${tautulliModalUrl}/info?rating_key=${id}&source=history`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={`${basePath}/icons_logos/tautulli_logo.svg`}
                            alt="Tautulli Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1.5 shadow-lg"
                          />
                        </a>
                      </div>
                    )}
                    {trailerUrl && trailerVideoId && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setPlayingTrailerFor(trailerIdentity)}
                          className="mt-1 flex h-8 w-32 items-center justify-center gap-2 rounded-lg bg-red-600/90 px-3 text-xs font-semibold text-white shadow-lg transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300/70"
                          aria-label={`Play ${title} trailer`}
                        >
                          <PlayIcon className="h-4 w-4 fill-current" />
                          YouTube
                        </button>
                      </div>
                    )}
                  </div>
                  {metadata?.genres && metadata.genres.length > 0 ? (
                    <div className="pointer-events-none flex flex-wrap-reverse items-end justify-end gap-1">
                      {metadata.genres.map((genre, index) => (
                        <span
                          key={index}
                          className="flex items-center rounded-lg bg-black bg-opacity-70 p-2 text-xs font-medium text-white shadow-lg"
                        >
                          {genre.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    ''
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="border-b border-zinc-800 py-4">
              <h2 className="text-xl font-semibold text-gray-100 sm:text-2xl">
                {title}
                {year ? ` (${year})` : ''}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-300 sm:text-base">
                {summary || metadata?.summary || 'No summary available.'}
              </p>
            </div>

            <div className="grid grid-cols-2 border-b border-zinc-800 sm:grid-cols-3 lg:grid-cols-6">
              {mediaFacts.map((fact) => {
                const Icon = fact.icon
                return (
                  <div
                    key={fact.label}
                    className="min-w-0 border-b border-zinc-800 px-2 py-4 last:border-b-0 sm:px-3 lg:border-b-0"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{fact.label}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-medium text-zinc-100">
                      {fact.value}
                    </div>
                  </div>
                )
              })}
            </div>

            <section className="border-b border-zinc-800 py-5">
              {contextLoading ? (
                <div className="h-16 animate-pulse rounded bg-zinc-900" />
              ) : !hasMaintainerrData ? (
                <div className="flex items-start gap-3 text-sm text-zinc-400">
                  <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                  <div>
                    <p className="font-medium text-zinc-200">
                      Not currently managed
                    </p>
                    <p className="mt-0.5">
                      This item has no collection membership or exclusion.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="space-y-5">
                    {maintainerrContext?.memberships.length ? (
                      <div>
                        <h4 className="text-xs font-medium uppercase text-zinc-500">
                          Collections
                        </h4>
                        <div className="mt-2 divide-y divide-zinc-800 border-y border-zinc-800">
                          {maintainerrContext.memberships.map((membership) => {
                            const scheduleLabel = getScheduleLabel(
                              membership.scheduledFor,
                            )
                            return (
                              <div
                                key={membership.collectionId}
                                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-zinc-100">
                                    {membership.collectionTitle}
                                  </div>
                                  <div className="mt-0.5 text-xs text-zinc-500">
                                    Added {formatDate(membership.addedAt)}
                                    {membership.ruleGroupName
                                      ? ` by ${membership.ruleGroupName}`
                                      : ''}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 text-xs">
                                  <span className="text-zinc-400">
                                    {membership.isManual ? 'Manual' : 'Rule'}
                                  </span>
                                  {scheduleLabel ? (
                                    <span className="text-amber-400">
                                      {scheduleLabel}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500">
                                      No timed action
                                    </span>
                                  )}
                                  {!membership.collectionActive && (
                                    <span className="text-zinc-500">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    {maintainerrContext?.exclusions.length ? (
                      <div>
                        <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-zinc-500">
                          <ShieldExclamationIcon className="h-4 w-4" />
                          Exclusions
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {maintainerrContext.exclusions.map((exclusion) => (
                            <span
                              key={exclusion.id}
                              className="rounded bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200 ring-1 ring-inset ring-amber-700/50"
                            >
                              {exclusion.scope === 'global'
                                ? 'Global exclusion'
                                : exclusion.collectionTitle ||
                                  exclusion.ruleGroupName ||
                                  'Collection exclusion'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              {metadata?.providerIds &&
                ['movie', 'show'].includes(mediaType) &&
                (metadata.providerIds.tmdb?.length ||
                  metadata.providerIds.imdb?.length ||
                  metadata.providerIds.tvdb?.length) && (
                  <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-400">
                    {metadata.providerIds.tmdb?.map((id) => (
                      <span
                        key={`tmdb-${id}`}
                        className="flex items-center justify-center rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                      >
                        tmdb://{id}
                      </span>
                    ))}
                    {metadata.providerIds.imdb?.map((id) => (
                      <span
                        key={`imdb-${id}`}
                        className="flex items-center justify-center rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                      >
                        imdb://{id}
                      </span>
                    ))}
                    {metadata.providerIds.tvdb?.map((id) => (
                      <span
                        key={`tvdb-${id}`}
                        className="flex items-center justify-center rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
                      >
                        tvdb://{id}
                      </span>
                    ))}
                  </div>
                )}
              <div className="ml-auto flex space-x-3">
                <button
                  onClick={onClose}
                  className="rounded bg-maintainerr-600 px-4 py-2 text-white shadow-lg shadow-maintainerr-950/30 hover:bg-maintainerr focus:outline-none"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  },
)

MediaModalContent.displayName = 'MediaModalContent'

export default MediaModalContent
