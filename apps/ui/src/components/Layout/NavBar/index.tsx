import {
  CalendarIcon,
  ChartBarIcon,
  ClipboardCheckIcon,
  CollectionIcon,
  CogIcon,
  EyeIcon,
  MenuIcon,
  SearchIcon,
  XIcon,
} from '@heroicons/react/outline'
import { ReactNode, useContext, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SearchContext from '../../../contexts/search-context'
import Messages from '../../Messages/Messages'
import VersionStatus from '../../VersionStatus'

interface NavBarLink {
  key: string
  href: string
  svgIcon: ReactNode
  name: string
  matchPattern?: RegExp
}

interface NavBarProps {
  onSearchOpen: () => void
}

const NavBar: React.FC<NavBarProps> = ({ onSearchOpen }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const SearchCtx = useContext(SearchContext)
  const basePath = import.meta.env.VITE_BASE_PATH ?? ''
  const location = useLocation()
  const isMediaRoute = /^\/media(?:\/.*)?$/.test(location.pathname)
  // Keep variable for potential future customization
  const collectionsLabel = 'Collections'

  const navBarItems: NavBarLink[] = useMemo(
    () => [
      {
        key: '0',
        href: '/overview',
        svgIcon: <ChartBarIcon className="h-5 w-5" />,
        name: 'Overview',
        matchPattern: /^\/(?:overview(?:\/.*)?|)$/,
      },
      {
        key: '1',
        href: '/media',
        svgIcon: <EyeIcon className="h-5 w-5" />,
        name: 'Media',
        matchPattern: /^\/media(?:\/.*)?$/,
      },
      {
        key: '2',
        href: '/rules',
        svgIcon: <ClipboardCheckIcon className="h-5 w-5" />,
        name: 'Rules',
        matchPattern: /^\/rules(?:\/.*)?$/,
      },
      {
        key: '3',
        href: '/collections',
        svgIcon: <CollectionIcon className="h-5 w-5" />,
        name: collectionsLabel,
        matchPattern: /^\/collections(?:\/.*)?$/,
      },
      {
        key: '4',
        href: '/calendar',
        svgIcon: <CalendarIcon className="h-5 w-5" />,
        name: 'Calendar',
        matchPattern: /^\/calendar(?:\/.*)?$/,
      },
      {
        key: '5',
        href: '/settings',
        svgIcon: <CogIcon className="h-5 w-5" />,
        name: 'Settings',
        matchPattern: /^\/settings(?:\/.*)?$/,
      },
    ],
    [collectionsLabel],
  )

  const linkIsActive = (link: NavBarLink) => {
    if (link.matchPattern) {
      return link.matchPattern.test(location.pathname)
    }

    return location.pathname === link.href
  }

  return (
    <header
      className={`searchbar fixed left-0 right-0 top-0 z-30 shadow-none ${
        isMediaRoute ? 'overview-nav-pass' : 'top-app-chrome'
      }`}
    >
      <div
        className={`relative z-10 flex h-full min-w-0 items-center gap-3 px-3 pb-4 pt-1 sm:px-4 ${
          isMediaRoute ? 'overview-nav-content' : ''
        }`}
      >
        <Link
          to="/"
          className="order-2 mx-auto mt-1 flex h-16 w-[10.75rem] flex-shrink-0 items-center justify-center overflow-visible xs:w-[12.5rem] sm:w-[17rem] md:order-none md:mx-0 md:mt-0 md:justify-start"
        >
          <img
            className="block h-[3.55rem] w-auto max-w-full object-contain"
            src={`${basePath}/logo.svg`}
            alt="Logo"
          />
        </Link>
        <button
          className="order-1 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center text-zinc-200 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/50 md:order-none"
          aria-label="Open search"
          onClick={onSearchOpen}
        >
          <SearchIcon className="h-5 w-5" />
        </button>
        <nav className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 md:flex">
          {navBarItems.map((navBarLink) => {
            return (
              <Link
                key={navBarLink.key}
                to={navBarLink.href}
                onClick={() => {
                  if (navBarLink.href === '/media') {
                    SearchCtx.removeText()
                  }
                }}
                className={`group inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium leading-6 text-white transition duration-150 ease-in-out ${
                  linkIsActive(navBarLink)
                    ? 'border-transparent bg-gradient-to-br from-maintainerr-600 to-maintainerrdark-800 hover:from-maintainerr hover:to-maintainerrdark-700'
                    : 'border-transparent hover:bg-zinc-700'
                } focus:bg-zinc-800 focus:outline-none`}
              >
                {navBarLink.svgIcon}
                <span className="hidden sm:inline">{navBarLink.name}</span>
              </Link>
            )
          })}
        </nav>
        <button
          className="action-lens-button order-3 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-maintainerr/50 md:order-none md:ml-auto md:hidden"
          aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <XIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </button>
        <div className="hidden max-w-sm flex-shrink-0 items-center gap-2 xl:flex">
          <Messages />
          <VersionStatus />
        </div>
      </div>
      {mobileMenuOpen ? (
        <div className="mobile-nav-menu absolute left-0 right-0 top-full border-t border-zinc-700 px-3 py-3 shadow-2xl shadow-black/50 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navBarItems.map((navBarLink) => (
              <Link
                key={`mobile-${navBarLink.key}`}
                to={navBarLink.href}
                onClick={() => {
                  if (navBarLink.href === '/media') {
                    SearchCtx.removeText()
                  }
                  setMobileMenuOpen(false)
                }}
                className={`group inline-flex h-11 items-center gap-3 rounded-md border px-3 text-sm font-medium leading-6 text-white transition duration-150 ease-in-out ${
                  linkIsActive(navBarLink)
                    ? 'border-transparent bg-gradient-to-br from-maintainerr-600 to-maintainerrdark-800 text-white'
                    : 'border-transparent text-slate-300 hover:bg-zinc-700 hover:text-white'
                } focus:bg-zinc-800 focus:outline-none`}
              >
                {navBarLink.svgIcon}
                <span>{navBarLink.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

export default NavBar
