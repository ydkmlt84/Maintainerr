import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout, { LayoutErrorBoundary } from './components/Layout'
import LoadingSpinner from './components/Common/LoadingSpinner'

const Calendar = lazy(() => import('./components/Calendar'))
const Media = lazy(() => import('./components/Media'))
const Overview = lazy(() => import('./components/Overview'))
const Settings = lazy(() => import('./components/Settings'))
const SettingsAbout = lazy(() => import('./components/Settings/About'))
const SettingsJellyfin = lazy(() => import('./components/Settings/Jellyfin'))
const SettingsSeerr = lazy(() => import('./components/Settings/Seerr'))
const SettingsJobs = lazy(() => import('./components/Settings/Jobs'))
const SettingsLogs = lazy(() => import('./components/Settings/Logs'))
const SettingsMain = lazy(() => import('./components/Settings/Main'))
const SettingsNotifications = lazy(
  () => import('./components/Settings/Notifications'),
)
const SettingsPlex = lazy(() => import('./components/Settings/Plex'))
const SettingsRadarr = lazy(() => import('./components/Settings/Radarr'))
const SettingsSonarr = lazy(() => import('./components/Settings/Sonarr'))
const SettingsTautulli = lazy(() => import('./components/Settings/Tautulli'))
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage'))
const CollectionExclusionsPage = lazy(
  () => import('./pages/CollectionExclusionsPage'),
)
const CollectionInfoPage = lazy(() => import('./pages/CollectionInfoPage'))
const CollectionMediaPage = lazy(() => import('./pages/CollectionMediaPage'))
const CollectionsListPage = lazy(() => import('./pages/CollectionsListPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const RuleFormPage = lazy(() => import('./pages/RuleFormPage'))
const RulesListPage = lazy(() => import('./pages/RulesListPage'))

const basePath = import.meta.env.VITE_BASE_PATH || ''

const page = (element: ReactNode) => (
  <Suspense
    fallback={
      <div className="flex min-h-[16rem] items-center justify-center">
        <LoadingSpinner />
      </div>
    }
  >
    {element}
  </Suspense>
)

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      errorElement: <LayoutErrorBoundary />,
      children: [
        {
          index: true,
          element: <Navigate to="/overview" replace />,
        },
        {
          path: 'overview',
          element: page(<Overview />),
        },
        {
          path: 'media',
          element: page(<Media />),
        },
        {
          path: 'collections',
          children: [
            {
              index: true,
              element: page(<CollectionsListPage />),
            },
            {
              path: ':id',
              element: page(<CollectionDetailPage />),
              children: [
                {
                  index: true,
                  element: page(<CollectionMediaPage />),
                },
                {
                  path: 'exclusions',
                  element: page(<CollectionExclusionsPage />),
                },
                {
                  path: 'info',
                  element: page(<CollectionInfoPage />),
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
              element: page(<RulesListPage />),
            },
            {
              path: 'new',
              element: page(<RuleFormPage />),
            },
            {
              path: 'edit/:id',
              element: page(<RuleFormPage />),
            },
            {
              path: 'clone/:id',
              element: page(<RuleFormPage />),
            },
          ],
        },
        {
          path: 'docs',
          element: page(<DocsPage />),
        },
        {
          path: 'calendar',
          element: page(<Calendar />),
        },
        {
          path: 'settings',
          element: page(<Settings />),
          children: [
            {
              index: true,
              element: <Navigate to="/settings/main" replace />,
            },
            {
              path: 'main',
              element: page(<SettingsMain />),
            },
            {
              path: 'plex',
              element: page(<SettingsPlex />),
            },
            {
              path: 'jellyfin',
              element: page(<SettingsJellyfin />),
            },
            {
              path: 'sonarr',
              element: page(<SettingsSonarr />),
            },
            {
              path: 'radarr',
              element: page(<SettingsRadarr />),
            },
            {
              path: 'seerr',
              element: page(<SettingsSeerr />),
            },
            {
              path: 'tautulli',
              element: page(<SettingsTautulli />),
            },
            {
              path: 'notifications',
              element: page(<SettingsNotifications />),
            },
            {
              path: 'jobs',
              element: page(<SettingsJobs />),
            },
            {
              path: 'logs',
              element: page(<SettingsLogs />),
            },
            {
              path: 'about',
              element: page(<SettingsAbout />),
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
