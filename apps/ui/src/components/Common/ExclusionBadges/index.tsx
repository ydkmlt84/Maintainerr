import { CollectionIcon, GlobeAltIcon } from '@heroicons/react/outline'
import { useId } from 'react'
import { Tooltip } from 'react-tooltip'
import type { MediaManagementContext } from '../ManageMediaModal'

const ExclusionBadges = ({
  exclusions,
  className = '',
}: {
  exclusions: MediaManagementContext['exclusions']
  className?: string
}) => {
  const tooltipId = useId().replace(/:/g, '')
  const globalExclusion = exclusions.find(
    (exclusion) => exclusion.scope === 'global',
  )
  const collectionExclusions = exclusions.filter(
    (exclusion) => exclusion.scope === 'collection',
  )

  if (!globalExclusion && collectionExclusions.length === 0) return null

  const collectionNames = Array.from(
    new Set(
      collectionExclusions.map(
        (exclusion) =>
          exclusion.collectionTitle ??
          exclusion.ruleGroupName ??
          'Unknown collection',
      ),
    ),
  )
  const entries = [
    ...(globalExclusion ? ['Excluded Globally'] : []),
    ...collectionNames,
  ]
  const tooltipContent =
    entries.length > 1 ? (
      <ul className="list-disc space-y-0.5 pl-3">
        {entries.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    ) : (
      <span>
        {globalExclusion ? 'Excluded Globally' : `Excluded from: ${entries[0]}`}
      </span>
    )

  return (
    <div
      className={`absolute right-0 z-40 flex items-center gap-1 p-2 ${className}`}
    >
      {globalExclusion ? (
        <>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-900/95 text-violet-50 shadow-lg ring-1 ring-violet-400/50"
            data-tooltip-id={tooltipId}
            aria-label="Global exclusion"
          >
            <GlobeAltIcon className="h-4 w-4" />
          </span>
        </>
      ) : null}
      {collectionExclusions.length ? (
        <>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-900/95 text-sky-50 shadow-lg ring-1 ring-sky-400/50"
            data-tooltip-id={tooltipId}
            aria-label="Collection-specific exclusion"
          >
            <CollectionIcon className="h-4 w-4" />
          </span>
        </>
      ) : null}
      <Tooltip
        id={tooltipId}
        place="top"
        positionStrategy="fixed"
        portalRoot={document.body}
        opacity={1}
        noArrow
        className="max-w-xs"
        style={posterTooltipStyle}
      >
        {tooltipContent}
      </Tooltip>
    </div>
  )
}

export const posterTooltipStyle = {
  zIndex: 9999,
  padding: '2px 5px',
  border: '1px solid rgb(217 119 6)',
  borderRadius: '6px',
  backgroundColor: 'rgb(113 113 122)',
  color: 'rgb(251 191 36)',
  fontSize: '0.75rem',
  fontWeight: 700,
  lineHeight: '1rem',
}

export default ExclusionBadges
