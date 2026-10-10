import { ArrowPathIcon, ArrowDownOnSquareIcon } from '@heroicons/react/20/solid'
import React, { useRef, useState } from 'react'
import { useSettingsOutletContext } from '..'
import { useImageCacheUsage, usePatchSettings } from '../../../api/settings'
import GetApiHandler from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import DocsButton from '../../Common/DocsButton'
import MediaServerSelector from '../MediaServerSelector'

const formatCacheSize = (bytes: number) => {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 0.1 ? `${gb.toFixed(1)} GB` : `${Math.round(gb * 1024)} MB`
}

const MainSettings = () => {
  const hostnameRef = useRef<HTMLInputElement>(null)
  const apiKeyRef = useRef<HTMLInputElement>(null)
  const imageCacheMaxGbRef = useRef<HTMLInputElement>(null)
  const [missingValuesError, setMissingValuesError] = useState<boolean>()
  const [imageCacheLimitError, setImageCacheLimitError] = useState(false)
  const { settings } = useSettingsOutletContext()
  const imageCacheUsage = useImageCacheUsage()
  const {
    mutateAsync: updateSettings,
    isSuccess,
    isPending,
  } = usePatchSettings()

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMissingValuesError(false)
    setImageCacheLimitError(false)
    const imageCacheMaxGb = Number(imageCacheMaxGbRef.current?.value)
    if (
      !Number.isFinite(imageCacheMaxGb) ||
      imageCacheMaxGb < 1 ||
      imageCacheMaxGb > 1000
    ) {
      setImageCacheLimitError(true)
      return
    }
    if (hostnameRef.current?.value && apiKeyRef.current?.value) {
      const payload = {
        applicationUrl: hostnameRef.current.value,
        apikey: apiKeyRef.current.value,
        image_cache_max_gb: Math.round(imageCacheMaxGb),
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

        {imageCacheLimitError && (
          <Alert
            type="error"
            title="Enter an image cache limit between 1 and 1000 GB."
          />
        )}

        {isSuccess && (
          <Alert type="info" title="Settings successfully updated" />
        )}

        <div className="section">
          <form onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="hostname" className="text-label">
                Hostname
              </label>
              <div className="form-input">
                <div className="form-input-field">
                  <input
                    name="hostname"
                    id="hostname"
                    type="text"
                    ref={hostnameRef}
                    defaultValue={settings.applicationUrl}
                  ></input>
                </div>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="api-key" className="text-label">
                API key
              </label>
              <div className="form-input">
                <div className="form-input-field">
                  <input
                    className="!rounded-r-none"
                    name="api-key"
                    id="api-key"
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
                    <ArrowPathIcon />
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="imageCacheMaxGb" className="text-label">
                Image Cache Limit
              </label>
              <div className="form-input flex items-center gap-2">
                <div className="form-input-field w-28 flex-none">
                  <input
                    key={settings.image_cache_max_gb ?? 10}
                    id="imageCacheMaxGb"
                    name="imageCacheMaxGb"
                    type="number"
                    ref={imageCacheMaxGbRef}
                    min={1}
                    max={1000}
                    step={1}
                    defaultValue={settings.image_cache_max_gb ?? 10}
                  />
                </div>
                <span className="text-sm text-zinc-400">GB</span>
                {imageCacheUsage.data ? (
                  <div className="ml-2 min-w-32 max-w-xs flex-1">
                    <div className="mb-1 flex justify-between gap-3 text-xs text-zinc-400">
                      <span>
                        {formatCacheSize(imageCacheUsage.data.usedBytes)} used
                      </span>
                      <span>
                        {Math.min(100, imageCacheUsage.data.percentage).toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          imageCacheUsage.data.percentage >= 95
                            ? 'bg-red-500'
                            : imageCacheUsage.data.percentage >= 75
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(100, imageCacheUsage.data.percentage)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : imageCacheUsage.isLoading ? (
                  <div className="ml-2 h-2 min-w-32 max-w-xs flex-1 animate-pulse rounded-full bg-zinc-700" />
                ) : (
                  <span className="ml-2 text-xs text-zinc-500">
                    Cache usage unavailable
                  </span>
                )}
              </div>
            </div>
            <div className="actions mt-5 w-full">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex rounded-md shadow-sm">
                    <DocsButton />
                  </span>
                </div>
                <span className="flex rounded-md shadow-sm sm:ml-auto">
                  <Button
                    buttonType="primary"
                    type="submit"
                    disabled={isPending}
                  >
                    <ArrowDownOnSquareIcon />
                    <span>Save Changes</span>
                  </Button>
                </span>
              </div>
            </div>
          </form>
        </div>

        {/* Media Server Selector */}
        <MediaServerSelector currentType={settings.media_server_type ?? null} />
      </div>
    </>
  )
}
export default MainSettings
