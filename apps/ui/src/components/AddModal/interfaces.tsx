import { MediaItemType } from '@maintainerr/contracts'

export interface IAddModal {
  onCancel: () => void
  onSubmit: (result: IAddModalResult) => void
  onError?: () => void
  libraryId?: string
  type?: MediaItemType
  mediaServerId: number | string
  modalType: 'add' | 'exclude'
  addOnly?: boolean
}

export interface IAddModalResult {
  action: 'add' | 'remove'
  collectionTitle?: string
  modalType: 'add' | 'exclude'
}

export interface ICollectionMedia {
  media?: []
  id: number | string
  mediaServerId?: number | string
  libraryId?: string
  title: string
  description?: string
  isActive?: boolean
  arrAction?: number
  visibleOnRecommended?: boolean
  visibleOnHome?: boolean
  deleteAfterDays?: number
  type?: MediaItemType
  collectionMedia?: []
}

export interface IAlterableMediaDto {
  id: number | string
  index?: number
  parenIndex?: number
  type: MediaItemType
}
