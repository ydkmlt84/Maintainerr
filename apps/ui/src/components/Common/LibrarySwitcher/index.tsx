import { useEffect, useRef } from 'react'
import { useMediaServerLibraries } from '../../../api/media-server'

interface ILibrarySwitcher {
  onLibraryChange: (libraryId: string) => void
  shouldShowAllOption?: boolean
  allowedLibraryIds?: string[]
  selectedLibraryId?: string
}

const LibrarySwitcher = (props: ILibrarySwitcher) => {
  const {
    onLibraryChange,
    shouldShowAllOption,
    allowedLibraryIds,
    selectedLibraryId,
  } = props
  const {
    data: libraries,
    error: librariesError,
    isLoading: librariesLoading,
  } = useMediaServerLibraries()
  const lastAutoSelectedLibraryId = useRef<string | null>(null)
  const filteredLibraries = (libraries ?? []).filter((lib) => {
    if (!allowedLibraryIds) {
      return true
    }

    return allowedLibraryIds.includes(lib.id)
  })
  const showAllOption =
    shouldShowAllOption === undefined || shouldShowAllOption === true

  const onSwitchLibrary = (event: { target: { value: string } }) => {
    onLibraryChange(event.target.value)
  }

  useEffect(() => {
    if (filteredLibraries.length === 0) {
      return
    }

    if (shouldShowAllOption === false) {
      const firstId = filteredLibraries[0].id

      if (firstId && lastAutoSelectedLibraryId.current !== firstId) {
        lastAutoSelectedLibraryId.current = firstId
        onLibraryChange(firstId)
      }
    } else {
      lastAutoSelectedLibraryId.current = null
    }
  }, [filteredLibraries, shouldShowAllOption, onLibraryChange])

  return (
    <>
      <div className="mb-5 w-full">
        <form>
          <select
            className="border-zinc-600 hover:border-zinc-500 focus:border-zinc-500 focus:bg-opacity-100 focus:placeholder-zinc-400 focus:outline-none focus:ring-0"
            onChange={onSwitchLibrary}
            value={selectedLibraryId}
          >
            {librariesLoading ? (
              <option disabled={true} value="">
                Loading libraries...
              </option>
            ) : librariesError ? (
              <option disabled={true} value="">
                Could not fetch libraries
              </option>
            ) : (
              <>
                {showAllOption && <option value="all">All</option>}

                {filteredLibraries.map((lib) => {
                  return (
                    <option key={lib.id} value={lib.id}>
                      {lib.title}
                    </option>
                  )
                })}
              </>
            )}
          </select>
        </form>
      </div>
    </>
  )
}

export default LibrarySwitcher
