import {
  compareMediaItemsBySort,
  type MediaItem,
  type MediaLibrary,
  type MediaLibrarySortKey,
  type MediaLibrarySortParams,
  type MediaSortOrder,
} from '@maintainerr/contracts'
import { useState } from 'react'
import { Select } from '../Forms/Select'
import { SmallLoadingSpinner } from './LoadingSpinner'

const defaultOverviewSortValue: MediaLibrarySortKey = 'title.asc'
const titleAscendingSortLabel = 'Title (A-Z) Ascending'

interface SortOption {
  value: MediaLibrarySortKey
  label: string
  sortParams: MediaLibrarySortParams
}

interface SortConfig {
  defaultValue: MediaLibrarySortKey
  options: SortOption[]
}

const createMediaLibrarySortOption = (
  value: MediaLibrarySortKey,
  label: string,
): SortOption => {
  const [sort, sortOrder] = value.split('.') as [
    MediaLibrarySortParams['sort'],
    MediaSortOrder,
  ]

  return {
    value,
    label,
    sortParams: {
      sort,
      sortOrder,
    },
  }
}

const getSortOptionByValue = (
  options: ReadonlyArray<SortOption>,
  value: string,
) => {
  return options.find((option) => option.value === value)
}

const getResolvedSortOption = (
  options: ReadonlyArray<SortOption>,
  value: string,
  defaultValue: string,
): SortOption => {
  return (
    getSortOptionByValue(options, value) ??
    getSortOptionByValue(options, defaultValue) ??
    options[0]!
  )
}

export const getMediaLibrarySortConfig = (
  libraryType?: MediaLibrary['type'],
): SortConfig => {
  const airDateLabel =
    libraryType === 'show' ? 'First Air Date' : 'Release Date'

  return {
    defaultValue: defaultOverviewSortValue,
    options: [
      createMediaLibrarySortOption(
        defaultOverviewSortValue,
        titleAscendingSortLabel,
      ),
      createMediaLibrarySortOption('title.desc', 'Title (Z-A) Descending'),
      createMediaLibrarySortOption(
        'airDate.desc',
        `${airDateLabel} Descending`,
      ),
      createMediaLibrarySortOption('airDate.asc', `${airDateLabel} Ascending`),
      createMediaLibrarySortOption('rating.desc', 'Rating Descending'),
      createMediaLibrarySortOption('rating.asc', 'Rating Ascending'),
      createMediaLibrarySortOption('watchCount.desc', 'Most Watched'),
      createMediaLibrarySortOption('watchCount.asc', 'Least Watched'),
    ],
  }
}

export const sortMediaItems = (
  items: MediaItem[],
  sortParams?: MediaLibrarySortParams,
): MediaItem[] => {
  const resolvedSortParams: MediaLibrarySortParams = sortParams ?? {
    sort: 'title',
    sortOrder: 'asc',
  }

  return [...items].sort((leftItem, rightItem) =>
    compareMediaItemsBySort(
      leftItem,
      rightItem,
      resolvedSortParams.sort,
      resolvedSortParams.sortOrder,
    ),
  )
}

interface MediaLibrarySortControlProps {
  ariaLabel: string
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  onSortChange: (value: string) => void
  isLoading?: boolean
}

export const useMediaLibrarySort = (config: SortConfig) => {
  const [sortValue, setSortValue] = useState(config.defaultValue)
  const resolvedSortOption = getResolvedSortOption(
    config.options,
    sortValue,
    config.defaultValue,
  )

  const onSortChange = (nextValue: string) => {
    const nextSortOption = getSortOptionByValue(config.options, nextValue)
    if (!nextSortOption || nextSortOption.value === resolvedSortOption.value) {
      return undefined
    }

    setSortValue((currentValue) =>
      currentValue === nextSortOption.value
        ? currentValue
        : nextSortOption.value,
    )

    return nextSortOption
  }

  return {
    sortValue: resolvedSortOption.value,
    sortParams: resolvedSortOption.sortParams,
    onSortChange,
  }
}

export const MediaLibrarySortControl = ({
  ariaLabel,
  options,
  value,
  onSortChange,
  isLoading = false,
}: MediaLibrarySortControlProps) => {
  return (
    <div className="relative w-full">
      <Select
        aria-label={ariaLabel}
        name="sort"
        value={value}
        onChange={(event) => onSortChange(event.target.value)}
        className={isLoading ? 'pr-14' : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {isLoading ? (
        <div
          role="status"
          aria-label="Loading sorted items"
          className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2"
        >
          <SmallLoadingSpinner className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  )
}
