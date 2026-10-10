import path from 'path'
import { dataDir } from './databasePath'

export const resolveImageCachePath = () =>
  process.env.IMAGE_CACHE_DIR?.trim() || path.join(dataDir, 'cache', 'tmdb')
