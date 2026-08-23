import { Tooltip } from 'react-tooltip'
import { posterTooltipStyle } from '../ExclusionBadges'
import type { MediaManagementContext } from '../ManageMediaModal'

const CollectionMembershipTooltip = ({
  id,
  memberships,
  fallbackCollectionNames = [],
}: {
  id: string
  memberships: MediaManagementContext['memberships']
  fallbackCollectionNames?: string[]
}) => {
  const collectionNames = Array.from(
    new Set([
      ...memberships.map((membership) => membership.collectionTitle),
      ...fallbackCollectionNames,
    ]),
  )

  return (
    <Tooltip
      id={id}
      place="top"
      positionStrategy="fixed"
      portalRoot={document.body}
      opacity={1}
      noArrow
      className="max-w-xs"
      style={posterTooltipStyle}
    >
      {collectionNames.length > 1 ? (
        <ul className="list-disc space-y-0.5 pl-3">
          {collectionNames.map((collectionName) => (
            <li key={collectionName}>{collectionName}</li>
          ))}
        </ul>
      ) : collectionNames.length === 1 ? (
        <span>In collection: {collectionNames[0]}</span>
      ) : (
        <span>Collection details unavailable</span>
      )}
    </Tooltip>
  )
}

export default CollectionMembershipTooltip
