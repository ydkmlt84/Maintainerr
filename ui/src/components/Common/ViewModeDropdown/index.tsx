import {
  ChevronDownIcon,
  TableIcon,
  ViewGridIcon,
} from '@heroicons/react/outline'
import { useEffect, useRef } from 'react'

export type ViewMode = 'poster' | 'table'

interface Props {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const ViewToggleDropdown = ({
  viewMode,
  onChange,
  isOpen,
  onToggle,
  onClose,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const options: { label: string; value: ViewMode; icon: JSX.Element }[] = [
    {
      label: 'Poster View',
      value: 'poster',
      icon: <ViewGridIcon className="mr-2 h-4 w-4" />,
    },
    {
      label: 'Table View',
      value: 'table',
      icon: <TableIcon className="mr-2 h-4 w-4" />,
    },
  ]

  const active = options.find((o) => o.value === viewMode) ?? options[0]

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el) return

      const target = e.target
      if (target instanceof Node && !el.contains(target)) {
        onClose()
      }
    }

    // capture = true helps when clicks are stopped inside components
    document.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isOpen, onClose])

  return (
    // ✅ attach the ref here
    <div ref={rootRef} className="relative flex-1 md:flex-none">
      <button
        type="button"
        onClick={onToggle}
        className="relative inline-flex w-full items-center justify-center rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:border-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-0"
      >
        {active.icon}
        View
        <ChevronDownIcon className="ml-1 h-4 w-4 text-zinc-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-40 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg md:right-0">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                onClose()
              }}
              className={`flex w-full items-center px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 ${
                viewMode === opt.value ? 'bg-zinc-700' : ''
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ViewToggleDropdown
