import TautulliSettings from '../../../Settings/Tautulli'
import ServiceStepLayout from '../ServiceStepLayout'

type TautulliSetupStepProps = {
  onSkip?: () => void
}

export default function TautulliSetupStep({ onSkip }: TautulliSetupStepProps) {
  return (
    <ServiceStepLayout
      title="Tautulli"
      description="Connect to Tautulli now or skip and finish it later from Settings."
      onSkip={onSkip}
    >
      <TautulliSettings />
    </ServiceStepLayout>
  )
}
