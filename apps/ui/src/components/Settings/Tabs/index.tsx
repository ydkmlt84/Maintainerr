import React, { ReactNode, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export interface SettingsRoute {
  text: string
  content?: React.ReactNode
  route: string
  regex: RegExp
}
export interface ISettingsLink {
  tabType: 'default' | 'button'
  currentPath: string
  route: string
  regex: RegExp
  hidden?: boolean
  isMobile?: boolean
  disabled?: boolean
  children?: ReactNode
}

const SettingsLink: React.FC<ISettingsLink> = (props: ISettingsLink) => {
  if (props.isMobile) {
    return (
      <option disabled={props.disabled} value={props.route}>
        {props.children}
      </option>
    )
  }

  let linkClasses =
    (props.disabled ? 'pointer-events-none touch-none opacity-50 ' : '') +
    'flex w-full items-center rounded-md border px-3 py-3 text-sm font-medium leading-5 transition duration-300'
  let activeLinkColor = 'panel-surface border-zinc-500 text-white shadow-sm'
  let inactiveLinkColor =
    'border-transparent text-slate-400 hover:border-zinc-600 hover:bg-zinc-900/80 hover:text-slate-100 focus:border-zinc-500 focus:bg-zinc-900/80 focus:text-slate-100'

  if (props.tabType === 'button') {
    linkClasses =
      'px-3 py-2 text-sm font-medium transition duration-300 rounded-md whitespace-nowrap mx-2 my-1'
    activeLinkColor = 'bg-maintainerr-600 text-white'
    inactiveLinkColor = 'bg-zinc-800 hover:bg-zinc-700 focus:bg-zinc-700'
  }

  return (
    <Link
      to={props.route}
      className={`${linkClasses} ${
        props.currentPath.match(props.regex)
          ? activeLinkColor
          : inactiveLinkColor
      }`}
      aria-current="page"
    >
      {props.children}
    </Link>
  )
}

const SettingsTabs: React.FC<{
  tabType?: 'default' | 'button'
  settingsRoutes: SettingsRoute[]
  allEnabled?: boolean
}> = ({ tabType = 'default', settingsRoutes, allEnabled = true }) => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!allEnabled) {
        e.preventDefault()
      }
    }
    window.addEventListener('touchstart', handleTouchStart)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
    }
  }, [allEnabled])

  const currentRoute =
    settingsRoutes.find((route) => route.regex.test(location.pathname))
      ?.route ?? ''

  return (
    <>
      <div className="sm:hidden">
        <label htmlFor="settings-tabs" className="sr-only">
          Select a Tab
        </label>
        <select
          id="settings-tabs"
          className="block w-full rounded-md border border-zinc-700 bg-zinc-900 text-white shadow-sm shadow-slate-950/20 transition duration-150 ease-in-out focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/40 sm:text-sm sm:leading-5"
          value={currentRoute}
          onChange={(e) => {
            navigate(e.target.value)
          }}
          onBlur={(e) => {
            navigate(e.target.value)
          }}
          aria-label="Selected Tab"
        >
          {settingsRoutes.map((route, index) => (
            <SettingsLink
              disabled={!allEnabled}
              tabType={tabType}
              currentPath={location.pathname}
              route={route.route}
              regex={route.regex}
              isMobile
              key={`mobile-settings-link-${index}`}
            >
              {route.text}
            </SettingsLink>
          ))}
        </select>
      </div>
      {tabType === 'button' ? (
        <div className="hidden sm:block">
          <nav className="-mx-2 -my-1 flex flex-wrap" aria-label="Tabs">
            {settingsRoutes.map((route, index) => (
              <SettingsLink
                disabled={!allEnabled}
                tabType={tabType}
                currentPath={location.pathname}
                route={route.route}
                regex={route.regex}
                key={`button-settings-link-${index}`}
              >
                {route.content ?? route.text}
              </SettingsLink>
            ))}
          </nav>
        </div>
      ) : (
        <aside className="hidden sm:block">
          <nav className="flex flex-col gap-2 p-1.5" aria-label="Settings">
            {settingsRoutes.map((route, index) => (
              <SettingsLink
                disabled={!allEnabled}
                tabType={tabType}
                currentPath={location.pathname}
                route={route.route}
                regex={route.regex}
                key={`standard-settings-link-${index}`}
              >
                {route.text}
              </SettingsLink>
            ))}
          </nav>
        </aside>
      )}
    </>
  )
}

export default SettingsTabs
