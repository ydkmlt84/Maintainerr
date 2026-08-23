import { IAlterableMediaDto } from '../../collections/interfaces/collection-media.interface'

export class ExclusionDto {
  mediaServerId: string
  ruleGroupId?: number
  collectionId?: number
  action?: ExclusionAction
  expiresInDays?: number
}

export interface ExclusionContextDto {
  mediaId: string
  context: IAlterableMediaDto
  collectionId: number
  ruleGroupId: number
  action: 0 | 1
  expiresInDays?: number
}
export enum ExclusionAction {
  ADD,
  REMOVE,
}
