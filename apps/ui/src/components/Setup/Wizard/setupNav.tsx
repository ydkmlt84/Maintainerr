import ProgressTracker from './progressTracker'

type WizardNavProps = {
  currentStep: number
  totalSteps: number
  canGoBack: boolean
  canGoNext: boolean
  isLastStep: boolean
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  hideNext?: boolean
}

export default function WizardNav({
  currentStep,
  totalSteps,
  canGoBack,
  canGoNext,
  isLastStep,
  onBack,
  onNext,
  nextLabel,
  hideNext,
}: WizardNavProps) {
  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <ProgressTracker currentStep={currentStep} totalSteps={totalSteps} />

      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-100 disabled:opacity-40"
        >
          Back
        </button>

        {/* This is intentionally hidden for flows like Plex setup that handle forward nav internally */}
        {!hideNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-40"
          >
            {nextLabel ?? (isLastStep ? 'Finish' : 'Next')}
          </button>
        ) : (
          // Keeps spacing so Back doesn't jump to the right when Next is hidden
          <div className="h-10 w-[88px]" />
        )}
      </div>
    </div>
  )
}
