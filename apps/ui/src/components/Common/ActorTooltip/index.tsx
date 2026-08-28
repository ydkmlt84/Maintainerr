import { Tooltip } from 'react-tooltip'
import { getTmdbActorImageUrl } from '../../../utils/TmdbImage'

interface ActorTooltipProps {
  id: string
  name: string
  character?: string
  personId: number
  profilePath?: string
}

export const getActorProfileImageUrl = getTmdbActorImageUrl

const ActorTooltip = ({
  id,
  name,
  character,
  personId,
  profilePath,
}: ActorTooltipProps) => {
  const profileImageUrl = getActorProfileImageUrl(personId, profilePath)

  return (
    <Tooltip
      id={id}
      place="top"
      positionStrategy="fixed"
      portalRoot={document.body}
      opacity={1}
      noArrow
      className="max-w-xs"
      style={{
        zIndex: 9999,
        padding: '6px 9px',
        border: '1px solid rgb(82 82 91)',
        borderRadius: '6px',
        backgroundColor: 'rgb(24 24 27)',
        color: 'rgb(244 244 245)',
        fontSize: '0.75rem',
      }}
    >
      <div className="w-32 text-center">
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={name}
            loading="lazy"
            width={128}
            height={160}
            className="mb-2 h-40 w-32 rounded object-cover"
          />
        ) : null}
        <div className="font-semibold leading-tight">{name}</div>
        {character ? (
          <div className="mt-1 leading-tight text-zinc-400">{character}</div>
        ) : null}
      </div>
    </Tooltip>
  )
}

export default ActorTooltip
