import { Tooltip } from 'react-tooltip'

const BackdropLinkTooltip = ({
  id,
  label,
  value,
}: {
  id: string
  label: string
  value: string | number
}) => (
  <Tooltip
    id={id}
    place="left"
    positionStrategy="fixed"
    portalRoot={document.body}
    opacity={1}
    noArrow
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
    <span className="font-semibold">{label}</span> ID: {value}
  </Tooltip>
)

export default BackdropLinkTooltip
