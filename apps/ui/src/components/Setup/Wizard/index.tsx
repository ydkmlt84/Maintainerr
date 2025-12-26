import { useEffect, useMemo, useState } from 'react'
import CompleteStep from '../Steps/Complete'
import PlexStep from '../Steps/Plex'
import WelcomeStep from '../Steps/Welcome'
import WizardNav from './setupNav'

type SetupWizardProps = {
  basePath: string
  settings: any
  onDone: () => void
}

type WizardStep = {
  key: string
  render: () => React.ReactNode
  canNext?: () => boolean
  nextLabel?: string
}

export default function SetupWizard({
  basePath,
  settings,
  onDone,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [plexReady, setPlexReady] = useState(false)

  // If you later add step validity, store it here (or in a small store)
  // Example: const [plexValid, setPlexValid] = useState(false)

  const steps: WizardStep[] = useMemo(
    () => [
      {
        key: 'welcome',
        render: () => <WelcomeStep />,
      },
      {
        key: 'plex',
        render: () => <PlexStep settings={settings} onReadyChange={setPlexReady} />,
        canNext: () => plexReady,
      },
      {
        key: 'complete',
        render: () => <CompleteStep />,
        nextLabel: 'Finish',
      },
    ],
    [settings, plexReady],
  )

  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps - 1

  const canGoBack = currentStep > 0
  const canGoNext = steps[currentStep]?.canNext
    ? steps[currentStep].canNext!()
    : true

  useEffect(() => {
    if (!plexReady) return
    if (steps[currentStep]?.key !== 'plex') return

    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))
  }, [currentStep, plexReady, steps, totalSteps])

  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0))

  const goNext = () => {
    if (isLastStep) {
      onDone()
      return
    }
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1))
  }

  const activeStep = steps[currentStep]
  const isPlexStep = steps[currentStep].key === 'plex'

  return (
    <div className="flex min-h-screen min-w-0 items-center justify-center bg-zinc-900 px-4 py-10">
      <div className="w-full max-w-3xl rounded-xl bg-zinc-800 p-4">
        <div className="flex flex-col">
          <div className="flex items-center justify-center p-4">
            <img
              style={{ width: '300px', height: 'auto' }}
              src={`${basePath}/logo.svg`}
              alt="Maintainerr"
            />
          </div>
          <WizardNav
            currentStep={currentStep}
            totalSteps={totalSteps}
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            isLastStep={isLastStep}
            onBack={goBack}
            onNext={goNext}
            nextLabel={activeStep?.nextLabel}
            hideNext={isPlexStep}
          />
          <div className="min-h-0 flex-1">{activeStep?.render()}</div>
        </div>
      </div>
    </div>
  )
}
