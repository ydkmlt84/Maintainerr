import type { ReactNode } from 'react'

type ServiceStepLayoutProps = {
  title: string
  description?: string
  onSkip?: () => void
  children: ReactNode
}

export default function ServiceStepLayout({
  title,
  description,
  onSkip,
  children,
}: ServiceStepLayoutProps) {
  return (
    <div className="px-2 pb-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
          {description ? (
            <p className="text-sm text-zinc-400">{description}</p>
          ) : null}
        </div>

        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-100 transition hover:bg-zinc-700"
          >
            Skip for now
          </button>
        ) : null}
      </div>

      {children}
    </div>
  )
}
