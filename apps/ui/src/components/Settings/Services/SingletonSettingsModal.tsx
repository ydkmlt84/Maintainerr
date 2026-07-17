import {
  BasicResponseDto,
  SeerrSetting,
  TautulliSetting,
} from '@maintainerr/contracts'
import { useMemo, useState } from 'react'
import { PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Modal from '../../Common/Modal'

export type SingletonServiceType = 'seerr' | 'tautulli'

interface SingletonSettingsModalProps {
  service: SingletonServiceType
  settings?: SeerrSetting | TautulliSetting
  onCancel: () => void
  onUpdate: (settings: SeerrSetting | TautulliSetting) => void
}

const serviceNames: Record<SingletonServiceType, string> = {
  seerr: 'Seerr',
  tautulli: 'Tautulli',
}

const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '')

const SingletonSettingsModal = ({
  service,
  settings,
  onCancel,
  onUpdate,
}: SingletonSettingsModalProps) => {
  const [url, setUrl] = useState(settings?.url ?? '')
  const [apiKey, setApiKey] = useState(settings?.api_key ?? '')
  const [testedFingerprint, setTestedFingerprint] = useState<string>()
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'info' | 'error'
    text: string
  }>()

  const name = serviceNames[service]
  const normalizedUrl = normalizeUrl(url)
  const fingerprint = `${normalizedUrl}\n${apiKey}`
  const originalFingerprint = `${normalizeUrl(settings?.url ?? '')}\n${
    settings?.api_key ?? ''
  }`
  const isValid = Boolean(normalizedUrl && apiKey)
  const requiresTest = fingerprint !== originalFingerprint
  const canSave =
    isValid && (!requiresTest || testedFingerprint === fingerprint) && !saving

  const placeholder = useMemo(
    () =>
      service === 'seerr' ? 'http://localhost:5055' : 'http://localhost:8181',
    [service],
  )

  const performTest = async () => {
    if (!isValid || testing) return

    setTesting(true)
    setMessage(undefined)
    try {
      const response = await PostApiHandler<BasicResponseDto>(
        `/settings/test/${service}`,
        { url: normalizedUrl, api_key: apiKey },
      )
      if (response.code === 1) {
        setTestedFingerprint(fingerprint)
        setMessage({
          type: 'info',
          text: `Successfully connected to ${name} (${response.message})`,
        })
      } else {
        setMessage({
          type: 'error',
          text: response.message || `Failed to connect to ${name}`,
        })
      }
    } catch {
      setMessage({ type: 'error', text: `Failed to connect to ${name}` })
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    if (!canSave) return

    setSaving(true)
    setMessage(undefined)
    const payload = { url: normalizedUrl, api_key: apiKey }
    try {
      const response = await PostApiHandler<BasicResponseDto>(
        `/settings/${service}`,
        payload,
      )
      if (response.code === 1) {
        onUpdate(payload)
      } else {
        setMessage({
          type: 'error',
          text: response.message || `Failed to save ${name}`,
        })
      }
    } catch {
      setMessage({ type: 'error', text: `Failed to save ${name}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`${name} Settings`}
      size="lg"
      backgroundClickable={false}
      onCancel={onCancel}
      onOk={save}
      okText={saving ? 'Saving...' : 'Save Changes'}
      okDisabled={!canSave}
      onSecondary={performTest}
      secondaryText={testing ? 'Testing...' : 'Test'}
      secondaryButtonType="success"
      secondaryDisabled={!isValid || testing}
    >
      {message && <Alert type={message.type} title={message.text} />}

      <div className="form-row">
        <label htmlFor={`${service}-url`} className="text-label">
          URL
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <input
              id={`${service}-url`}
              type="text"
              value={url}
              placeholder={placeholder}
              onChange={(event) => {
                setUrl(event.target.value)
                setMessage(undefined)
              }}
            />
          </div>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor={`${service}-api-key`} className="text-label">
          API key
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <input
              id={`${service}-api-key`}
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value)
                setMessage(undefined)
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SingletonSettingsModal
