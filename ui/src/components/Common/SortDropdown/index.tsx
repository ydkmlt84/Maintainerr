import { ChevronDownIcon, SwitchVerticalIcon } from '@heroicons/react/outline'
import { useState } from 'react'

export type SortOption =
  | 'title:asc'
  | 'title:desc'
  | 'addedAt:desc'
  | 'addedAt:asc'
  | 'released:desc'
  | 'released:asc'
  | 'lastViewedAt:desc'
  | 'lastViewedAt:asc'
  | 'viewCount:desc'
  | 'viewCount:asc'

interface Props {
  value: SortOption
  onChange: (v: SortOption) => void
}

const SortDropdown = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false)

  const options: { label: string; value: SortOption }[] = [
    { label: 'Title (A–Z)', value: 'title:asc' },
    { label: 'Title (Z–A)', value: 'title:desc' },
    { label: 'Date Added (Newest)', value: 'addedAt:desc' },
    { label: 'Date Added (Oldest)', value: 'addedAt:asc' },
    { label: 'Release Date (Newest)', value: 'released:desc' },
    { label: 'Release Date (Oldest)', value: 'released:asc' },
    { label: 'Last Viewed (Newest)', value: 'lastViewedAt:desc' },
    { label: 'Last Viewed (Oldest)', value: 'lastViewedAt:asc' },
    { label: 'Play Count (Most Played)', value: 'viewCount:desc' },
    { label: 'Play Count (Least Played)', value: 'viewCount:asc' },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center rounded-md bg-zinc-700 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-600"
      >
        <SwitchVerticalIcon className="mr-1 h-4 w-4" />
        Sort
        <ChevronDownIcon className="ml-1 h-4 w-4" />
        {/* Orange indicator INSIDE the button */}
        {value !== 'title:asc' && (
          <span className="absolute right-0 top-0 mr-0.5 mt-0.5 h-2 w-2 rounded-full bg-[#F6A722]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`block w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 ${
                value === opt.value ? 'bg-zinc-700' : ''
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SortDropdown
