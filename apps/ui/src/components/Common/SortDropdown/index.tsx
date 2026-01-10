import { ChevronDownIcon, SwitchVerticalIcon } from '@heroicons/react/outline'
import { useEffect, useRef } from 'react'

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
  | 'daysLeft:desc'
  | 'daysLeft:asc'

interface Props {
  sortOption: SortOption
  onChange: (mode: SortOption) => void
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const SortDropdown = ({
  sortOption,
  onChange,
  isOpen,
  onToggle,
  onClose,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

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
    { label: 'Days Left (Most → Least)', value: 'daysLeft:desc' },
    { label: 'Days Left (Least → Most)', value: 'daysLeft:asc' },
  ]

  useEffect(() => {
    if (!isOpen) return

    const handler = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el) return

      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      const clickedInside =
        path.length > 0 ? path.includes(el) : el.contains(e.target as Node)

      if (!clickedInside) onClose()
    }

    document.addEventListener('pointerdown', handler, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', handler, {
        capture: true,
      } as any)
    }
  }, [isOpen, onClose])

  return (
    <div ref={rootRef} className="relative flex-1 md:flex-none">
      <button
        type="button"
        onClick={onToggle}
        className="relative inline-flex w-full items-center justify-center rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:border-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-0"
      >
        <SwitchVerticalIcon className="mr-1 h-4 w-4" />
        Sort
        <ChevronDownIcon className="ml-1 h-4 w-4 text-zinc-500" />
        {sortOption !== 'title:asc' && (
          <span className="absolute right-0 top-0 mr-0.5 mt-0.5 h-2 w-2 rounded-full bg-[#F6A722]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                onClose()
              }}
              className={`block w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 ${
                sortOption === opt.value ? 'bg-zinc-700' : ''
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
