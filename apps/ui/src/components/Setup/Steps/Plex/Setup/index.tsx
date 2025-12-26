// PlexSetupWizard.tsx
import { SaveIcon } from '@heroicons/react/solid'
import axios from 'axios'
import { orderBy } from 'lodash-es'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  useDeletePlexAuth,
  usePatchSettings,
  useUpdatePlexAuth,
} from '../../../../../api/settings'
import GetApiHandler from '../../../../../utils/ApiHandler'
import Button from '../../../../Common/Button'
import { SmallLoadingSpinner } from '../../../../Common/LoadingSpinner'
import TestButton from '../../../../Common/TestButton'
import PlexLoginButton from '../../../../Login/Plex'

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type PlexSetupWizardProps = {
  settings: PlexSettingsSnapshot

  // Parent setup wizard uses this to know Plex has been completed (after Finish)
  onReadyChange?: (ready: boolean) => void
}

type MiniStep = {
  key: string
  title: string
  render: () => React.ReactNode
}

type PresetServerDisplay = {
  name: string
  ssl: boolean
  uri: string
  address: string
  port: number
  local: boolean
  status?: boolean
  message?: string
}

type PlexConnection = {
  protocol: string
  ssl: boolean
  uri: string
  address: string
  port: number
  local: boolean
  status: number
  message: string
}

export type PlexDevice = {
  name: string
  connection: PlexConnection[]
}

export type PlexSettingsSnapshot = {
  plex_name: string
  plex_hostname: string
  plex_port: number
  plex_ssl: number
  plex_auth_token: string | null
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

// Keep host as raw hostname/IP — protocol is controlled by ssl boolean
function stripProtocol(host: string) {
  return (host ?? '').replace('http://', '').replace('https://', '')
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function PlexSetupWizard({
  settings,
  onReadyChange,
}: PlexSetupWizardProps) {
  // Wizard step index:
  // 0 = Auth
  // 1 = Pick server + edit fields + test (combined)
  // 2 = Review & Finish (read-only)
  const [step, setStep] = useState(0)

  /* ----------------------- Shared connection state ------------------------ */
  // These are the connection details we’ll test (POST payload) and later save (Finish).
  const [plexName, setPlexName] = useState(settings?.plex_name ?? '')
  const [plexHost, setPlexHost] = useState(
    stripProtocol(settings?.plex_hostname ?? ''),
  )
  const [plexPort, setPlexPort] = useState(settings?.plex_port ?? 32400)
  const [plexSsl, setPlexSsl] = useState(Boolean(settings?.plex_ssl))

  /* -------------------------- Auth + discovery ---------------------------- */
  const [tokenValid, setTokenValid] = useState(false)

  // Server discovery payload from Plex API
  const [availableServers, setAvailableServers] = useState<PlexDevice[]>()

  // UI helper: show spinner while servers are being fetched
  const [isLoadingServers, setIsLoadingServers] = useState(false)

  /* ------------------------- Test / lock state ---------------------------- */
  // Once a test succeeds, we lock fields and allow moving to Review step.
  const [connectionLocked, setConnectionLocked] = useState(false)

  // Holds the Plex version string returned by the test (optional display)
  const [testedVersion, setTestedVersion] = useState<string>('')

  // Tracks selected server preset (so Continue is gated until a selection is made)
  const [selectedUri, setSelectedUri] = useState('')

  const { mutateAsync: updateSettings, isPending } = usePatchSettings()
  const { mutateAsync: updatePlexAuth } = useUpdatePlexAuth()
  const { mutateAsync: deletePlexAuth } = useDeletePlexAuth()

  /* ------------------------------------------------------------------------ */
  /*                               AUTH LOGIC                                 */
  /* ------------------------------------------------------------------------ */

  // Validates Plex token and auto-advances to the combined server step on success.
  const verifyToken = async (token: string) => {
    try {
      const response = await axios.get('https://plex.tv/api/v2/user', {
        headers: {
          'X-Plex-Product': 'Maintainerr',
          'X-Plex-Version': '2.0',
          'X-Plex-Client-Identifier': 'maintainerr-setup',
          'X-Plex-Token': token,
        },
      })

      if (response.status === 200) {
        setTokenValid(true)
        setStep(1) // Auto-advance after auth
      }
    } catch {
      setTokenValid(false)
      toast.error('Plex authentication failed')
    }
  }

  // Called by the Plex login button when we receive a token
  const onAuthSuccess = async (token: string) => {
    await updatePlexAuth(token)
    await verifyToken(token)
  }

  // Reset auth state and tell parent we are not ready anymore
  const onClearToken = async () => {
    await deletePlexAuth()

    setTokenValid(false)
    setAvailableServers(undefined)
    setIsLoadingServers(false)

    setConnectionLocked(false)
    setTestedVersion('')
    setSelectedUri('')

    setStep(0)
    onReadyChange?.(false)
  }

  /* ------------------------------------------------------------------------ */
  /*                           SERVER DISCOVERY                                */
  /* ------------------------------------------------------------------------ */

  // Fetch servers automatically when entering the combined server step
  useEffect(() => {
    if (step !== 1 || !tokenValid) return

    setIsLoadingServers(true)
    GetApiHandler<PlexDevice[]>('/settings/plex/devices/servers')
      .then((resp) => setAvailableServers(resp))
      .finally(() => setIsLoadingServers(false))
  }, [step, tokenValid])

  // Flatten Plex’s device/connection list into dropdown-friendly entries
  const availablePresets = useMemo(() => {
    const presets: PresetServerDisplay[] = []

    availableServers?.forEach((dev) =>
      dev.connection.forEach((conn) =>
        presets.push({
          name: dev.name,
          ssl: conn.protocol === 'https',
          uri: conn.uri,
          address: conn.address,
          port: conn.port,
          local: conn.local,
          // We intentionally DO NOT use status/message to label options as unreachable.
          // Those flags are often wrong depending on network perspective.
          status: conn.status === 200,
          message: conn.message,
        }),
      ),
    )

    // Still okay to sort, but we won’t show “unreachable”
    return orderBy(presets, ['local', 'ssl'], ['desc', 'desc'])
  }, [availableServers])

  const selectedPreset = selectedUri
    ? availablePresets.find((p) => p.uri === selectedUri)
    : undefined

  /* ------------------------------------------------------------------------ */
  /*                               SAVE LOGIC                                 */
  /* ------------------------------------------------------------------------ */

  // Finish button → save settings to DB → mark parent ready → advance to next main step
  const saveSettings = async () => {
    const payload: Partial<PlexSettingsSnapshot> = {
      plex_name: plexName,
      // Save as raw host with protocol applied only for legacy storage expectations.
      plex_hostname: plexSsl
        ? `https://${stripProtocol(plexHost)}`
        : stripProtocol(plexHost),
      plex_port: plexPort,
      plex_ssl: plexSsl ? 1 : 0,
    }

    await updateSettings(payload)
    toast.success('Plex configuration saved')

    onReadyChange?.(true)
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  /* ------------------------------------------------------------------------ */
  /*                                  STEPS                                   */
  /* ------------------------------------------------------------------------ */

  const steps: MiniStep[] = [
    {
      key: 'auth',
      title: 'Authenticate with Plex',
      render: () => (
        <AuthPanel
          tokenValid={tokenValid}
          onAuthSuccess={onAuthSuccess}
          onClearToken={onClearToken}
        />
      ),
    },

    {
      // Combined: server picker + editable fields + test
      key: 'connect',
      title: 'Connect to Plex',
      render: () => (
        <PlexConnectPanel
          isLoadingServers={isLoadingServers}
          availablePresets={availablePresets}
          selectedUri={selectedUri}
          setSelectedUri={(uri) => setSelectedUri(uri)}
          onPickPreset={(preset) => {
            // Selecting a server invalidates any previous test lock
            setConnectionLocked(false)
            setTestedVersion('')

            setPlexName(preset.name)
            setPlexHost(stripProtocol(preset.address))
            setPlexPort(preset.port)
            setPlexSsl(preset.ssl)
          }}
          connectionLocked={connectionLocked}
          plexName={plexName}
          plexHost={plexHost}
          plexPort={plexPort}
          plexSsl={plexSsl}
          onChange={(next) => {
            // Fields are only editable before a successful test
            if (connectionLocked) return

            // Any manual change invalidates previous test result
            setConnectionLocked(false)
            setTestedVersion('')

            if (next.plexName != null) setPlexName(next.plexName)
            if (next.plexHost != null) setPlexHost(next.plexHost)
            if (next.plexPort != null) setPlexPort(next.plexPort)
            if (typeof next.plexSsl === 'boolean') setPlexSsl(next.plexSsl)
          }}
          onTestSuccess={(version) => {
            setConnectionLocked(true)
            setTestedVersion(version)
          }}
          onContinue={() => setStep(2)}
        />
      ),
    },

    {
      // Review is read-only; Finish saves and advances parent wizard
      key: 'review',
      title: 'Review & Finish',
      render: () => (
        <SavePanel
          plexName={plexName}
          plexHost={plexHost}
          plexPort={plexPort}
          plexSsl={plexSsl}
          testedVersion={testedVersion}
          isPending={isPending}
          onSave={saveSettings}
        />
      ),
    },
  ]

  /* ------------------------------------------------------------------------ */
  /*                                   RENDER                                 */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="flex flex-col">
      <h3 className="mb-1 text-lg font-semibold text-zinc-100">
        {steps[step].title}
      </h3>
      <p className="mb-4 text-sm text-zinc-400">
        Plex setup {step + 1} of {steps.length}
      </p>

      <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/30 p-4">
        {steps[step].render()}
      </div>

      {/* Back button only — forward navigation is handled inside the Plex mini-steps */}
      <div className="mt-4 flex justify-start">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-100 disabled:opacity-40"
        >
          Back
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  PANELS                                    */
/* -------------------------------------------------------------------------- */

function AuthPanel({
  tokenValid,
  onAuthSuccess,
  onClearToken,
}: {
  tokenValid: boolean
  onAuthSuccess: (token: string) => void
  onClearToken: () => Promise<void>
}) {
  return (
    <div>
      {!tokenValid ? (
        <PlexLoginButton onAuthToken={onAuthSuccess} />
      ) : (
        <Button onClick={onClearToken}>Clear Token</Button>
      )}
    </div>
  )
}

function PlexConnectPanel({
  isLoadingServers,
  availablePresets,
  selectedUri,
  setSelectedUri,
  onPickPreset,
  connectionLocked,
  plexName,
  plexHost,
  plexPort,
  plexSsl,
  onChange,
  onTestSuccess,
  onContinue,
}: {
  isLoadingServers: boolean
  availablePresets: PresetServerDisplay[]
  selectedUri: string
  setSelectedUri: (uri: string) => void
  onPickPreset: (preset: PresetServerDisplay) => void

  connectionLocked: boolean
  plexName: string
  plexHost: string
  plexPort: number
  plexSsl: boolean
  onChange: (next: {
    plexName?: string
    plexHost?: string
    plexPort?: number
    plexSsl?: boolean
  }) => void

  onTestSuccess: (version: string) => void
  onContinue: () => void
}) {
  const selectedPreset = selectedUri
    ? availablePresets.find((p) => p.uri === selectedUri)
    : undefined

  const baseUrlPreview = `${plexSsl ? 'https' : 'http'}://${plexHost}:${plexPort}`

  return (
    <div className="space-y-4">
      {/* Server dropdown stays enabled. It starts empty and fills when servers arrive. */}
      <div className="flex items-center gap-2">
        <select
          className="input flex-1"
          value={selectedUri}
          onChange={(e) => {
            const uri = e.target.value
            setSelectedUri(uri)

            const preset = availablePresets.find((p) => p.uri === uri)
            if (preset) onPickPreset(preset)
          }}
        >
          <option value="">
            {isLoadingServers
              ? 'Loading servers…'
              : availablePresets.length
                ? 'Select server'
                : 'No servers found'}
          </option>

          {availablePresets.map((p) => {
            const protocol = p.ssl ? 'https' : 'http'
            const locality = p.local ? 'local' : 'remote'
            return (
              <option key={p.uri} value={p.uri}>
                {`${p.name} — ${protocol}://${p.address}:${p.port} (${locality})`}
              </option>
            )
          })}
        </select>

        {isLoadingServers ? (
          <div className="flex h-10 items-center">
            <SmallLoadingSpinner />
          </div>
        ) : null}
      </div>

      {/* Connection fields (editable only before successful test) */}
      <div className="space-y-2">
        <label className="block text-sm text-zinc-200">Server Name</label>
        <input
          className="input w-3/4 rounded-lg bg-zinc-700 text-white"
          disabled={connectionLocked}
          value={plexName}
          onChange={(e) => onChange({ plexName: e.target.value })}
        />

        <label className="block text-sm text-zinc-200">Host</label>
        <input
          className="input w-3/4 rounded-lg bg-zinc-700 text-white"
          disabled={connectionLocked}
          value={plexHost}
          onChange={(e) =>
            onChange({ plexHost: stripProtocol(e.target.value) })
          }
        />

        <label className="block text-sm text-zinc-200">Port</label>
        <input
          className="input w-3/4 rounded-lg bg-zinc-700 text-white"
          disabled={connectionLocked}
          value={plexPort}
          onChange={(e) => onChange({ plexPort: Number(e.target.value) })}
        />
      </div>

      {/* Test uses the current on-screen values via POST payload */}
      <div className="flex items-center justify-start">
        <TestButton
          testUrl="/settings/test/plex"
          payload={{
            hostname: plexHost,
            port: plexPort,
            ssl: plexSsl,
          }}
          onTestComplete={(r) => {
            if (r.status) onTestSuccess(r.message)
          }}
        />
        {/* Keep Continue gated until successful test (locked = true) */}
        <Button
          className="ml-3"
          onClick={onContinue}
          disabled={!connectionLocked}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

function SavePanel({
  plexName,
  plexHost,
  plexPort,
  plexSsl,
  testedVersion,
  isPending,
  onSave,
}: {
  plexName: string
  plexHost: string
  plexPort: number
  plexSsl: boolean
  testedVersion: string
  isPending: boolean
  onSave: () => Promise<void>
}) {
  const baseUrlPreview = `${plexSsl ? 'https' : 'http'}://${plexHost}:${plexPort}`

  return (
    <div className="space-y-3">
      {/* Read-only review summary */}
      <div className="rounded border border-zinc-700 bg-zinc-900/40 p-3 text-sm text-zinc-300">
        <div className="font-semibold text-zinc-100">{plexName}</div>
        <div>{baseUrlPreview}</div>
        {testedVersion ? (
          <div className="mt-1 text-xs text-zinc-400">
            Tested OK (Plex {testedVersion})
          </div>
        ) : null}
      </div>

      <Button disabled={isPending} onClick={onSave}>
        <SaveIcon className="h-5 w-5" />
        Finish
      </Button>
    </div>
  )
}
