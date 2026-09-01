import type {
  TraktDiscoverItem,
  TraktDiscoverResponse,
} from '@maintainerr/contracts'

const itemKey = (item: TraktDiscoverItem) => `${item.type}:${item.ids.trakt}`

export const getDiscoverSnapshot = (
  data: TraktDiscoverResponse,
  limit = 15,
): TraktDiscoverItem[] => {
  const sources = [
    data.sections.trendingMovies,
    data.sections.trendingShows,
    data.sections.popularMovies,
    data.sections.popularShows,
  ]
  const snapshot: TraktDiscoverItem[] = []
  const seen = new Set<string>()
  const longestSource = Math.max(0, ...sources.map((items) => items.length))

  for (
    let index = 0;
    index < longestSource && snapshot.length < limit;
    index++
  ) {
    for (const source of sources) {
      const item = source[index]
      if (!item || seen.has(itemKey(item))) continue
      seen.add(itemKey(item))
      snapshot.push(item)
      if (snapshot.length === limit) break
    }
  }

  return snapshot
}
