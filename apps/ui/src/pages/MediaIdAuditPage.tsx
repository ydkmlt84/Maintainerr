import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useMemo, useState } from 'react'
import {
  MediaIdAuditCategory,
  MediaIdAuditFinding,
  useLatestMediaIdAudit,
  useMediaIdAuditRun,
  useMediaIdAuditRuns,
} from '../api/media-id-audit'
import Alert from '../components/Common/Alert'
import LoadingSpinner from '../components/Common/LoadingSpinner'

const categoryLabels: Record<MediaIdAuditCategory, string> = {
  probable_mismatch: 'Probable mismatch',
  missing_plex_id: 'Missing Plex ID',
  not_found_in_arr: 'Not found in Arr',
  duplicate_plex_id: 'Duplicate Plex ID',
  ambiguous_title_match: 'Ambiguous title match',
  plex_trash: 'Plex trash',
}

const categoryStyles: Record<MediaIdAuditCategory, string> = {
  probable_mismatch: 'bg-red-950 text-red-200 ring-red-800',
  missing_plex_id: 'bg-amber-950 text-amber-200 ring-amber-800',
  not_found_in_arr: 'bg-zinc-700 text-zinc-200 ring-zinc-600',
  duplicate_plex_id: 'bg-orange-950 text-orange-200 ring-orange-800',
  ambiguous_title_match: 'bg-sky-950 text-sky-200 ring-sky-800',
  plex_trash: 'bg-fuchsia-950 text-fuchsia-200 ring-fuchsia-800',
}

const CategoryBadge = ({ finding }: { finding: MediaIdAuditFinding }) => (
  <span
    className={`inline-flex rounded px-2 py-1 text-xs font-medium ring-1 ring-inset ${categoryStyles[finding.category]}`}
  >
    {categoryLabels[finding.category]}
  </span>
)

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : 'Not completed'

const MediaIdAuditPage = () => {
  const latest = useLatestMediaIdAudit()
  const history = useMediaIdAuditRuns()
  const [selectedRunId, setSelectedRunId] = useState<number>()
  const selected = useMediaIdAuditRun(selectedRunId)
  const [category, setCategory] = useState<'all' | MediaIdAuditCategory>('all')
  const [state, setState] = useState<'all' | 'current' | 'resolved'>('current')
  const [search, setSearch] = useState('')
  const run = selectedRunId ? selected.data : latest.data
  const reportFindings = useMemo(
    () =>
      (run?.findings ?? []).filter(
        (finding) => finding.category !== 'plex_trash',
      ),
    [run?.findings],
  )
  const currentFindings = useMemo(
    () => reportFindings.filter((finding) => finding.state === 'current'),
    [reportFindings],
  )
  const findings = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reportFindings.filter(
      (finding) =>
        (category === 'all' || finding.category === category) &&
        (state === 'all' || finding.state === state) &&
        (!term ||
          finding.title.toLowerCase().includes(term) ||
          finding.plexLibraryTitle.toLowerCase().includes(term) ||
          finding.plexProviderId?.toLowerCase().includes(term) ||
          finding.arrProviderId?.toLowerCase().includes(term)),
    )
  }, [category, reportFindings, search, state])

  if (latest.isLoading || history.isLoading || selected.isLoading) {
    return <LoadingSpinner />
  }

  return (
    <>
      <title>Media ID Audit - Maintainerr</title>
      <div className="w-full text-zinc-200">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Media ID Audit</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Read-only comparison of Plex provider IDs against Radarr and
              Sonarr inventories.
            </p>
          </div>
          <label className="text-sm text-zinc-400">
            Report run
            <select
              className="mt-1 block w-full min-w-64 rounded border-zinc-600 bg-zinc-800 text-sm text-zinc-100"
              value={selectedRunId ?? ''}
              onChange={(event) =>
                setSelectedRunId(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">Latest</option>
              {history.data?.map((historyRun) => (
                <option key={historyRun.id} value={historyRun.id}>
                  {formatDate(historyRun.startedAt)} - {historyRun.status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!run ? (
          <Alert
            type="info"
            title="No report has been generated yet. Run the audit from Settings > Jobs."
          />
        ) : run.status === 'failed' ? (
          <Alert type="error" title={run.error ?? 'The audit failed.'} />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Plex media', run.totalPlexItems],
                ['Matched', run.matchedCount],
                ['Current', currentFindings.length],
                [
                  'New',
                  currentFindings.filter((finding) => finding.isNew).length,
                ],
                ['Resolved', run.resolvedCount],
                ['Probable mismatch', run.probableMismatchCount],
                ['Missing Plex ID', run.missingPlexIdCount],
                ['Not found in Arr', run.notFoundInArrCount],
                ['Duplicate Plex ID', run.duplicatePlexIdCount],
                ['Ambiguous', run.ambiguousTitleMatchCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-3"
                >
                  <div className="text-xs text-zinc-400">{label}</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-2 lg:flex-row">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
                <input
                  className="w-full rounded border-zinc-600 bg-zinc-800 py-2 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Search title, library, or provider ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded border-zinc-600 bg-zinc-800 text-sm text-zinc-100"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value as 'all' | MediaIdAuditCategory,
                    )
                  }
                >
                  <option value="all">All categories</option>
                  {Object.entries(categoryLabels)
                    .filter(([value]) => value !== 'plex_trash')
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
                <select
                  className="rounded border-zinc-600 bg-zinc-800 text-sm text-zinc-100"
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value as 'all' | 'current' | 'resolved',
                    )
                  }
                >
                  <option value="current">Current</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All states</option>
                </select>
              </div>
            </div>

            <div className="hidden overflow-x-auto rounded-md border border-zinc-700 lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-zinc-800 text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="w-1/5 px-3 py-3">Media</th>
                    <th className="w-44 px-3 py-3">Finding</th>
                    <th className="w-32 px-3 py-3">Plex ID</th>
                    <th className="w-32 px-3 py-3">Arr ID</th>
                    <th className="w-36 px-3 py-3">Library</th>
                    <th className="px-3 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-900/40">
                  {findings.map((finding) => (
                    <tr key={finding.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-white">
                          {finding.title}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {finding.year ?? 'Unknown year'} / {finding.mediaType}
                          {finding.isNew ? ' / New' : ''}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          First detected {formatDate(finding.firstDetectedAt)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <CategoryBadge finding={finding} />
                      </td>
                      <td className="break-words px-3 py-3 font-mono text-xs">
                        {finding.plexProviderId ?? 'Missing'}
                      </td>
                      <td className="break-words px-3 py-3 font-mono text-xs">
                        {finding.arrProviderId ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        {finding.plexLibraryTitle}
                      </td>
                      <td className="px-3 py-3 text-zinc-400">
                        {finding.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 lg:hidden">
              {findings.map((finding) => (
                <article
                  key={finding.id}
                  className="rounded-md border border-zinc-700 bg-zinc-800 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="break-words font-medium text-white">
                        {finding.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {finding.year ?? 'Unknown year'} /{' '}
                        {finding.plexLibraryTitle}
                      </p>
                    </div>
                    <CategoryBadge finding={finding} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{finding.reason}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    First detected {formatDate(finding.firstDetectedAt)}
                    {finding.state === 'resolved' && finding.resolvedAt
                      ? ` / Resolved ${formatDate(finding.resolvedAt)}`
                      : ''}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-zinc-500">Plex ID</div>
                      <div className="mt-1 break-all font-mono">
                        {finding.plexProviderId ?? 'Missing'}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Arr ID</div>
                      <div className="mt-1 break-all font-mono">
                        {finding.arrProviderId ?? '-'}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {findings.length === 0 && (
              <div className="py-12 text-center text-sm text-zinc-500">
                No findings match the selected filters.
              </div>
            )}

            <p className="mt-4 text-xs text-zinc-500">
              Completed {formatDate(run.completedAt)}. Findings are report-only;
              no repair action is available from Maintainerr.
            </p>
          </>
        )}
      </div>
    </>
  )
}

export default MediaIdAuditPage
