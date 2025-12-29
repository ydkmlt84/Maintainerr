import { useState } from 'react'
import JellyseerrSettings from '../../../Settings/Jellyseerr'
import OverseerrSettings from '../../../Settings/Overseerr'
import ServiceStepLayout from '../ServiceStepLayout'

type SeerrSetupStepProps = {
  onSkip?: () => void
}

type SeerrApp = 'overseerr' | 'jellyseerr'

const SEERR_OPTIONS: { key: SeerrApp; label: string; description: string }[] =
  [
    {
      key: 'overseerr',
      label: 'Overseerr',
      description: 'Classic request manager for Plex.',
    },
    {
      key: 'jellyseerr',
      label: 'Jellyseerr',
      description: 'Fork with Jellyfin/Emby support.',
    },
  ]

export default function SeerrSetupStep({ onSkip }: SeerrSetupStepProps) {
  const [activeApp, setActiveApp] = useState<SeerrApp>('overseerr')
  const ActiveComponent =
    activeApp === 'overseerr' ? OverseerrSettings : JellyseerrSettings

  return (
    <ServiceStepLayout
      title="Seerr"
      description="Pick the request manager you use and configure it here, or skip and finish later."
      onSkip={onSkip}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SEERR_OPTIONS.map((option) => {
          const isActive = activeApp === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveApp(option.key)}
              className={`rounded px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-amber-600 text-zinc-900'
                  : 'border border-zinc-600 text-zinc-100 hover:bg-zinc-700'
              }`}
            >
              <div className="font-semibold">{option.label}</div>
              <div className="text-left text-[11px] text-zinc-300">
                {option.description}
              </div>
            </button>
          )
        })}
      </div>

      <ActiveComponent />
    </ServiceStepLayout>
  )
}
