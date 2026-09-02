import { expect, test } from '@playwright/test'

const settings = {
  applicationTitle: 'Maintainerr',
  applicationUrl: 'http://127.0.0.1:4173',
  apikey: 'smoke-test-key',
  media_server_type: null,
  plex_auth_token: null,
  jellyfin_url: '',
  jellyfin_api_key: '',
}

test('renders the application shell and general settings', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname

    if (path.endsWith('/events/stream')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': smoke test\n\n',
      })
      return
    }

    const body = path.endsWith('/settings/test/setup')
      ? true
      : path.endsWith('/settings')
        ? settings
        : path.endsWith('/app/status')
          ? {
              status: true,
              version: 'smoke-test',
              commitTag: 'local',
              updateAvailable: false,
            }
          : {}

    await route.fulfill({ json: body })
  })

  await page.goto('/settings/main')

  await expect(page).toHaveTitle('General settings - Maintainerr')
  await expect(
    page.getByRole('heading', { name: 'General Settings' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
  expect(pageErrors).toEqual([])
})
