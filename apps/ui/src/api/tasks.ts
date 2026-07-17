import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PostApiHandler } from '../utils/ApiHandler'
import GetApiHandler from '../utils/ApiHandler'

export interface ScheduledTask {
  name: string
  schedule: string
  running: boolean
  runningSince: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: 'never' | 'running' | 'success' | 'failed'
  lastError: string | null
}

export const useScheduledTasks = () =>
  useQuery({
    queryKey: ['tasks'],
    queryFn: () => GetApiHandler<ScheduledTask[]>('/tasks'),
    refetchInterval: (query) =>
      query.state.data?.some((task) => task.running) ? 2000 : 5000,
  })

export const useRunScheduledTask = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      PostApiHandler<{ status: string }>(
        `/tasks/${encodeURIComponent(name)}/run`,
        {},
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
