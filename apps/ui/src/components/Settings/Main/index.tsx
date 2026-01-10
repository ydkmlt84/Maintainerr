import { RefreshIcon, SaveIcon } from '@heroicons/react/solid'
import React, { useRef, useState } from 'react'
import { useSettingsOutletContext } from '..'
import { usePatchSettings } from '../../../api/settings'
import GetApiHandler, { PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import DocsButton from '../../Common/DocsButton'

const MainSettings = () => {
  const hostnameRef = useRef<HTMLInputElement>(null)
  const apiKeyRef = useRef<HTMLInputElement>(null)
  const cacheEnabledRef = useRef<HTMLInputElement>(null)
  const cacheMaxRef = useRef<HTMLInputElement>(null)
  const [missingValuesError, setMissingValuesError] = useState<boolean>()
  const [cacheError, setCacheError] = useState<string | null>(null)
  const { settings } = useSettingsOutletContext()
  const [cacheEnabled, setCacheEnabled] = useState<boolean>(
    settings.image_cache_enabled ?? true,
  )
  const [clearingCache, setClearingCache] = useState<boolean>(false)
  const [cacheClearedMsg, setCacheClearedMsg] = useState<string | null>(null)
  const {
    mutateAsync: updateSettings,
    isSuccess,
    isPending,
  } = usePatchSettings()

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMissingValuesError(false)
    setCacheError(null)
    if (hostnameRef.current?.value && apiKeyRef.current?.value) {
      const cacheMaxVal = cacheMaxRef.current?.value
        ? Math.max(100, +cacheMaxRef.current.value)
        : 200
      const payload = {
        applicationUrl: hostnameRef.current.value,
        apikey: apiKeyRef.current.value,
        image_cache_enabled: !!cacheEnabledRef.current?.checked,
        image_cache_max_mb: cacheMaxVal,
      }

      await updateSettings(payload)
    } else {
      setMissingValuesError(true)
    }
  }

  const regenerateApi = async () => {
    const key = await GetApiHandler('/settings/api/generate')

    await updateSettings({
      apikey: key,
    })
  }

  const clearImageCache = async () => {
    const proceed = window.confirm(
      'Clear cached images? This will remove all downloaded posters and backdrops from your file system. If cache is enabled, the images will be redownloaded as needed.',
    )
    if (!proceed) return

    setClearingCache(true)
    setCacheClearedMsg(null)
    try {
      const resp = await PostApiHandler<{ deleted: number }>(
        '/moviedb/cache/clear',
        {},
      )
      setCacheClearedMsg(
        `Cleared image cache${resp?.deleted ? ` (${resp.deleted} files)` : ''}`,
      )
    } catch (err: any) {
      setCacheError('Failed to clear image cache')
    } finally {
      setClearingCache(false)
    }
  }

  return (
    <>
      <title>General settings - Maintainerr</title>
      <div className="h-full w-full">
        <div className="section h-full w-full">
          <h3 className="heading">General Settings</h3>
          <p className="description">Configure global settings</p>
        </div>
        {missingValuesError && (
          <Alert type="error" title="Not all fields contain values" />
        )}
        {cacheError && <Alert type="error" title={cacheError} />}
        {cacheClearedMsg && <Alert type="info" title={cacheClearedMsg} />}

        {isSuccess && (
          <Alert type="info" title="Settings successfully updated" />
        )}
        <div className="section">
          <form onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="name" className="text-label">
                Hostname
              </label>
              <div className="form-input">
                <div className="form-input-field">
                  <input
                    name="name"
                    id="name"
                    type="text"
                    ref={hostnameRef}
                    defaultValue={settings.applicationUrl}
                  ></input>
                </div>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="name" className="text-label">
                API key
              </label>
              <div className="form-input">
                <div className="form-input-field">
                  <input
                    name="name"
                    id="name"
                    type="text"
                    ref={apiKeyRef}
                    defaultValue={settings.apikey}
                  ></input>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      regenerateApi()
                    }}
                    className="input-action ml-3"
                  >
                    <RefreshIcon />
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row items-center">
              <label htmlFor="image_cache_enabled" className="text-label">
                Enable image cache
              </label>
              <div className="form-input flex flex-wrap items-center gap-4">
                <input
                  id="image_cache_enabled"
                  name="image_cache_enabled"
                  type="checkbox"
                  ref={cacheEnabledRef}
                  defaultChecked={settings.image_cache_enabled ?? true}
                  onChange={(e) => setCacheEnabled(e.target.checked)}
                />
                {cacheEnabled ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="image_cache_max_mb"
                        className="text-zinc-200"
                      >
                        Cache size (MB)
                      </label>
                      <input
                        className="h-9 w-28 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-sm text-white"
                        name="image_cache_max_mb"
                        id="image_cache_max_mb"
                        type="number"
                        min={100}
                        ref={cacheMaxRef}
                        defaultValue={settings.image_cache_max_mb ?? 200}
                      />
                    </div>
                    <div className="text-xs text-zinc-400">
                      Minimum 100 MB. Leave blank for default (200 MB).
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="actions mt-5 w-full">
              <div className="flex justify-end">
                <div className="flex w-full">
                  <div className="mr-auto flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                    <span className="flex rounded-md shadow-sm">
                      <DocsButton />
                    </span>
                    <button
                      type="button"
                      className="w-full rounded-md border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-200 hover:border-amber-500 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      onClick={clearImageCache}
                      disabled={clearingCache}
                    >
                      {clearingCache ? 'Clearing…' : 'Clear Image Cache'}
                    </button>
                  </div>
                  <span className="ml-auto flex rounded-md shadow-sm">
                    <Button
                      buttonType="primary"
                      type="submit"
                      disabled={isPending}
                    >
                      <SaveIcon />
                      <span>Save Changes</span>
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
export default MainSettings
