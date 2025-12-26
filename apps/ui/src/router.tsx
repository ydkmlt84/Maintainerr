import { createBrowserRouter, Navigate, redirect } from 'react-router-dom'
import Layout, { LayoutErrorBoundary } from './components/Layout'
import Overview from './components/Overview'
import Settings from './components/Settings'
import SettingsAbout from './components/Settings/About'
import SettingsJellyseerr from './components/Settings/Jellyseerr'
import SettingsJobs from './components/Settings/Jobs'
import SettingsLogs from './components/Settings/Logs'
import SettingsMain from './components/Settings/Main'
import SettingsNotifications from './components/Settings/Notifications'
import SettingsOverseerr from './components/Settings/Overseerr'
import SettingsPlex from './components/Settings/Plex'
import SettingsRadarr from './components/Settings/Radarr'
import SettingsSonarr from './components/Settings/Sonarr'
import SettingsTautulli from './components/Settings/Tautulli'
import AppLoadingPage from './pages/AppLoadingPage'
import CollectionDetailPage from './pages/CollectionDetailPage'
import CollectionExclusionsPage from './pages/CollectionExclusionsPage'
import CollectionInfoPage from './pages/CollectionInfoPage'
import CollectionMediaPage from './pages/CollectionMediaPage'
import CollectionsListPage from './pages/CollectionsListPage'
import DocsPage from './pages/DocsPage'
import PlexLoadingPage from './pages/PlexLoadingPage'
import RuleFormPage from './pages/RuleFormPage'
import RulesListPage from './pages/RulesListPage'
import SetupPage from './pages/SetupPage'

const basePath = import.meta.env.VITE_BASE_PATH || ''

type AppStatusResponse = {
  status?: number
  version?: string
  commitTag?: string
  updateAvailable?: boolean
}

async function setupPageLoader() {
  let res: Response
  try {
    res = await fetch('/api/settings/test/setup', {
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    // API not ready (or network/proxy not ready) -> let /setup render.
    return null
  }

  if (!res.ok) return null

  const setupDone = (await res.json()) as boolean
  if (setupDone) throw redirect('/overview')

  return null
}

async function appBootstrapLoader() {
  // 1) API readiness check: if we cannot get a valid response from /api/app/status,
  // redirect to /loading (AppLoadingPage will poll until ready).
  let statusRes: Response
  try {
    statusRes = await fetch('/api/app/status', {
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    throw redirect('/loading')
  }

  if (!statusRes.ok) {
    throw redirect('/loading')
  }

  // If the response isn't valid JSON, treat API as "not ready".
  let statusJson: AppStatusResponse
  try {
    statusJson = (await statusRes.json()) as AppStatusResponse
  } catch {
    throw redirect('/loading')
  }

  // You said you mainly care that you get a response at all.
  // We'll still require `status` to be truthy, since your endpoint explicitly returns it.
  if (!statusJson.status) {
    throw redirect('/loading')
  }

  // 2) Setup check
  let setupRes: Response
  try {
    setupRes = await fetch('/api/settings/test/setup', {
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    throw redirect('/loading')
  }

  if (!setupRes.ok) {
    throw redirect('/loading')
  }

  const setupDone = (await setupRes.json()) as boolean
  if (!setupDone) throw redirect('/setup')

  return null
}

export const router = createBrowserRouter(
  [
    {
      path: '/loading',
      element: <AppLoadingPage />,
    },
    {
      path: '/setup',
      element: <SetupPage />,
      loader: setupPageLoader,
    },
    {
      path: '/',
      element: <Layout />,
      loader: appBootstrapLoader,
      errorElement: <LayoutErrorBoundary />,
      children: [
        {
          index: true,
          element: <Navigate to="/overview" replace />,
        },
        {
          path: 'overview',
          element: <Overview />,
        },
        {
          path: 'collections',
          children: [
            {
              index: true,
              element: <CollectionsListPage />,
            },
            {
              path: ':id',
              element: <CollectionDetailPage />,
              children: [
                {
                  index: true,
                  element: <CollectionMediaPage />,
                },
                {
                  path: 'exclusions',
                  element: <CollectionExclusionsPage />,
                },
                {
                  path: 'info',
                  element: <CollectionInfoPage />,
                },
              ],
            },
          ],
        },
        {
          path: 'rules',
          children: [
            {
              index: true,
              element: <RulesListPage />,
            },
            {
              path: 'new',
              element: <RuleFormPage />,
            },
            {
              path: 'edit/:id',
              element: <RuleFormPage />,
            },
            {
              path: 'clone/:id',
              element: <RuleFormPage />,
            },
          ],
        },
        {
          path: 'docs',
          element: <DocsPage />,
        },
        {
          path: 'login/plex/loading',
          element: <PlexLoadingPage />,
        },
        {
          path: 'settings',
          element: <Settings />,
          children: [
            {
              index: true,
              element: <Navigate to="/settings/main" replace />,
            },
            {
              path: 'main',
              element: <SettingsMain />,
            },
            {
              path: 'plex',
              element: <SettingsPlex />,
            },
            {
              path: 'sonarr',
              element: <SettingsSonarr />,
            },
            {
              path: 'radarr',
              element: <SettingsRadarr />,
            },
            {
              path: 'overseerr',
              element: <SettingsOverseerr />,
            },
            {
              path: 'jellyseerr',
              element: <SettingsJellyseerr />,
            },
            {
              path: 'tautulli',
              element: <SettingsTautulli />,
            },
            {
              path: 'notifications',
              element: <SettingsNotifications />,
            },
            {
              path: 'jobs',
              element: <SettingsJobs />,
            },
            {
              path: 'logs',
              element: <SettingsLogs />,
            },
            {
              path: 'about',
              element: <SettingsAbout />,
            },
          ],
        },
      ],
    },
  ],
  {
    basename: basePath,
  },
)
