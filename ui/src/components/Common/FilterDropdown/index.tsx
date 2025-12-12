import { ChevronDownIcon, FilterIcon } from '@heroicons/react/outline'
import { useEffect, useRef } from 'react'

export type FilterOption = 'all' | 'excluded' | 'nonExcluded'

interface Props {
  filterOption: FilterOption
  onChange: (mode: FilterOption) => void
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const FilterDropdown = ({
  filterOption,
  onChange,
  isOpen,
  onToggle,
  onClose,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  const options: { label: string; value: FilterOption }[] = [
    { label: 'All Items', value: 'all' },
    { label: 'Excluded Only', value: 'excluded' },
    { label: 'Non-excluded Only', value: 'nonExcluded' },
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
        <FilterIcon className="mr-1 h-4 w-4" />
        Filter
        <ChevronDownIcon className="ml-1 h-4 w-4 text-zinc-500" />
        {/* Orange indicator INSIDE the button */}
        {filterOption !== 'all' && (
          <span className="absolute right-0 top-0 mr-0.5 mt-0.5 h-2 w-2 rounded-full bg-[#F6A722]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                onClose()
              }}
              className={`block w-full px-4 py-2 text-left text-sm text-white hover:bg-zinc-700 ${
                filterOption === opt.value ? 'bg-zinc-700' : ''
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

export default FilterDropdown
