import { Tooltip } from 'react-tooltip'

interface ActorTooltipProps {
  id: string
  name: string
  character?: string
}

const ActorTooltip = ({ id, name, character }: ActorTooltipProps) => (
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
    <div className="text-center">
      <div className="font-semibold">{name}</div>
      {character ? (
        <div className="mt-0.5 text-zinc-400">{character}</div>
      ) : null}
    </div>
  </Tooltip>
)

export default ActorTooltip
