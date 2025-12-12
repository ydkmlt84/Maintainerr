import {
  ChevronDownIcon,
  TableIcon,
  ViewGridIcon,
} from '@heroicons/react/outline'
import { useState } from 'react'

export type ViewMode = 'poster' | 'table'

interface Props {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}

const ViewToggleDropdown = ({ viewMode, onChange }: Props) => {
  const [open, setOpen] = useState(false)

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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1 text-sm font-medium text-white hover:border-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-0"
      >
        {/* Leading icon reflects current view */}
        {active.icon}
        View
        <ChevronDownIcon className="ml-1 h-4 w-4 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
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
