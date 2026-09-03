import { type MediaItemType } from '@maintainerr/contracts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { PostApiHandler } from '../../../utils/ApiHandler'
import { ExclusionChoices } from '../ExclusionOptionsModal'
import MediaModalContent from '../MediaCard/MediaModal'

interface LeavingSoonModalProps {
  mediaServerId: number | string
  title: string
  summary?: string
  year?: string
  mediaType: 'movie' | 'show' | 'season' | 'episode'
  type: MediaItemType
  tmdbId?: string
  collectionId: number
  collectionTitle: string
  daysLeft: number
  onClose: () => void
  onExcluded: (scope: 'collection' | 'global') => void
}

const LeavingSoonModal = ({
  mediaServerId,
  title,
  summary,
  year,
  mediaType,
  type,
  tmdbId,
  collectionId,
  collectionTitle,
  daysLeft,
  onClose,
  onExcluded,
}: LeavingSoonModalProps) => {
  const [excluding, setExcluding] = useState(false)

  const exclude = async (
    scope: 'collection' | 'global',
    expiresInDays?: number,
  ) => {
    if (excluding) return
    setExcluding(true)

    try {
      await PostApiHandler('/collections/media/add', {
        mediaId: mediaServerId,
        context: { id: mediaServerId, type },
        ...(scope === 'collection' ? { collectionId } : {}),
        action: 1,
      })
      await PostApiHandler('/rules/exclusion', {
        ...(scope === 'collection' ? { collectionId } : {}),
        mediaId: mediaServerId,
        context: { id: mediaServerId, type },
        action: 0,
        ...(expiresInDays ? { expiresInDays } : {}),
      })

      toast.success(`Exclusion added for ${title}.`)
      onExcluded(scope)
      onClose()
    } catch {
      toast.error(`Unable to exclude ${title}.`)
    } finally {
      setExcluding(false)
    }
  }

  return (
    <MediaModalContent
      id={mediaServerId}
      title={title}
      summary={summary}
      year={year}
      mediaType={mediaType}
      tmdbid={tmdbId}
      onClose={onClose}
      backgroundClickable={!excluding}
      showMediaFacts={false}
      showCollectionMemberships={false}
      footerContent={
        <section className="mx-auto max-w-2xl">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Quick actions
              </p>
              <Link
                to={`/collections/${collectionId}`}
                onClick={onClose}
                className="mt-1 inline-block text-sm font-semibold text-maintainerr-400 transition hover:text-maintainerr-300"
              >
                {collectionTitle}
              </Link>
            </div>
            <p className="text-sm text-zinc-400">
              {daysLeft <= 0
                ? 'Scheduled for removal now.'
                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} before removal.`}
            </p>
          </div>
          <ExclusionChoices
            excluding={excluding}
            onExclude={(scope, expiresInDays) =>
              void exclude(scope, expiresInDays)
            }
          />
          {excluding ? (
            <p className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-maintainerr-300">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-maintainerr-300 border-t-transparent" />
              Saving changes…
            </p>
          ) : null}
        </section>
      }
    />
  )
}

export default LeavingSoonModal
