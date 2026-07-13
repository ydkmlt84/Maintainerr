import { SaveIcon, TrashIcon } from '@heroicons/react/solid'
import { isValidCron } from 'cron-validator'
import { useRef, useState } from 'react'
import { useSettingsOutletContext } from '..'
import { usePatchSettings } from '../../../api/settings'
import { PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'

const JobSettings = () => {
  const rulehanderRef = useRef<HTMLInputElement>(null)
  const collectionHandlerRef = useRef<HTMLInputElement>(null)
  const [secondCronValid, setSecondCronValid] = useState(true)
  const [firstCronValid, setFirstCronValid] = useState(true)
  const [missingValuesError, setMissingValuesError] = useState<boolean>(false)
  const [cleanupPending, setCleanupPending] = useState(false)
  const [cleanupError, setCleanupError] = useState(false)
  const [cleanupRemovedCount, setCleanupRemovedCount] = useState<
    number | undefined
  >()
  const {
    mutateAsync: updateSettings,
    isError: updateSettingsError,
    isPending: updateSettingsPending,
    isSuccess: updateSettingsSuccess,
  } = usePatchSettings()
  const { settings } = useSettingsOutletContext()

  const cleanupStaleMedia = async () => {
    setCleanupPending(true)
    setCleanupError(false)
    setCleanupRemovedCount(undefined)

    try {
      const result = await PostApiHandler<{ removedCount: number }>(
        '/collections/maintenance/stale-media',
        {},
      )
      setCleanupRemovedCount(result.removedCount)
    } catch {
      setCleanupError(true)
    } finally {
      setCleanupPending(false)
    }
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMissingValuesError(false)

    if (
      rulehanderRef.current?.value &&
      collectionHandlerRef.current?.value &&
      isValidCron(rulehanderRef.current.value) &&
      isValidCron(collectionHandlerRef.current.value)
    ) {
      const payload = {
        collection_handler_job_cron: collectionHandlerRef.current.value,
        rules_handler_job_cron: rulehanderRef.current.value,
      }

      await updateSettings(payload)
    } else {
      setMissingValuesError(true)
    }
  }

  return (
    <>
      <title>Job settings - Maintainerr</title>
      <div className="h-full w-full">
        <div className="section h-full w-full">
          <h3 className="heading">Job Settings</h3>
          <p className="description">Job configuration</p>
        </div>

        {missingValuesError && (
          <Alert type="error" title="Please make sure all values are valid" />
        )}

        {updateSettingsError && (
          <Alert
            type="error"
            title="Something went wrong, please check your values"
          />
        )}

        {updateSettingsSuccess && (
          <Alert type="info" title="Settings successfully updated" />
        )}

        <div className="section">
          <form onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="ruleHandler" className="text-label">
                Rule Handler
                <p className="text-xs font-normal">
                  Supports all standard{' '}
                  <a
                    href="http://crontab.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    cron
                  </a>{' '}
                  patterns. Can be overridden by individual rule groups.
                </p>
              </label>
              <div className="form-input">
                <div
                  className={`form-input-field' ${
                    !firstCronValid ? 'border-2 border-red-700' : ''
                  }`}
                >
                  <input
                    name="ruleHandler"
                    id="ruleHandler"
                    type="text"
                    onChange={() => {
                      setFirstCronValid(
                        rulehanderRef.current?.value
                          ? isValidCron(rulehanderRef.current.value)
                          : false,
                      )
                    }}
                    ref={rulehanderRef}
                    defaultValue={settings.rules_handler_job_cron}
                  ></input>
                </div>
              </div>
            </div>

            <div className="form-row">
              <label htmlFor="collectionHanlder" className="text-label">
                Collection Handler
                <p className="text-xs font-normal">
                  Supports all standard{' '}
                  <a
                    href="http://crontab.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    cron
                  </a>{' '}
                  patterns
                </p>
              </label>

              <div className="form-input">
                <div
                  className={`form-input-field' ${
                    !secondCronValid ? 'border-2 border-red-700' : ''
                  }`}
                >
                  <input
                    name="collectionHanlder"
                    id="collectionHanlder"
                    type="text"
                    onChange={() => {
                      setSecondCronValid(
                        collectionHandlerRef.current?.value
                          ? isValidCron(collectionHandlerRef.current.value)
                          : false,
                      )
                    }}
                    ref={collectionHandlerRef}
                    defaultValue={settings.collection_handler_job_cron}
                  ></input>
                </div>
              </div>
            </div>

            <div className="actions mt-5 w-full">
              <div className="flex justify-end">
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="primary"
                    type="submit"
                    disabled={updateSettingsPending}
                  >
                    <SaveIcon />
                    <span>Save Changes</span>
                  </Button>
                </span>
              </div>
            </div>
          </form>
        </div>

        <div className="section">
          <h3 className="heading">Maintenance</h3>

          {cleanupError ? (
            <Alert
              type="error"
              title="Cleanup failed. Verify the media server connection."
            />
          ) : undefined}

          {cleanupRemovedCount !== undefined ? (
            <Alert
              type="info"
              title={
                cleanupRemovedCount === 0
                  ? 'No stale media entries found.'
                  : `Removed ${cleanupRemovedCount} stale media ${
                      cleanupRemovedCount === 1 ? 'entry' : 'entries'
                    }.`
              }
            />
          ) : undefined}

          <div className="form-row">
            <label className="text-label">Stale Media</label>
            <div className="form-input flex justify-end">
              <Button
                buttonType="warning"
                type="button"
                disabled={cleanupPending}
                onClick={() => void cleanupStaleMedia()}
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                <span>
                  {cleanupPending ? 'Cleaning...' : 'Clean Stale Media'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default JobSettings
