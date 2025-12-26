import PlexSetupWizard from './Setup'
type PlexStepProps = {
  settings: any
  onReadyChange?: (ready: boolean) => void
}

export default function PlexStep({ settings, onReadyChange }: PlexStepProps) {
  return (
    <div className="min-h-0">
      <PlexSetupWizard settings={settings} onReadyChange={onReadyChange} />
    </div>
  )
}
