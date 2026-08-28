import { AxiosResponse } from 'axios'
import axios from 'axios'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { MaintainerrLogger } from '../../logging/logs.service'
import { SettingsService } from '../../settings/settings.service'
import { MediaServerFactory } from '../media-server/media-server.factory'
import { TmdbApiService } from './tmdb.service'
import { TmdbImageCacheService } from './tmdb-image-cache.service'

describe('TmdbImageCacheService', () => {
  let cacheRoot: string
  let service: TmdbImageCacheService
  const originalImageCacheDir = process.env.IMAGE_CACHE_DIR
  const tmdbApi = {
    getImagePath: jest.fn(),
    getBackdropImagePath: jest.fn(),
  }
  const mediaServerFactory = {
    getService: jest.fn().mockRejectedValue(new Error('not configured')),
  }
  const settingsService = {
    image_cache_max_gb: 10,
  }
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }

  beforeEach(async () => {
    cacheRoot = mkdtempSync(path.join(tmpdir(), 'maintainerr-image-cache-'))
    process.env.IMAGE_CACHE_DIR = cacheRoot
    jest.clearAllMocks()
    mediaServerFactory.getService.mockRejectedValue(new Error('not configured'))
    settingsService.image_cache_max_gb = 10
    service = new TmdbImageCacheService(
      tmdbApi as unknown as TmdbApiService,
      mediaServerFactory as unknown as MediaServerFactory,
      settingsService as unknown as SettingsService,
      logger as unknown as MaintainerrLogger,
    )
    await service.onModuleInit()
  })

  afterEach(() => {
    service.onModuleDestroy()
    jest.restoreAllMocks()
    rmSync(cacheRoot, { recursive: true, force: true })
    if (originalImageCacheDir === undefined) {
      delete process.env.IMAGE_CACHE_DIR
    } else {
      process.env.IMAGE_CACHE_DIR = originalImageCacheDir
    }
  })

  it('downloads an actor image once and reuses the disk file', async () => {
    const imageRequest = jest.spyOn(axios, 'get').mockResolvedValue({
      data: Buffer.from('actor portrait'),
      headers: { 'content-type': 'image/jpeg' },
    } as unknown as AxiosResponse<ArrayBuffer>)
    const request = { personId: 101, profilePath: '/lead.jpg' }

    const [first, second] = await Promise.all([
      service.getActorImage(request),
      service.getActorImage(request),
    ])
    const third = await service.getActorImage(request)

    expect(first?.filePath).toBe(second?.filePath)
    expect(third?.filePath).toBe(first?.filePath)
    expect(readFileSync(first!.filePath, 'utf8')).toBe('actor portrait')
    expect(imageRequest).toHaveBeenCalledTimes(1)
  })

  it('uses a cached library poster without requesting TMDB metadata', async () => {
    const posterFolder = path.join(cacheRoot, 'library', 'posters')
    const posterPath = path.join(posterFolder, 'movie-170-w342-existing.jpg')
    writeFileSync(posterPath, 'cached poster')

    const result = await service.getMediaImage({
      scope: 'library',
      variant: 'poster',
      type: 'movie',
      tmdbId: 170,
    })

    expect(result?.filePath).toBe(posterPath)
    expect(tmdbApi.getImagePath).not.toHaveBeenCalled()
  })

  it('keeps Discover and library images in separate folders', async () => {
    const imageRequest = jest.spyOn(axios, 'get').mockResolvedValue({
      data: Buffer.from('poster'),
      headers: { 'content-type': 'image/jpeg' },
    } as unknown as AxiosResponse<ArrayBuffer>)

    const discover = await service.getMediaImage({
      scope: 'discover',
      variant: 'poster',
      type: 'movie',
      tmdbId: 170,
      imagePath: '/poster.jpg',
    })
    const library = await service.getMediaImage({
      scope: 'library',
      variant: 'poster',
      type: 'movie',
      tmdbId: 170,
      imagePath: '/poster.jpg',
    })

    expect(library?.filePath).toContain(path.join('library', 'posters'))
    expect(discover?.filePath).toContain(path.join('discover', 'posters'))
    expect(imageRequest).toHaveBeenCalledTimes(1)
  })

  it('rejects unsafe image paths without a download', async () => {
    const imageRequest = jest.spyOn(axios, 'get')

    await expect(
      service.getActorImage({
        personId: 101,
        profilePath: '/../private.jpg',
      }),
    ).resolves.toBeNull()
    expect(imageRequest).not.toHaveBeenCalled()
  })

  it('removes Discover posters after thirty days without access', async () => {
    const posterPath = path.join(
      cacheRoot,
      'discover',
      'posters',
      'movie-170-w342-expired.jpg',
    )
    writeFileSync(posterPath, 'expired')
    const expiredAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    utimesSync(posterPath, expiredAt, expiredAt)

    await service.cleanup()

    expect(existsSync(posterPath)).toBe(false)
  })

  it('removes library images for titles no longer in the media server', async () => {
    const posterFolder = path.join(cacheRoot, 'library', 'posters')
    const activePoster = path.join(posterFolder, 'movie-170-w342-active.jpg')
    const orphanedPoster = path.join(
      posterFolder,
      'movie-999-w342-orphaned.jpg',
    )
    writeFileSync(activePoster, 'active')
    writeFileSync(orphanedPoster, 'orphaned')
    mediaServerFactory.getService.mockResolvedValue({
      getLibraries: jest
        .fn()
        .mockResolvedValue([{ id: 'movies', title: 'Movies', type: 'movie' }]),
      getLibraryContents: jest.fn().mockResolvedValue({
        items: [
          {
            isTrashed: false,
            providerIds: { tmdb: ['170'] },
          },
        ],
        totalSize: 1,
      }),
    })

    await service.cleanup()

    expect(existsSync(activePoster)).toBe(true)
    expect(existsSync(orphanedPoster)).toBe(false)
  })

  it('evicts oldest Discover images before library images at the size limit', async () => {
    const discoverPoster = path.join(
      cacheRoot,
      'discover',
      'posters',
      'movie-1-w342-discover.jpg',
    )
    const libraryPoster = path.join(
      cacheRoot,
      'library',
      'posters',
      'movie-2-w342-library.jpg',
    )
    writeFileSync(discoverPoster, 'discover')
    writeFileSync(libraryPoster, 'library')
    settingsService.image_cache_max_gb = 8 / (1024 * 1024 * 1024)

    await service.cleanup()

    expect(existsSync(discoverPoster)).toBe(false)
    expect(existsSync(libraryPoster)).toBe(true)
  })
})
