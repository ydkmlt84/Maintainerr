import {
  AdjustmentsVerticalIcon,
  CalendarIcon,
  ClockIcon,
  CircleStackIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  FilmIcon,
  PlayIcon,
  ShieldExclamationIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { MediaItem, ServarrMediaLink } from '@maintainerr/contracts'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMediaServerType } from '../../../../hooks/useMediaServerType'
import GetApiHandler from '../../../../utils/ApiHandler'
import { getTmdbImageUrl } from '../../../../utils/TmdbImage'
import ActorTooltip, { getActorProfileImageUrl } from '../../ActorTooltip'
import BackdropLinkTooltip from '../../BackdropLinkTooltip'

interface ModalContentProps {
  onClose: () => void
  onManage?: () => void
  footerContent?: React.ReactNode
  backgroundClickable?: boolean
  showMediaFacts?: boolean
  showCollectionMemberships?: boolean
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
    ruleGroupActive: boolean | null
    isDirect: boolean
    addedAt: string
    isManual: boolean
    deleteAfterDays: number | null
    scheduledFor: string | null
    arrAction: number
    ruleGroupName: string | null
  }[]
  exclusions: {
    id: number
    scope: 'global' | 'collection'
    collectionId: number | null
    collectionTitle: string | null
    ruleGroupName: string | null
    expiresAt: string | null
  }[]
}

interface TmdbMediaAssets {
  backdropPath?: string
  trailerUrl?: string
  cast: TmdbCastMember[]
}

interface TmdbCastMember {
  id: number
  name: string
  character?: string
  profilePath?: string
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

const getScheduleLabel = (
  scheduledFor: string | null,
  arrAction: number,
): string | null => {
  if (!scheduledFor) return null
  if (arrAction === 4) return null

  const scheduled = new Date(scheduledFor)
  if (Number.isNaN(scheduled.getTime())) return null
  const days = Math.ceil((scheduled.getTime() - Date.now()) / 86400000)
  const action = arrAction === 3 ? 'Unmonitor' : 'Removal'
  if (days < 0) return `${action} overdue since ${formatDate(scheduled)}`
  if (days === 0) return `${action} scheduled today`
  return `${action} in ${days} day${days === 1 ? '' : 's'}`
}

const MediaModalContent: React.FC<ModalContentProps> = memo(
  ({
    onClose,
    onManage,
    footerContent,
    backgroundClickable = true,
    showMediaFacts = true,
    showCollectionMemberships = true,
    mediaType,
    id,
    summary,
    year,
    title,
    tmdbid,
  }) => {
    const { isPlex, isJellyfin } = useMediaServerType()
    const [loading, setLoading] = useState<boolean>(true)
    const [backdrop, setBackdrop] = useState<string | null>(null)
    const [trailerUrl, setTrailerUrl] = useState<string | null>(null)
    const [cast, setCast] = useState<TmdbCastMember[]>([])
    const [resolvedTmdbId, setResolvedTmdbId] = useState<
      string | null | undefined
    >(['season', 'episode'].includes(mediaType) ? undefined : tmdbid)
    const [resolvedSeasonNumber, setResolvedSeasonNumber] = useState<
      number | null | undefined
    >(['season', 'episode'].includes(mediaType) ? undefined : null)
    const [playingTrailerFor, setPlayingTrailerFor] = useState<string | null>(
      null,
    )
    const [machineId, setMachineId] = useState<string | null>(null)
    const [serverUrl, setServerUrl] = useState<string | null>(null)
    const [tautulliModalUrl, setTautulliModalUrl] = useState<string | null>(
      null,
    )
    const [metadata, setMetadata] = useState<MediaItem | null>(null)
    const [parentMetadata, setParentMetadata] = useState<MediaItem | null>(null)
    const [grandparentMetadata, setGrandparentMetadata] =
      useState<MediaItem | null>(null)
    const [maintainerrContext, setMaintainerrContext] =
      useState<MediaMaintainerrContext | null>(null)
    const [contextLoading, setContextLoading] = useState(true)
    const [servarrLinks, setServarrLinks] = useState<ServarrMediaLink[]>([])

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
        .then(async (item) => {
          setMetadata(item)
          setResolvedSeasonNumber(
            mediaType === 'season'
              ? (item?.index ?? null)
              : mediaType === 'episode'
                ? (item?.parentIndex ?? null)
                : null,
          )

          const [parent, grandparent] = await Promise.all([
            item?.parentId
              ? GetApiHandler<MediaItem>(
                  `/media-server/meta/${item.parentId}`,
                ).catch(() => null)
              : Promise.resolve(null),
            item?.grandparentId
              ? GetApiHandler<MediaItem>(
                  `/media-server/meta/${item.grandparentId}`,
                ).catch(() => null)
              : Promise.resolve(null),
          ])
          setParentMetadata(parent)
          setGrandparentMetadata(grandparent)

          const show = mediaType === 'episode' ? grandparent : parent
          const assetTmdbId = ['season', 'episode'].includes(mediaType)
            ? (show?.providerIds?.tmdb?.[0] ?? tmdbid)
            : (tmdbid ?? item?.providerIds?.tmdb?.[0])

          setResolvedTmdbId(assetTmdbId ?? null)
        })
        .catch(() => {
          setMetadata(null)
          setParentMetadata(null)
          setGrandparentMetadata(null)
        })
        .finally(() => setLoading(false))
      GetApiHandler<MediaMaintainerrContext>(
        `/collections/media-context/${id}?includeRelated=true`,
      )
        .then(setMaintainerrContext)
        .catch(() => setMaintainerrContext(null))
        .finally(() => setContextLoading(false))
    }, [id, mediaType, tmdbid])

    useEffect(() => {
      queueMicrotask(() => {
        setBackdrop(null)
        setTrailerUrl(null)
        setCast([])
      })
    }, [id, mediaType])

    useEffect(() => {
      let active = true

      // Fetch the backdrop and trailer from one cached TMDB detail response.
      const childAssetsReady =
        !['season', 'episode'].includes(mediaType) ||
        resolvedSeasonNumber !== undefined
      if (resolvedTmdbId && childAssetsReady) {
        const backdropType = ['season', 'episode'].includes(mediaType)
          ? 'show'
          : mediaType
        const seasonQuery =
          resolvedSeasonNumber !== null && resolvedSeasonNumber !== undefined
            ? `?seasonNumber=${resolvedSeasonNumber}`
            : ''
        GetApiHandler<TmdbMediaAssets>(
          `/moviedb/assets/${backdropType}/${resolvedTmdbId}${seasonQuery}`,
        )
          .then((resp) => {
            if (!active) return
            setBackdrop(resp?.backdropPath ?? null)
            setTrailerUrl(resp?.trailerUrl ?? null)
            setCast(resp?.cast ?? [])
          })
          .catch((error) => {
            if (!active) return
            console.error(
              'Error fetching media artwork. Check your media server metadata',
              error,
            )
            setBackdrop(null)
            setTrailerUrl(null)
            setCast([])
          })
      }

      return () => {
        active = false
      }
    }, [mediaType, resolvedSeasonNumber, resolvedTmdbId])

    useEffect(() => {
      let active = true
      const showMetadata =
        mediaType === 'show'
          ? metadata
          : mediaType === 'season'
            ? parentMetadata
            : mediaType === 'episode'
              ? grandparentMetadata
              : null
      const type = mediaType === 'movie' ? 'movie' : 'show'
      const tmdbId =
        type === 'movie'
          ? (metadata?.providerIds.tmdb?.[0] ?? resolvedTmdbId)
          : undefined
      const tvdbId =
        type === 'show' ? showMetadata?.providerIds.tvdb?.[0] : undefined

      queueMicrotask(() => {
        if (active) setServarrLinks([])
      })
      if (!tmdbId && !tvdbId) {
        return () => {
          active = false
        }
      }

      const query = new URLSearchParams({ type })
      if (tmdbId) query.set('tmdbId', tmdbId)
      if (tvdbId) query.set('tvdbId', tvdbId)
      GetApiHandler<ServarrMediaLink[]>(`/servarr/links?${query.toString()}`)
        .then((links) => {
          if (active) setServarrLinks(links)
        })
        .catch(() => {
          if (active) setServarrLinks([])
        })

      return () => {
        active = false
      }
    }, [
      grandparentMetadata,
      mediaType,
      metadata,
      parentMetadata,
      resolvedTmdbId,
    ])

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
    const trailerIdentity = `${mediaType}:${id}:${resolvedTmdbId ?? ''}`
    const trailerPlaying = playingTrailerFor === trailerIdentity
    const imdbId = metadata?.providerIds.imdb?.[0]
    const episodeTvdbId =
      mediaType === 'episode' ? metadata?.providerIds.tvdb?.[0] : undefined
    const tvdbId =
      mediaType === 'show'
        ? metadata?.providerIds.tvdb?.[0]
        : mediaType === 'season'
          ? parentMetadata?.providerIds.tvdb?.[0]
          : mediaType === 'episode'
            ? (episodeTvdbId ?? grandparentMetadata?.providerIds.tvdb?.[0])
            : undefined
    const tvdbEntityType = episodeTvdbId ? 'episode' : 'series'
    const episodeCode =
      mediaType === 'episode' && metadata?.index != null
        ? `${
            metadata.parentIndex != null
              ? `S${String(metadata.parentIndex).padStart(2, '0')}-`
              : ''
          }E${String(metadata.index).padStart(2, '0')}`
        : undefined
    const modalHeading =
      mediaType === 'episode'
        ? [
            grandparentMetadata?.title ?? metadata?.grandparentTitle ?? title,
            episodeCode,
            metadata?.title ? `(${metadata.title})` : undefined,
          ]
            .filter(Boolean)
            .join(' ')
        : `${title}${year ? ` (${year})` : ''}`
    const playCount = metadata?.viewCount ?? metadata?.watchedChildCount
    const hasMaintainerrData = Boolean(
      maintainerrContext &&
      ((showCollectionMemberships && maintainerrContext.memberships.length) ||
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
        icon: CircleStackIcon,
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
        onClick={backgroundClickable ? onClose : undefined}
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
                    data-tooltip-id={`media-youtube-${id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-black/80 text-white shadow transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
                    aria-label="Open trailer on YouTube"
                    title="Open on YouTube"
                  >
                    <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  </a>
                  <BackdropLinkTooltip
                    id={`media-youtube-${id}`}
                    label="YouTube"
                    value={trailerVideoId}
                  />
                  <button
                    type="button"
                    onClick={() => setPlayingTrailerFor(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-black/80 text-white shadow transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-white/60"
                    aria-label="Close trailer"
                    title="Close trailer"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : backdrop ? (
              <div
                className="h-full w-full rounded-xl bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: resolvedTmdbId
                    ? `url(${getTmdbImageUrl({
                        scope: 'library',
                        variant: 'backdrop',
                        type: mediaType === 'movie' ? 'movie' : 'show',
                        tmdbId: resolvedTmdbId,
                        imagePath: backdrop,
                      })})`
                    : undefined,
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-800/70 text-zinc-600">
                <FilmIcon className="h-16 w-16" aria-hidden="true" />
              </div>
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
                    {servarrLinks.map((link) => {
                      const tooltipId = `media-servarr-${id}-${link.service}-${link.itemId}`
                      return (
                        <React.Fragment key={tooltipId}>
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            data-tooltip-id={tooltipId}
                            aria-label={`Open in ${link.instanceName}`}
                            className="mt-1 flex h-8 items-center gap-2 rounded-lg bg-black bg-opacity-70 px-2 text-xs font-semibold capitalize text-zinc-100 shadow-lg transition hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-white/60"
                          >
                            <img
                              src={`${basePath}/icons_logos/${link.service}.svg`}
                              alt=""
                              className="h-5 w-5"
                            />
                            {link.service}
                          </a>
                          <BackdropLinkTooltip
                            id={tooltipId}
                            label={
                              link.service === 'radarr' ? 'Radarr' : 'Sonarr'
                            }
                            value={link.itemId}
                          />
                        </React.Fragment>
                      )
                    })}
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
                    {mediaType === 'movie' && resolvedTmdbId && (
                      <div>
                        <a
                          href={`https://themoviedb.org/${mediaTypeOf}/${resolvedTmdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-tmdb-${id}`}
                        >
                          <img
                            src={`${basePath}/icons_logos/tmdb_logo.svg`}
                            alt="TMDB Logo"
                            width={128}
                            height={32}
                            className="h-8 w-32 rounded-lg bg-black bg-opacity-70 p-2 shadow-lg"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-tmdb-${id}`}
                          label="TMDB"
                          value={resolvedTmdbId}
                        />
                      </div>
                    )}
                    {isPlex && machineId && (
                      <div>
                        <a
                          href={`https://app.plex.tv/desktop#!/server/${machineId}/details?key=%2Flibrary%2Fmetadata%2F${id}`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-plex-${id}`}
                        >
                          <img
                            src={`${basePath}/icons_logos/plex_logo.svg`}
                            alt="Plex Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1 shadow-lg"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-plex-${id}`}
                          label="Plex"
                          value={id}
                        />
                      </div>
                    )}
                    {isJellyfin && serverUrl && (
                      <div>
                        <a
                          href={`${serverUrl}/web/#/details?id=${id}`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-jellyfin-${id}`}
                        >
                          <img
                            src={`${basePath}/icons_logos/jellyfin.svg`}
                            alt="Jellyfin Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1 shadow-lg"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-jellyfin-${id}`}
                          label="Jellyfin"
                          value={id}
                        />
                      </div>
                    )}
                    {isPlex && tautulliModalUrl && (
                      <div>
                        <a
                          href={`${tautulliModalUrl}/info?rating_key=${id}&source=history`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-tautulli-${id}`}
                        >
                          <img
                            src={`${basePath}/icons_logos/tautulli_logo.svg`}
                            alt="Tautulli Logo"
                            width={128}
                            height={32}
                            className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1.5 shadow-lg"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-tautulli-${id}`}
                          label="Tautulli"
                          value={id}
                        />
                      </div>
                    )}
                    {imdbId ? (
                      <div>
                        <a
                          href={`https://www.imdb.com/title/${imdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-imdb-${id}`}
                          className="mt-1 flex h-8 w-32 items-center justify-center rounded-lg bg-black bg-opacity-70 p-1.5 shadow-lg transition hover:bg-opacity-90"
                          aria-label="Open on IMDb"
                        >
                          <img
                            src={`${basePath}/icons_logos/imdb_icon.svg`}
                            alt="IMDb"
                            className="h-6 w-auto"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-imdb-${id}`}
                          label="IMDb"
                          value={imdbId}
                        />
                      </div>
                    ) : null}
                    {tvdbId ? (
                      <div>
                        <a
                          href={`https://thetvdb.com/dereferrer/${tvdbEntityType}/${tvdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          data-tooltip-id={`media-tvdb-${id}`}
                          className="mt-1 flex h-8 w-32 items-center justify-center rounded-lg bg-black bg-opacity-70 px-3 shadow-lg transition hover:bg-opacity-90"
                        >
                          <img
                            src={`${basePath}/icons_logos/tvdb_logo.svg`}
                            alt="TheTVDB"
                            className="h-7 w-auto"
                          />
                        </a>
                        <BackdropLinkTooltip
                          id={`media-tvdb-${id}`}
                          label="TVDB"
                          value={tvdbId}
                        />
                      </div>
                    ) : null}
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
            <div
              className={`${cast.length ? '' : 'border-b border-zinc-800'} py-4`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
                  {modalHeading}
                </h2>
                {mediaType === 'episode' && metadata?.originallyAvailableAt ? (
                  <span className="shrink-0 whitespace-nowrap text-sm text-zinc-400">
                    Aired {formatDate(metadata.originallyAvailableAt)}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-300 sm:text-base">
                {summary || metadata?.summary || 'No summary available.'}
              </p>
            </div>

            {cast.length > 0 && (
              <section className="border-b border-zinc-800 py-4">
                <div className="grid grid-cols-3 gap-x-3 gap-y-4 lg:grid-cols-10 lg:gap-x-4">
                  {cast.map((person, index) => (
                    <div
                      key={person.id}
                      className={`min-w-0 text-center ${
                        index >= 6 ? 'hidden lg:block' : ''
                      }`}
                      data-tooltip-id={`media-cast-${id}-${person.id}`}
                      aria-label={
                        person.character
                          ? `${person.name} as ${person.character}`
                          : person.name
                      }
                    >
                      {person.profilePath ? (
                        <img
                          src={getActorProfileImageUrl(
                            person.id,
                            person.profilePath,
                          )}
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
                        id={`media-cast-${id}-${person.id}`}
                        name={person.name}
                        character={person.character}
                        personId={person.id}
                        profilePath={person.profilePath}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showMediaFacts ? (
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
            ) : null}

            {(contextLoading || hasMaintainerrData) && (
              <section className="border-b border-zinc-800 py-5">
                {contextLoading ? (
                  <div className="h-16 animate-pulse rounded bg-zinc-900" />
                ) : (
                  <div>
                    <div className="space-y-5">
                      {showCollectionMemberships &&
                      maintainerrContext?.memberships.length ? (
                        <div>
                          <h4 className="text-xs font-medium uppercase text-zinc-500">
                            Collections
                          </h4>
                          <div className="mt-2 divide-y divide-zinc-800 border-y border-zinc-800">
                            {maintainerrContext.memberships.map(
                              (membership) => {
                                const isActive =
                                  membership.collectionActive &&
                                  membership.ruleGroupActive !== false
                                const scheduleLabel = isActive
                                  ? getScheduleLabel(
                                      membership.scheduledFor,
                                      membership.arrAction,
                                    )
                                  : null
                                return (
                                  <div
                                    key={membership.collectionId}
                                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <Link
                                        to={`/collections/${membership.collectionId}`}
                                        className="block truncate text-sm font-medium text-maintainerr-400 transition hover:text-maintainerr-300"
                                        onClick={onClose}
                                      >
                                        {membership.collectionTitle}
                                      </Link>
                                      <div className="mt-0.5 text-xs text-zinc-500">
                                        Added {formatDate(membership.addedAt)}
                                        {membership.ruleGroupName
                                          ? ` by ${membership.ruleGroupName}`
                                          : ''}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 text-xs">
                                      <span className="text-zinc-400">
                                        {membership.isManual
                                          ? membership.isDirect
                                            ? 'Added manually'
                                            : 'Related media added manually'
                                          : membership.isDirect
                                            ? 'Added by rule'
                                            : 'Related media added by rule'}
                                      </span>
                                      {!isActive ? (
                                        <span className="rounded bg-zinc-800 px-2 py-1 font-semibold text-zinc-400">
                                          Inactive
                                        </span>
                                      ) : scheduleLabel ? (
                                        <span className="text-amber-400">
                                          {scheduleLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                )
                              },
                            )}
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
                                {exclusion.expiresAt
                                  ? ` until ${formatDate(exclusion.expiresAt)}`
                                  : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            )}

            {onManage ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onManage}
                  className="ml-auto flex items-center rounded bg-maintainerr-600 px-4 py-2 font-medium text-white shadow-lg shadow-maintainerr-950/30 hover:bg-maintainerr focus:outline-none"
                >
                  <AdjustmentsVerticalIcon className="mr-2 h-4 w-4" />
                  Manage
                </button>
              </div>
            ) : null}
            {footerContent ? (
              <div className="mt-5 border-t border-zinc-800 pt-5">
                {footerContent}
              </div>
            ) : null}
          </div>
        </div>
      </div>,
      document.body,
    )
  },
)

MediaModalContent.displayName = 'MediaModalContent'

export default MediaModalContent
