import { BackendDiagnosticStatus } from '@maintainerr/contracts'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid'
import { useBackendDiagnostics } from '../../../api/settings'
import Button from '../../Common/Button'
import { SmallLoadingSpinner } from '../../Common/LoadingSpinner'

const statusAppearance: Record<
  BackendDiagnosticStatus,
  { icon: typeof CheckCircleIcon; iconClass: string }
> = {
  success: { icon: CheckCircleIcon, iconClass: 'text-emerald-400' },
  warning: { icon: ExclamationTriangleIcon, iconClass: 'text-amber-400' },
  error: { icon: XCircleIcon, iconClass: 'text-red-400' },
}

const BackendDiagnosticsPanel = () => {
  const diagnostics = useBackendDiagnostics()
  const problemChecks =
    diagnostics.data?.checks.filter((check) => check.status !== 'success') ?? []

  return (
    <div className="section">
      <div className="flex items-start justify-between gap-4">
        <h3 className="heading underline decoration-zinc-600 underline-offset-4">
          Status
        </h3>
        <Button
          buttonType="default"
          buttonSize="sm"
          type="button"
          disabled={diagnostics.isFetching}
          onClick={() => void diagnostics.refetch()}
        >
          <ArrowPathIcon
            className={`mr-1 h-4 w-4 ${diagnostics.isFetching ? 'animate-spin' : ''}`}
          />
          Check again
        </Button>
      </div>

      {diagnostics.isFetching ? (
        <div className="mt-5 flex items-center justify-start gap-2 text-sm text-zinc-400">
          <SmallLoadingSpinner className="h-5 w-5" />
          <span>Running checks...</span>
        </div>
      ) : diagnostics.isError || !diagnostics.data ? (
        <div className="mt-5 flex items-start gap-3 text-red-300">
          <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <div className="font-medium">Backend checks could not run.</div>
            <p className="mt-0.5 text-sm text-zinc-400">
              Review the server log for the request error, then try again.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {diagnostics.data.status === 'success' ? (
            <div className="flex items-center gap-3 font-medium text-emerald-300">
              <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" />
              All checks passed
            </div>
          ) : (
            <>
              <p
                className={`font-medium ${
                  diagnostics.data.status === 'warning'
                    ? 'text-amber-300'
                    : 'text-red-300'
                }`}
              >
                {diagnostics.data.status === 'warning'
                  ? 'Needs attention'
                  : 'Action needed'}
              </p>

              <div className="mt-4 space-y-4">
                {problemChecks.map((check) => {
                  const appearance = statusAppearance[check.status]
                  const StatusIcon = appearance.icon
                  return (
                    <div key={check.id} className="flex items-start gap-3">
                      <StatusIcon
                        className={`mt-0.5 h-5 w-5 shrink-0 ${appearance.iconClass}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100">
                          {check.title}
                        </div>
                        <p className="mt-0.5 break-words text-sm text-zinc-400">
                          {check.message}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="mt-5 text-xs text-zinc-500">
                Checked {new Date(diagnostics.data.checkedAt).toLocaleString()}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default BackendDiagnosticsPanel
