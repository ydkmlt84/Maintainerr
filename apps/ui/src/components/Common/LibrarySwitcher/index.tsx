import { useEffect, useRef, useState } from 'react'
import { useMediaServerLibraries } from '../../../api/media-server'

interface ILibrarySwitcher {
  onLibraryChange: (libraryId: string) => void
  shouldShowAllOption?: boolean
  selectedLibraryId?: string
  containerClassName?: string
  formClassName?: string
  selectClassName?: string
}

const LibrarySwitcher = (props: ILibrarySwitcher) => {
  const {
    containerClassName = 'mb-5 w-full',
    formClassName,
    onLibraryChange,
    selectedLibraryId,
    selectClassName,
    shouldShowAllOption,
  } = props
  const [internalSelectedLibraryId, setInternalSelectedLibraryId] =
    useState<string>(shouldShowAllOption === false ? '' : 'all')
  const {
    data: libraries,
    error: librariesError,
    isLoading: librariesLoading,
  } = useMediaServerLibraries()
  const lastAutoSelectedLibraryId = useRef<string | null>(null)
  const resolvedSelectedLibraryId =
    selectedLibraryId ?? internalSelectedLibraryId

  const onSwitchLibrary = (event: { target: { value: string } }) => {
    setInternalSelectedLibraryId(event.target.value)
    onLibraryChange(event.target.value)
  }

  useEffect(() => {
    if (!libraries || libraries.length === 0) {
      return
    }

    if (shouldShowAllOption === false) {
      const selectedLibraryExists = libraries.some(
        (library) => library.id === resolvedSelectedLibraryId,
      )
      const firstId = selectedLibraryExists
        ? resolvedSelectedLibraryId
        : libraries[0].id

      if (firstId && lastAutoSelectedLibraryId.current !== firstId) {
        lastAutoSelectedLibraryId.current = firstId
        setTimeout(() => setInternalSelectedLibraryId(firstId), 0)
        onLibraryChange(firstId)
      }
    } else {
      lastAutoSelectedLibraryId.current = null
    }
  }, [
    libraries,
    resolvedSelectedLibraryId,
    shouldShowAllOption,
    onLibraryChange,
  ])

  return (
    <>
      <div className={containerClassName}>
        <form className={formClassName ?? 'w-full'}>
          <select
            className={
              selectClassName ??
              'block w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-white shadow-sm transition duration-150 ease-in-out hover:border-zinc-500 focus:border-zinc-500 focus:bg-opacity-100 focus:placeholder-zinc-400 focus:outline-none focus:ring-0 disabled:opacity-50 sm:text-sm sm:leading-5'
            }
            onChange={onSwitchLibrary}
            value={resolvedSelectedLibraryId}
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
                {(props.shouldShowAllOption === undefined ||
                  props.shouldShowAllOption) && (
                  <option value="all">All</option>
                )}

                {libraries?.map((lib) => {
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
