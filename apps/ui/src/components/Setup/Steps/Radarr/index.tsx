import RadarrSettings from '../../../Settings/Radarr'
import ServiceStepLayout from '../ServiceStepLayout'

type RadarrSetupStepProps = {
  onSkip?: () => void
}

export default function RadarrSetupStep({ onSkip }: RadarrSetupStepProps) {
  return (
    <ServiceStepLayout
      title="Radarr"
      description="Add your Radarr servers or skip for now and configure them later in Settings."
      onSkip={onSkip}
    >
      <RadarrSettings />
    </ServiceStepLayout>
  )
}
