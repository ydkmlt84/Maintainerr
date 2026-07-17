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
const SettingsJobs = lazy(() => import('./components/Settings/Jobs'))
const SettingsLogs = lazy(() => import('./components/Settings/Logs'))
const SettingsMain = lazy(() => import('./components/Settings/Main'))
const SettingsNotifications = lazy(
  () => import('./components/Settings/Notifications'),
)
const SettingsPlex = lazy(() => import('./components/Settings/Plex'))
const SettingsServices = lazy(() => import('./components/Settings/Services'))
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
const MediaIdAuditPage = lazy(() => import('./pages/MediaIdAuditPage'))

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
          path: 'reports/media-id-audit',
          element: <Navigate to="/settings/reports" replace />,
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
              path: 'services',
              element: page(<SettingsServices />),
            },
            {
              path: 'sonarr',
              element: <Navigate to="/settings/services" replace />,
            },
            {
              path: 'radarr',
              element: <Navigate to="/settings/services" replace />,
            },
            {
              path: 'seerr',
              element: <Navigate to="/settings/services" replace />,
            },
            {
              path: 'tautulli',
              element: <Navigate to="/settings/services" replace />,
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
              path: 'reports',
              element: page(<MediaIdAuditPage />),
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
