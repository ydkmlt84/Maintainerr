import { ReactNode, useContext, useEffect, useState } from 'react'
import SettingsContext from '../../contexts/settings-context'
import GetApiHandler from '../../utils/ApiHandler'
import LoadingSpinner from '../Common/LoadingSpinner'
import SettingsTabs, { SettingsRoute } from './Tabs'

const SettingsWrapper: React.FC<{ children?: ReactNode }> = (props: {
  children?: ReactNode
}) => {
  const settingsCtx = useContext(SettingsContext)
  const [loaded, setLoaded] = useState(false)

  const settingsRoutes: SettingsRoute[] = [
    {
      text: 'General',
      route: '/settings/main',
      regex: /^\/settings(\/main)?$/,
    },
    {
      text: 'Plex',
      route: '/settings/plex',
      regex: /^\/settings(\/plex)?$/,
    },
    {
      text: 'Overseerr & Jellyseerr',
      route: '/settings/seerrservices',
      regex: /^\/settings(\/seerrservices)?$/,
    },
    {
      text: 'Radarr & Sonarr',
      route: '/settings/arrservices',
      regex: /^\/settings(\/arrservices)?$/,
    },
    {
      text: 'Tautulli',
      route: '/settings/tautulli',
      regex: /^\/settings(\/tautulli)?$/,
    },
    {
      text: 'Notifications',
      route: '/settings/notifications',
      regex: /^\/settings(\/notifications)?$/,
    },
    {
      text: 'Logs',
      route: '/settings/logs',
      regex: /^\/settings(\/logs)?$/,
    },
    {
      text: 'Jobs',
      route: '/settings/jobs',
      regex: /^\/settings(\/jobs)?$/,
    },
    {
      text: 'About',
      route: '/settings/about',
      regex: /^\/settings(\/about)?$/,
    },
  ]

  useEffect(() => {
    if (settingsCtx.settings?.id === undefined) {
      GetApiHandler('/settings').then((resp) => {
        settingsCtx.addSettings(resp)
        setLoaded(true)
      })
    } else {
      setLoaded(true)
    }
  }, [])

  if (loaded) {
    return (
      <>
        <div className="mt-6">
          <SettingsTabs
            settingsRoutes={settingsRoutes}
            allEnabled={settingsCtx.settings.plex_auth_token !== null}
          />
        </div>
        <div className="mt-10 text-white">{props.children}</div>
      </>
    )
  } else {
    return (
      <>
        <div className="mt-6">
          <LoadingSpinner />
        </div>
      </>
    )
  }
}
export default SettingsWrapper
