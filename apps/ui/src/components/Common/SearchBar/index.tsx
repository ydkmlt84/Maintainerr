import { ChangeEvent, useContext, useEffect, useState } from 'react'
import SearchContext from '../../../contexts/search-context'

interface ISearchBar {
  placeholder?: string
  onSearch: (input: string) => void
}

const SearchBar = (props: ISearchBar) => {
  const [text, setText] = useState<string>('')
  const SearchCtx = useContext(SearchContext)

  useEffect(() => {
    if (SearchCtx.search.text === '') {
      setText('')
    }
  }, [SearchCtx.search.text])

  useEffect(() => {
    props.onSearch(text)
  }, [text])

  const inputHandler = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value.toLowerCase())
  }

  return (
    <div className="relative flex w-full items-center text-sky-100 focus-within:text-white">
      <div className="pointer-events-none absolute left-4 z-10 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5 text-sky-100"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          ></path>
        </svg>
      </div>
      <input
        type="search"
        onChange={(e) => inputHandler(e)}
        placeholder={props.placeholder ? props.placeholder : 'Search'}
        value={text}
        className="block w-full rounded-full border border-sky-500/25 bg-slate-950/70 py-2 pl-10 text-white placeholder-slate-400 shadow-inner shadow-slate-950/40 backdrop-blur hover:border-sky-400/60 focus:border-sky-300 focus:bg-slate-950/90 focus:placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400/30 sm:text-base"
      />
    </div>
  )
}

export default SearchBar
