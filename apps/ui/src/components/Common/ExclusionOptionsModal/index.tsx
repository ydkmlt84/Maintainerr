import { Link } from 'react-router-dom'
import Modal from '../Modal'

interface ExclusionOptionsModalProps {
  title: string
  collectionId: number
  collectionTitle: string
  detail?: string
  excluding: boolean
  onClose: () => void
  onExclude: (scope: 'collection' | 'global', expiresInDays?: number) => void
}

const ExclusionOptionsModal = ({
  title,
  collectionId,
  collectionTitle,
  detail,
  excluding,
  onClose,
  onExclude,
}: ExclusionOptionsModalProps) => (
  <Modal
    title={title}
    size="md"
    onCancel={onClose}
    cancelText="Close"
    backgroundClickable={!excluding}
  >
    <div className="rounded-lg bg-zinc-800 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Collection
      </p>
      <Link
        to={`/collections/${collectionId}`}
        className="mt-1 inline-block text-base font-bold text-maintainerr-400 transition hover:text-maintainerr-300"
        onClick={onClose}
      >
        {collectionTitle}
      </Link>
      {detail ? <p className="mt-2 text-sm text-zinc-400">{detail}</p> : null}
    </div>
    <ExclusionChoices
      className="mt-3"
      excluding={excluding}
      onExclude={onExclude}
    />
  </Modal>
)

export const ExclusionChoices = ({
  className = '',
  excluding,
  collectionDisabled = false,
  onExclude,
}: {
  className?: string
  excluding: boolean
  collectionDisabled?: boolean
  onExclude: (scope: 'collection' | 'global', expiresInDays?: number) => void
}) => (
  <div className={`grid grid-cols-2 gap-2 ${className}`}>
    <ExclusionChoice
      scope="This Collection"
      duration="Permanent"
      permanent
      disabled={excluding || collectionDisabled}
      onClick={() => onExclude('collection')}
    />
    <ExclusionChoice
      scope="This Collection"
      duration="7 Days"
      disabled={excluding || collectionDisabled}
      onClick={() => onExclude('collection', 7)}
    />
    <ExclusionChoice
      scope="All Collections"
      duration="Permanent"
      permanent
      disabled={excluding}
      onClick={() => onExclude('global')}
    />
    <ExclusionChoice
      scope="All Collections"
      duration="7 Days"
      disabled={excluding}
      onClick={() => onExclude('global', 7)}
    />
  </div>
)

const ExclusionChoice = ({
  scope,
  duration,
  permanent = false,
  disabled,
  onClick,
}: {
  scope: string
  duration: string
  permanent?: boolean
  disabled: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`flex min-h-16 flex-col items-center justify-center rounded-md border px-3 py-2 text-center font-medium text-white shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
      permanent
        ? 'border-red-600 bg-red-600 hover:border-red-500 hover:bg-red-500 focus:ring-red-500'
        : 'border-maintainerr-600 bg-maintainerr-600 hover:border-maintainerr-500 hover:bg-maintainerr-500 focus:ring-maintainerr-500'
    }`}
  >
    <span className="text-sm font-semibold">{scope}</span>
    <span className="mt-0.5 text-xs opacity-75">{duration}</span>
  </button>
)

export default ExclusionOptionsModal
