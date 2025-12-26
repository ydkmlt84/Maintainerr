type ServiceOption = {
  key: string
  label: string
  description: string
}

type ServiceSelectionProps = {
  selected: string[]
  onChange: (next: string[]) => void
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    key: 'radarr',
    label: 'Radarr',
    description: 'Movies automation (optional).',
  },
  {
    key: 'sonarr',
    label: 'Sonarr',
    description: 'TV automation (optional).',
  },
  {
    key: 'tautulli',
    label: 'Tautulli',
    description: 'Server stats and activity tracking.',
  },
  {
    key: 'seerr',
    label: 'Seerr',
    description: 'Manage and approve user requests.',
  },
]

export default function ServiceSelection({
  selected,
  onChange,
}: ServiceSelectionProps) {
  const toggleSelection = (key: string) => {
    const next = selected.includes(key)
      ? selected.filter((s) => s !== key)
      : [...selected, key]

    onChange(next)
  }

  return (
    <div className="px-4 pb-6">
      <h2 className="text-2xl font-semibold text-zinc-100">
        Pick optional services
      </h2>

      <p className="mt-3 text-sm text-zinc-300">
        Choose which services to configure next. You can skip this now and add
        them later from Settings.
      </p>

      <div className="mt-4 space-y-3">
        {SERVICE_OPTIONS.map((svc) => {
          const isChecked = selected.includes(svc.key)
          return (
            <label
              key={svc.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-700"
                checked={isChecked}
                onChange={() => toggleSelection(svc.key)}
              />
              <div>
                <div className="text-sm font-semibold text-zinc-100">
                  {svc.label}
                </div>
                <div className="text-xs text-zinc-400">{svc.description}</div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
