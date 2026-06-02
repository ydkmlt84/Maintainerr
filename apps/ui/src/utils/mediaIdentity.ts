import {
  type MediaItem,
  type MediaItemWithParent,
} from '@maintainerr/contracts'

export const getMediaItemIdentity = (item: MediaItem): string => {
  const parentItem = (item as MediaItemWithParent).parentItem

  return [
    item.library?.id,
    item.type,
    item.id,
    item.guid,
    item.parentId,
    item.grandparentId,
    parentItem?.id,
    item.parentIndex,
    item.index,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join(':')
}

export const dedupeMediaItems = <T extends MediaItem>(items: T[]): T[] => {
  const seen = new Set<string>()

  return items.filter((item) => {
    const identity = getMediaItemIdentity(item)

    if (seen.has(identity)) {
      return false
    }

    seen.add(identity)
    return true
  })
}
