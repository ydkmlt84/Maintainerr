import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import GetApiHandler, { PutApiHandler } from '../utils/ApiHandler'

export interface NotificationTypeSpec {
  id: number
  title: string
}

export interface NotificationAssignment {
  id: number
  name: string
  agent: string
  enabled: boolean
  selected: boolean
}

export const MEDIA_ABOUT_TO_BE_HANDLED = 8

export const useNotificationTypes = () =>
  useQuery({
    queryKey: ['notifications', 'types'],
    queryFn: () =>
      GetApiHandler<NotificationTypeSpec[]>('/notifications/types'),
  })

export const useNotificationAssignments = (type: number) =>
  useQuery({
    queryKey: ['notifications', 'assignments', type],
    queryFn: () =>
      GetApiHandler<NotificationAssignment[]>(
        `/notifications/type/${type}/configurations`,
      ),
  })

export const useSetNotificationAssignment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      type,
      id,
      selected,
      aboutScale,
    }: {
      type: number
      id: number
      selected: boolean
      aboutScale?: number
    }) =>
      PutApiHandler(`/notifications/type/${type}/configurations/${id}`, {
        selected,
        ...(aboutScale !== undefined ? { aboutScale } : {}),
      }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['notifications', 'assignments', variables.type],
      })
    },
  })
}
