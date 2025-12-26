type ProgressTrackerProps = {
  currentStep: number
  totalSteps: number
}

export default function ProgressTracker({
  currentStep,
  totalSteps,
}: ProgressTrackerProps) {
  const displayStep = currentStep + 1

  return (
    <div className="mb-4 flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index <= currentStep ? 'bg-zinc-100' : 'bg-zinc-600'
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-zinc-400">
        Step {displayStep} of {totalSteps}
      </p>
    </div>
  )
}
