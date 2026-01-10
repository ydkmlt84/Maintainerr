import React, { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GetApiHandler from '../../../../utils/ApiHandler'

interface ModalContentProps {
  onClose: () => void
  id: number
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
  libraryId?: number
  type?: 1 | 2 | 3 | 4
  daysLeft?: number
  exclusionId?: number
  exclusionType?: 'global' | 'specific' | undefined
  exclusionLabels?: string[]
  exclusionTargets?: { id?: number; label: string }[]
  collectionId?: number
  isManual?: boolean
  collections?: {
    id?: number
    title: string
    isManual?: boolean
    daysLeft?: number
  }[]
}

interface Metadata {
  contentRating: string
  audienceRating: string
  Genre: { tag: string }[]
  Rating: { image: string; value: number; type: string }[]
  Guid: { id: string }[]
}

const basePath = import.meta.env.VITE_BASE_PATH ?? ''
const iconMap: Record<string, Record<string, string>> = {
  imdb: {
    audience: `${basePath}/icons_logos/imdb_icon.svg`,
  },
  rottentomatoes: {
    critic: `${basePath}/icons_logos/rt_critic.svg`,
    audience: `${basePath}/icons_logos/rt_audience.svg`,
  },
  themoviedb: {
    audience: `${basePath}/icons_logos/tmdb_icon.svg`,
  },
}

const MediaModalContent: React.FC<ModalContentProps> = memo(
  ({
    onClose,
    mediaType,
    id,
    summary,
    year,
    title,
    tmdbid,
    exclusionType,
    exclusionLabels,
    exclusionTargets,
    collections,
  }) => {
    const [loading, setLoading] = useState<boolean>(true)
    const [backdrop, setBackdrop] = useState<string | null>(null)
    const [machineId, setMachineId] = useState<string | null>(null)
    const [tautulliModalUrl, setTautulliModalUrl] = useState<string | null>(
      null,
    )
    const [metadata, setMetadata] = useState<Metadata | null>(null)
    const manualCollections = useMemo(
      () => collections?.filter((c) => c.isManual) ?? [],
      [collections],
    )
    const allCollections = useMemo(() => collections ?? [], [collections])

    const mediaTypeOf = useMemo(
      () =>
        ['show', 'season', 'episode'].includes(mediaType) ? 'tv' : mediaType,
      [mediaType],
    )

    const basePath = import.meta.env.VITE_BASE_PATH ?? ''

    useEffect(() => {
      GetApiHandler('/plex').then((resp) =>
        setMachineId(resp.machineIdentifier),
      )
      GetApiHandler('/settings').then((resp) =>
        setTautulliModalUrl(resp?.tautulli_url || null),
      )
      GetApiHandler<Metadata>(`/plex/meta/${id}`).then((data) => {
        setMetadata(data)
        setLoading(false)
      })
      const basePath = import.meta.env.VITE_BASE_PATH ?? ''
      setBackdrop(
        `${basePath}/api/moviedb/backdropfile/${mediaType}/${tmdbid}?size=w1280`,
      )
    }, [id, mediaType, tmdbid])

    useEffect(() => {
      document.body.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = ''
      }
    }, [])
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 px-3"
        onClick={onClose} // Close modal when clicking outside
      >
        <div
          className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-zinc-800 shadow-lg"
          onClick={(e) => e.stopPropagation()} // Prevent modal close on content click
        >
          {/* Top Half with Background Image */}
          <div className="relative h-72 w-full overflow-hidden p-2 xl:h-96">
            <div
              className="h-full w-full rounded-xl bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: backdrop
                  ? `url(${backdrop})`
                  : 'linear-gradient(to bottom, #1e293b, #1e293b)',
              }}
            ></div>
            {loading && (
              <div className="absolute bottom-0 left-0 right-0 top-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-4 border-sky-600 border-t-sky-200"></div>
              </div>
            )}

            <div className="absolute left-0 top-0 z-10 flex h-full w-full gap-x-4 p-4">
              <div className="flex grow flex-col">
                <div className="max-w-fit grow">
                  <div
                    className={`pointer-events-none flex justify-center rounded-lg bg-opacity-70 p-2 text-xs font-medium uppercase text-zinc-200 ${
                      mediaType === 'movie'
                        ? 'bg-black'
                        : mediaType === 'show'
                          ? 'bg-amber-900'
                          : mediaType === 'season'
                            ? 'bg-yellow-700'
                            : 'bg-rose-900'
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
                {metadata?.Rating && metadata.Rating.length > 0 ? (
                  <div className="flex flex-wrap-reverse gap-1">
                    {metadata.Rating.map((rating, index) => {
                      const prefix = rating.image.split('://')[0]
                      const type = rating.type
                      const icon = iconMap[prefix]?.[type]
                      let percentageValue = rating.value
                      if (
                        ['themoviedb', 'rottentomatoes'].includes(prefix) &&
                        typeof rating.value === 'number'
                      ) {
                        percentageValue = rating.value * 10
                      } else if (prefix === 'imdb') {
                        percentageValue = rating.value
                      }
                      const displayValue = [
                        'themoviedb',
                        'rottentomatoes',
                      ].includes(prefix)
                        ? `${percentageValue}%`
                        : `${percentageValue}`
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-center space-x-1.5 rounded-lg bg-black bg-opacity-70 px-3 py-1 text-white shadow-lg"
                        >
                          <img
                            src={icon}
                            alt={`${prefix} ${type} Icon`}
                            width={24}
                            height={24}
                            className="h-6 w-6"
                            title={`${prefix}-${type}`}
                          />
                          <span className="cursor-default text-sm font-medium">
                            {displayValue}
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
                  {tautulliModalUrl && (
                    <div>
                      <a
                        href={`${tautulliModalUrl}/info?rating_key=${id}&source=history`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={`${basePath}/icons_logos/tautulli_logo.svg`}
                          alt="Plex Logo"
                          width={128}
                          height={32}
                          className="mt-1 h-8 w-32 rounded-lg bg-black bg-opacity-70 p-1.5 shadow-lg"
                        />
                      </a>
                    </div>
                  )}
                </div>
                {metadata?.Genre && metadata.Genre.length > 0 ? (
                  <div className="pointer-events-none flex flex-wrap-reverse items-end justify-end gap-1">
                    {metadata.Genre.map((genre, index) => (
                      <span
                        key={index}
                        className="flex items-center rounded-lg bg-black bg-opacity-70 p-2 text-xs font-medium text-white shadow-lg"
                      >
                        {genre.tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  ''
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-100">
                  {title} ({year})
                </h2>
              </div>
            </div>

            <div className="mt-2 text-gray-300">
              <p>{summary || 'No summary available.'}</p>
            </div>

            {(exclusionType || manualCollections.length > 0) && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {exclusionType ? (
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-sm font-bold text-red-600">
                      Excluded From
                    </div>
                    <div className="mt-1 text-sm text-zinc-200">
                      {exclusionTargets && exclusionTargets.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {exclusionTargets.map((t, idx) => (
                            <li key={`${t.label}-${idx}`}>
                              {t.id ? (
                                <Link
                                  to={`/collections/${t.id}`}
                                  className="text-amber-200 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t.label}
                                </Link>
                              ) : (
                                t.label
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : exclusionLabels && exclusionLabels.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {exclusionLabels.map((label, idx) => (
                            <li key={`${label}-${idx}`}>{label}</li>
                          ))}
                        </ul>
                      ) : (
                        'This item is excluded.'
                      )}
                    </div>
                  </div>
                ) : null}

                {manualCollections.length > 0 ? (
                  <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
                    <div className="text-sm font-bold text-emerald-300">
                      Manually Added To
                    </div>
                    <div className="mt-1 text-sm text-zinc-200">
                      <ul className="list-disc space-y-1 pl-4">
                        {manualCollections.map((c, idx) => (
                          <li key={`${c.title}-${idx}`}>
                            {c.id ? (
                              <Link
                                to={`/collections/${c.id}`}
                                className="text-amber-200 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.title}
                              </Link>
                            ) : (
                              c.title
                            )}
                            {c.daysLeft !== undefined
                              ? ` ( ${c.daysLeft}d left )`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {allCollections.length > 0 ? (
              <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 p-3">
                <div className="text-sm font-bold text-amber-500">
                  Collections
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allCollections.map((c, idx) =>
                    c.id ? (
                      <Link
                        key={`${c.title}-${c.id}-${idx}`}
                        to={`/collections/${c.id}`}
                        className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-amber-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="hover:underline">{c.title}</span>
                        {c.daysLeft !== undefined ? (
                          <span className="rounded bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-100">
                            {c.daysLeft}d
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      <span
                        key={`${c.title}-${idx}`}
                        className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200"
                      >
                        <span>{c.title}</span>
                        {c.daysLeft !== undefined ? (
                          <span className="rounded bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-100">
                            {c.daysLeft}d
                          </span>
                        ) : null}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            <div className="mr-0.5 mt-6 flex flex-row items-center justify-between gap-4">
              {metadata?.Guid &&
                ['movie', 'show'].includes(mediaType) &&
                metadata.Guid.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-400">
                    {metadata.Guid.map((guid, index) => (
                      <span
                        key={index}
                        className="flex items-center justify-center rounded-lg bg-zinc-700 p-2 text-xs text-white shadow-lg"
                      >
                        {guid.id}
                      </span>
                    ))}
                    (Plex metadata IDs)
                  </div>
                )}
              <div className="ml-auto flex space-x-3">
                <button
                  onClick={onClose}
                  className="rounded bg-amber-600 px-4 py-2 hover:bg-amber-500 focus:outline-none"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

MediaModalContent.displayName = 'MediaModalContent'

export default MediaModalContent
