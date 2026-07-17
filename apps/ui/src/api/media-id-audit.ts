import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import GetApiHandler, { PostApiHandler } from '../utils/ApiHandler'

export type MediaIdAuditCategory =
  | 'probable_mismatch'
  | 'missing_plex_id'
  | 'not_found_in_arr'
  | 'duplicate_plex_id'
  | 'ambiguous_title_match'
  | 'plex_trash'

export interface MediaIdAuditFinding {
  id: number
  category: MediaIdAuditCategory
  state: 'current' | 'resolved'
  isNew: boolean
  mediaType: 'movie' | 'show'
  title: string
  year?: number
  plexLibraryTitle: string
  plexRatingKey: string
  plexProviderId?: string
  arrProviderId?: string
  arrServerName?: string
  confidence: 'high' | 'medium' | 'info'
  reason: string
  firstDetectedAt: string
  lastDetectedAt: string
  resolvedAt?: string
}

export interface MediaIdAuditRun {
  id: number
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed'
  error?: string
  totalPlexItems: number
  matchedCount: number
  findingCount: number
  newCount: number
  resolvedCount: number
  probableMismatchCount: number
  missingPlexIdCount: number
  notFoundInArrCount: number
  duplicatePlexIdCount: number
  ambiguousTitleMatchCount: number
  plexTrashCount: number
  findings?: MediaIdAuditFinding[]
}

export const useLatestMediaIdAudit = () =>
  useQuery({
    queryKey: ['media-id-audit', 'latest'],
    queryFn: () =>
      GetApiHandler<MediaIdAuditRun | null>('/media-id-audit/runs/latest'),
  })

export const useMediaIdAuditRuns = () =>
  useQuery({
    queryKey: ['media-id-audit', 'runs'],
    queryFn: () =>
      GetApiHandler<MediaIdAuditRun[]>('/media-id-audit/runs?limit=10'),
  })

export const useMediaIdAuditRun = (id?: number) =>
  useQuery({
    queryKey: ['media-id-audit', 'run', id],
    queryFn: () => GetApiHandler<MediaIdAuditRun>(`/media-id-audit/runs/${id}`),
    enabled: id !== undefined,
  })

type RunAuditOptions = Omit<
  UseMutationOptions<MediaIdAuditRun | null, Error, void>,
  'mutationFn' | 'mutationKey'
>

export const useRunMediaIdAudit = (options?: RunAuditOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationKey: ['media-id-audit', 'run-now'],
    mutationFn: () =>
      PostApiHandler<MediaIdAuditRun | null>('/media-id-audit/run', {}),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['media-id-audit'] })
      await options?.onSuccess?.(...args)
    },
  })
}
