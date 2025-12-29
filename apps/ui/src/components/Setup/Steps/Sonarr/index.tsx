import SonarrSettings from '../../../Settings/Sonarr'
import ServiceStepLayout from '../ServiceStepLayout'

type SonarrSetupStepProps = {
  onSkip?: () => void
}

export default function SonarrSetupStep({ onSkip }: SonarrSetupStepProps) {
  return (
    <ServiceStepLayout
      title="Sonarr"
      description="Connect Sonarr now or skip this step and return later from Settings."
      onSkip={onSkip}
    >
      <SonarrSettings />
    </ServiceStepLayout>
  )
}
