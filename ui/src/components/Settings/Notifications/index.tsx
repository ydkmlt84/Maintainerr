import { SaveIcon } from '@heroicons/react/solid'
import {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import SettingsContext from '../../../contexts/settings-context'
import { PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Button from '../../Common/Button'
import DocsButton from '../../Common/DocsButton'
import TestButton from '../../Common/TestButton'
import {
  addPortToUrl,
  getPortFromUrl,
  handleSettingsInputChange,
  removePortFromUrl,
} from '../../../utils/SettingsUtils'

const NotificationsSettings = () => {
  const settingsCtx = useContext(SettingsContext)
  const nameRef = useRef<HTMLInputElement>(null)
  const webhookRef = useRef<HTMLInputElement>(null)
  const [webhook, setwebhookURL] = useState<string>()
  const [name, setName] = useState<string>()
  const [error, setError] = useState<boolean>()
  const [changed, setChanged] = useState<boolean>()
  const [testBanner, setTestbanner] = useState<{
    status: Boolean
    version: string
  }>({ status: false, version: '0' })

  useEffect(() => {
    document.title = 'Maintainerr - Settings - Notifications'
  }, [])

  useEffect(() => {
    // Notification name for Multiple Webhooks
    setName(settingsCtx.settings.webhook_name)

    // @ts-ignore
    nameRef.current = {
      value: (settingsCtx.settings.webhook_name),
    }

    // Webhook URL
    setwebhookURL(settingsCtx.settings.webhook_url)
    // @ts-ignore
    webhookRef.current = {
      value: (settingsCtx.settings.webhook_url),
    }
  }, [settingsCtx])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

  }
  const appTest = (result: { status: boolean; version: string }) => {
    setTestbanner({ status: result.status, version: result.version })
  }

  return (
    <div className="h-full w-full">
      <div className="section h-full w-full">
        <h3 className="heading">Notification Settings</h3>
        <p className="description">Discord configuration</p>
      </div>
      {error ? (
        <Alert type="warning" title="Not all fields contain values" />
      ) : changed ? (
        <Alert type="info" title="Settings successfully updated" />
      ) : undefined}

      {testBanner.version !== '0' ? (
        testBanner.status ? (
          <Alert
            type="warning"
            title={`successfully connected to Discord (${testBanner.version})`}
          />
        ) : (
          <Alert
            type="error"
            title="Notification failed! Please check and save your settings"
          />
        )
      ) : undefined}

      <div className="section">
        <form onSubmit={submit}>
          <div className="form-row">
            <label htmlFor="hostname" className="text-label">
              Notification Name
            </label>
            <div className="form-input">
              <div className="form-input-field">
                <input
                  name="hostname"
                  id="hostname"
                  type="text"
                  defaultValue={name}
                  ref={nameRef}
                  value={nameRef.current?.value}
                  onChange={(e) =>
                    handleSettingsInputChange(e, nameRef, setName)
                  }
                ></input>
              </div>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="port" className="text-label">
              Webhook URL
            </label>
            <div className="form-input">
              <div className="form-input-field">
                <input
                  name="url"
                  id="url"
                  type="text"
                  ref={webhookRef}
                  value={webhookRef.current?.value}
                  defaultValue={webhook}
                  onChange={(e) => handleSettingsInputChange(e, webhookRef, setwebhookURL)}
                ></input>
              </div>
            </div>
          </div>

          <div className="actions mt-5 w-full">
            <div className="flex w-full flex-wrap sm:flex-nowrap">
              <span className="m-auto rounded-md shadow-sm sm:mr-auto sm:ml-3">
                <DocsButton page="Configuration" />
              </span>
              <div className="m-auto flex sm:m-0 sm:justify-end mt-3 xs:mt-0">
                <TestButton
                  onClick={appTest}
                  testUrl="/settings/test/overseerr"
                />
                <span className="ml-3 inline-flex rounded-md shadow-sm">
                  <Button
                    buttonType="primary"
                    type="submit"
                  // disabled={isSubmitting || !isValid}
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
  )
}

export default NotificationsSettings