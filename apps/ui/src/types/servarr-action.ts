import { ServarrAction as ContractsServarrAction } from '@maintainerr/contracts'

const fallbackServarrAction = {
  DELETE: 0,
  UNMONITOR_DELETE_ALL: 1,
  UNMONITOR_DELETE_EXISTING: 2,
  UNMONITOR: 3,
  DO_NOTHING: 4,
  CHANGE_QUALITY_PROFILE: 5,
} as const

export const ServarrAction = ContractsServarrAction ?? fallbackServarrAction
