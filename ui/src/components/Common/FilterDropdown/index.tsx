import { ChevronDownIcon, FilterIcon } from '@heroicons/react/outline'
import { useState } from 'react'

export type FilterOption = 'all' | 'excluded' | 'nonExcluded'

interface Props {
  value: FilterOption
  onChange: (value: FilterOption) => void
}

const FilterDropdown = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false)

  const options: { label: string; value: FilterOption }[] = [
    { label: 'All Items', value: 'all' },
    { label: 'Excluded Only', value: 'excluded' },
    { label: 'Non-excluded Only', value: 'nonExcluded' },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center rounded-md bg-zinc-700 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-600"
      >
        <FilterIcon className="mr-1 h-4 w-4" />
        Filter
        <ChevronDownIcon className="ml-1 h-4 w-4" />
        {/* Orange indicator INSIDE the button */}
        {value !== 'all' && (
          <span className="absolute right-0 top-0 mr-0.5 mt-0.5 h-2 w-2 rounded-full bg-[#F6A722]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg">
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

export default FilterDropdown
