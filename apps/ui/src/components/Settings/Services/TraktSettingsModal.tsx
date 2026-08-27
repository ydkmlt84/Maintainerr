import {
  TraktApplicationConfig,
  TraktDeviceAuthStatus,
  TraktDeviceCode,
  TraktStatus,
} from '@maintainerr/contracts'
import { useEffect, useState } from 'react'
import { DeleteApiHandler, PostApiHandler } from '../../../utils/ApiHandler'
import Alert from '../../Common/Alert'
import Modal from '../../Common/Modal'

interface TraktSettingsModalProps {
  settings: TraktStatus
  onCancel: () => void
  onUpdate: (settings: TraktStatus) => void
}

const TraktSettingsModal = ({
  settings,
  onCancel,
  onUpdate,
}: TraktSettingsModalProps) => {
  const [status, setStatus] = useState(settings)
  const [clientId, setClientId] = useState(settings.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [deviceCode, setDeviceCode] = useState<TraktDeviceCode>()
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState<{
    type: 'info' | 'error'
    text: string
  }>()

  useEffect(() => {
    if (!deviceCode) return

    let active = true
    const expiresAt = Date.now() + deviceCode.expiresIn * 1000
    let timeout: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (!active) return
      if (Date.now() >= expiresAt) {
        setDeviceCode(undefined)
        setConnecting(false)
        setMessage({ type: 'error', text: 'The Trakt code expired.' })
        return
      }

      try {
        const response = await PostApiHandler<TraktDeviceAuthStatus>(
          '/trakt/oauth/device/poll',
          { deviceCode: deviceCode.deviceCode },
        )
        if (!active) return
        if (response.status === 'connected') {
          const updated: TraktStatus = {
            ...status,
            configured: true,
            connected: true,
            username: response.username,
          }
          setStatus(updated)
          setDeviceCode(undefined)
          setConnecting(false)
          setMessage({
            type: 'info',
            text: `Connected to Trakt${response.username ? ` as ${response.username}` : ''}.`,
          })
          onUpdate(updated)
          return
        }
        if (response.status === 'expired' || response.status === 'denied') {
          setDeviceCode(undefined)
          setConnecting(false)
          setMessage({
            type: 'error',
            text:
              response.status === 'denied'
                ? 'Trakt authorization was denied.'
                : 'The Trakt code expired.',
          })
          return
        }
      } catch {
        if (!active) return
        setDeviceCode(undefined)
        setConnecting(false)
        setMessage({
          type: 'error',
          text: 'Could not complete Trakt authorization.',
        })
        return
      }

      timeout = setTimeout(poll, Math.max(deviceCode.interval, 5) * 1000)
    }

    timeout = setTimeout(poll, Math.max(deviceCode.interval, 5) * 1000)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [deviceCode, onUpdate, status])

  const save = async () => {
    if (!clientId.trim() || (!clientSecret && !status.clientSecretConfigured)) {
      return
    }
    setSaving(true)
    setMessage(undefined)
    try {
      const payload: TraktApplicationConfig = {
        clientId: clientId.trim(),
        ...(clientSecret ? { clientSecret } : {}),
      }
      const updated = await PostApiHandler<TraktStatus>(
        '/trakt/configuration',
        payload,
      )
      setStatus(updated)
      setClientSecret('')
      setMessage({
        type: 'info',
        text: updated.connected
          ? 'Trakt application settings saved.'
          : 'Settings saved. You can now connect your Trakt account.',
      })
      onUpdate(updated)
    } catch {
      setMessage({
        type: 'error',
        text: 'Could not save the Trakt application settings.',
      })
    } finally {
      setSaving(false)
    }
  }

  const connect = async () => {
    setConnecting(true)
    setMessage(undefined)
    try {
      const code = await PostApiHandler<TraktDeviceCode>(
        '/trakt/oauth/device',
        {},
      )
      setDeviceCode(code)
    } catch {
      setConnecting(false)
      setMessage({
        type: 'error',
        text: 'Could not start Trakt authorization.',
      })
    }
  }

  const disconnect = async () => {
    try {
      const updated = await DeleteApiHandler<TraktStatus>('/trakt/oauth')
      setStatus(updated)
      setDeviceCode(undefined)
      setMessage({ type: 'info', text: 'Trakt account disconnected.' })
      onUpdate(updated)
    } catch {
      setMessage({ type: 'error', text: 'Could not disconnect Trakt.' })
    }
  }

  const canSave =
    Boolean(clientId.trim()) &&
    Boolean(clientSecret || status.clientSecretConfigured) &&
    !saving

  return (
    <Modal
      title="Trakt Settings"
      size="lg"
      onCancel={onCancel}
      hideCancelButton
      onOk={() => void save()}
      okText={saving ? 'Saving...' : 'Save Application'}
      okDisabled={!canSave}
      onSecondary={status.configured && !status.connected ? connect : undefined}
      secondaryText={connecting ? 'Waiting for Trakt...' : 'Connect Trakt'}
      secondaryButtonType="success"
      secondaryDisabled={connecting}
      onTertiary={status.connected ? disconnect : undefined}
      tertiaryText="Disconnect Account"
      tertiaryButtonType="danger"
    >
      {message && <Alert type={message.type} title={message.text} />}

      <Alert type="info" title="Trakt OAuth application">
        <p>
          Create an application in Trakt, then enter its client ID and secret
          here. Use{' '}
          <code className="rounded bg-zinc-900 px-1 py-0.5">
            urn:ietf:wg:oauth:2.0:oob
          </code>{' '}
          as its redirect URI.
        </p>
        <p className="mt-2">
          Your Trakt username and password are entered only on Trakt and are
          never shared with Maintainerr.{' '}
          <a
            href="https://app.trakt.tv/settings/apps"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-maintainerr-400 hover:text-maintainerr-300"
          >
            Create a Trakt application
          </a>
        </p>
      </Alert>

      <div className="form-row">
        <label htmlFor="trakt-client-id" className="text-label">
          Client ID
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <input
              id="trakt-client-id"
              type="text"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="trakt-client-secret" className="text-label">
          Client secret
        </label>
        <div className="form-input">
          <div className="form-input-field">
            <input
              id="trakt-client-secret"
              type="password"
              value={clientSecret}
              placeholder={
                status.clientSecretConfigured
                  ? 'Leave blank to keep the current secret'
                  : undefined
              }
              onChange={(event) => setClientSecret(event.target.value)}
            />
          </div>
        </div>
      </div>

      {status.connected && (
        <div className="mt-4 rounded-lg bg-zinc-800 p-4 ring-1 ring-zinc-600">
          <p className="font-semibold text-white">Trakt connected</p>
          {status.username && (
            <p className="mt-1 text-zinc-400">Signed in as {status.username}</p>
          )}
        </div>
      )}

      {deviceCode && (
        <div className="mt-4 rounded-lg bg-zinc-900 p-5 text-center ring-1 ring-maintainerr-600/60">
          <p className="text-sm text-zinc-400">
            Open Trakt and enter this code:
          </p>
          <p className="my-3 font-mono text-3xl font-bold tracking-[0.2em] text-white">
            {deviceCode.userCode}
          </p>
          <a
            href={deviceCode.verificationUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-maintainerr-400 hover:text-maintainerr-300"
          >
            {deviceCode.verificationUrl}
          </a>
          <p className="mt-3 text-xs text-zinc-500">
            Maintainerr will detect authorization automatically.
          </p>
        </div>
      )}
    </Modal>
  )
}

export default TraktSettingsModal
