import { MaintainerrEvent } from '@maintainerr/contracts'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import axios from 'axios'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { dataDir } from '../../../app/config/databasePath'
import { MaintainerrLogger } from '../../logging/logs.service'
import { Settings } from '../../settings/entities/settings.entities'
import { SettingsService } from '../../settings/settings.service'
import { MediaServerFactory } from '../media-server/media-server.factory'
import { TmdbApiService } from './tmdb.service'

export type TmdbImageScope = 'library' | 'discover'
export type TmdbImageVariant = 'poster' | 'backdrop'
export type TmdbMediaType = 'movie' | 'show'

export interface CachedTmdbImage {
  filePath: string
  contentType: string
  browserMaxAgeSeconds: number
  immutable: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_CACHE_GB = 10
const GB_BYTES = 1024 * 1024 * 1024
const RETENTION_MS: Record<
  TmdbImageScope | 'actors',
  Record<TmdbImageVariant | 'profile', number>
> = {
  library: {
    poster: 120 * DAY_MS,
    backdrop: 120 * DAY_MS,
    profile: 0,
  },
  discover: {
    poster: 30 * DAY_MS,
    backdrop: 14 * DAY_MS,
    profile: 0,
  },
  actors: {
    poster: 0,
    backdrop: 0,
    profile: 365 * DAY_MS,
  },
}

const BROWSER_MAX_AGE_SECONDS: Record<TmdbImageScope | 'actors', number> = {
  library: 30 * 24 * 60 * 60,
  discover: 24 * 60 * 60,
  actors: 365 * 24 * 60 * 60,
}

@Injectable()
export class TmdbImageCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly cacheRoot =
    process.env.IMAGE_CACHE_DIR?.trim() || path.join(dataDir, 'cache', 'tmdb')
  private readonly pendingDownloads = new Map<
    string,
    Promise<CachedTmdbImage | null>
  >()
  private initialCleanupTimer?: NodeJS.Timeout
  private cleanupTimer?: NodeJS.Timeout
  private sizeEnforcementTimer?: NodeJS.Timeout

  constructor(
    private readonly tmdbApi: TmdbApiService,
    private readonly mediaServerFactory: MediaServerFactory,
    private readonly settingsService: SettingsService,
    private readonly logger: MaintainerrLogger,
  ) {
    logger.setContext(TmdbImageCacheService.name)
  }

  public async onModuleInit(): Promise<void> {
    await this.ensureCacheDirectories()
    await this.migrateLegacyCacheFiles()
    if (process.env.NODE_ENV === 'test') return

    this.initialCleanupTimer = setTimeout(() => {
      void this.cleanup().catch((error) =>
        this.logger.warn(`Initial TMDB image cache cleanup failed: ${error}`),
      )
    }, 60_000)
    this.initialCleanupTimer.unref()
    this.cleanupTimer = setInterval(() => {
      void this.cleanup().catch((error) =>
        this.logger.warn(`TMDB image cache cleanup failed: ${error}`),
      )
    }, DAY_MS)
    this.cleanupTimer.unref()
  }

  public onModuleDestroy(): void {
    if (this.initialCleanupTimer) clearTimeout(this.initialCleanupTimer)
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    if (this.sizeEnforcementTimer) clearTimeout(this.sizeEnforcementTimer)
  }

  public async getMediaImage({
    scope,
    variant,
    type,
    tmdbId,
    imagePath,
  }: {
    scope: TmdbImageScope
    variant: TmdbImageVariant
    type: TmdbMediaType
    tmdbId: number
    imagePath?: string
  }): Promise<CachedTmdbImage | null> {
    if (!this.isValidId(tmdbId) || !this.isValidImagePath(imagePath, true)) {
      return null
    }

    const size = variant === 'poster' ? 'w342' : 'w1280'
    const folder = this.getFolder(scope, variant)
    const staleFallback = imagePath
      ? await this.findCachedImage(folder, type, tmdbId, size)
      : undefined
    const cached = imagePath
      ? await this.findExactCachedImage(folder, type, tmdbId, size, imagePath)
      : await this.findCachedImage(folder, type, tmdbId, size)
    if (cached) {
      await this.touchIfNeeded(cached)
      return this.toCachedImage(cached, scope, Boolean(imagePath))
    }

    if (scope === 'library') {
      const promoted = await this.promoteDiscoverImage({
        folder,
        variant,
        type,
        tmdbId,
        size,
        imagePath,
      })
      if (promoted) {
        return this.toCachedImage(promoted, scope, Boolean(imagePath))
      }
    }

    const resolvedPath =
      imagePath ||
      (variant === 'poster'
        ? await this.tmdbApi.getImagePath({ tmdbId, type })
        : await this.tmdbApi.getBackdropImagePath({ tmdbId, type }))
    if (!this.isValidImagePath(resolvedPath)) return null

    const downloaded = await this.downloadImage({
      folder,
      filename: this.getFilename(type, tmdbId, size, resolvedPath),
      remotePath: resolvedPath,
      size,
      scope,
      immutable: Boolean(imagePath),
    })
    if (downloaded) return downloaded
    return staleFallback
      ? this.toCachedImage(staleFallback, scope, false)
      : null
  }

  public async getActorImage({
    personId,
    profilePath,
  }: {
    personId: number
    profilePath: string
  }): Promise<CachedTmdbImage | null> {
    if (!this.isValidId(personId) || !this.isValidImagePath(profilePath)) {
      return null
    }

    const folder = this.getFolder('actors', 'profile')
    const size = 'w342'
    const staleFallback = await this.findCachedImage(
      folder,
      'person',
      personId,
      size,
    )
    const cached =
      (await this.findExactCachedImage(
        folder,
        'person',
        personId,
        size,
        profilePath,
      )) ?? (await this.findLegacyCachedImage(folder, 'person', personId, size))
    if (cached) {
      await this.touchIfNeeded(cached)
      return this.toCachedImage(cached, 'actors', true)
    }

    const downloaded = await this.downloadImage({
      folder,
      filename: this.getFilename('person', personId, size, profilePath),
      remotePath: profilePath,
      size,
      scope: 'actors',
      immutable: true,
    })
    if (downloaded) return downloaded
    return staleFallback
      ? this.toCachedImage(staleFallback, 'actors', false)
      : null
  }

  public async cleanup(): Promise<{ deleted: number }> {
    await this.ensureCacheDirectories()
    let deleted = 0

    for (const scope of ['library', 'discover'] as const) {
      for (const variant of ['poster', 'backdrop'] as const) {
        deleted += await this.removeExpiredFiles(
          this.getFolder(scope, variant),
          RETENTION_MS[scope][variant],
        )
      }
    }
    deleted += await this.removeExpiredFiles(
      this.getFolder('actors', 'profile'),
      RETENTION_MS.actors.profile,
    )

    deleted += await this.reconcileLibraryCache()
    deleted += await this.enforceSizeLimit()
    if (deleted > 0) {
      this.logger.log(`Removed ${deleted} expired or orphaned cached images`)
    }
    return { deleted }
  }

  public getCacheRoot(): string {
    return this.cacheRoot
  }

  @OnEvent(MaintainerrEvent.Settings_Updated)
  private onSettingsUpdated(data: {
    oldSettings: Settings
    settings: Settings
  }): void {
    if (
      data.oldSettings.image_cache_max_gb === data.settings.image_cache_max_gb
    ) {
      return
    }
    void this.enforceSizeLimit(data.settings.image_cache_max_gb).catch(
      (error) =>
        this.logger.warn(`TMDB image cache size enforcement failed: ${error}`),
    )
  }

  private async downloadImage({
    folder,
    filename,
    remotePath,
    size,
    scope,
    immutable,
  }: {
    folder: string
    filename: string
    remotePath: string
    size: string
    scope: TmdbImageScope | 'actors'
    immutable: boolean
  }): Promise<CachedTmdbImage | null> {
    const filePath = path.join(folder, filename)
    const pending = this.pendingDownloads.get(filePath)
    if (pending !== undefined) return pending

    const request = this.fetchAndStoreImage(
      folder,
      filePath,
      remotePath,
      size,
      scope,
      immutable,
    ).finally(() => this.pendingDownloads.delete(filePath))
    this.pendingDownloads.set(filePath, request)
    return request
  }

  private async promoteDiscoverImage({
    folder,
    variant,
    type,
    tmdbId,
    size,
    imagePath,
  }: {
    folder: string
    variant: TmdbImageVariant
    type: TmdbMediaType
    tmdbId: number
    size: string
    imagePath?: string
  }): Promise<string | undefined> {
    const discoverFolder = this.getFolder('discover', variant)
    const source = imagePath
      ? await this.findExactCachedImage(
          discoverFolder,
          type,
          tmdbId,
          size,
          imagePath,
        )
      : await this.findCachedImage(discoverFolder, type, tmdbId, size)
    if (!source) return undefined

    const destination = path.join(folder, path.basename(source))
    await fs.copyFile(source, destination)
    await this.touchIfNeeded(destination)
    this.scheduleSizeEnforcement()
    return destination
  }

  private async fetchAndStoreImage(
    folder: string,
    filePath: string,
    remotePath: string,
    size: string,
    scope: TmdbImageScope | 'actors',
    immutable: boolean,
  ): Promise<CachedTmdbImage | null> {
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      const response = await axios.get<ArrayBuffer>(
        `https://image.tmdb.org/t/p/${size}${remotePath}`,
        { responseType: 'arraybuffer', timeout: 15000 },
      )
      await fs.mkdir(folder, { recursive: true })
      await fs.writeFile(temporaryPath, Buffer.from(response.data))
      await fs.rename(temporaryPath, filePath)
      await this.removeOlderVersions(folder, filePath)
      this.scheduleSizeEnforcement()
      return {
        filePath,
        contentType:
          typeof response.headers['content-type'] === 'string'
            ? response.headers['content-type']
            : this.getImageContentType(path.extname(filePath)),
        browserMaxAgeSeconds: BROWSER_MAX_AGE_SECONDS[scope],
        immutable,
      }
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
      this.logger.warn(`Failed to cache TMDB image ${remotePath}: ${error}`)
      return null
    }
  }

  private async reconcileLibraryCache(): Promise<number> {
    const markerPath = path.join(this.cacheRoot, '.last-library-reconcile')
    if (await this.isMarkerFresh(markerPath, 7 * DAY_MS)) return 0

    try {
      const mediaServer = await this.mediaServerFactory.getService()
      const libraries = await mediaServer.getLibraries()
      const activeIds = new Set<string>()

      for (const library of libraries) {
        let offset = 0
        let totalSize = 0
        do {
          const page = await mediaServer.getLibraryContents(library.id, {
            offset,
            limit: 500,
            type: library.type,
          })
          page.items
            .filter((item) => !item.isTrashed)
            .forEach((item) =>
              item.providerIds.tmdb?.forEach((id) =>
                activeIds.add(`${library.type}:${id}`),
              ),
            )
          totalSize = page.totalSize
          offset += page.items.length
        } while (offset < totalSize && offset > 0)
      }

      if (activeIds.size === 0) return 0

      let deleted = 0
      for (const variant of ['poster', 'backdrop'] as const) {
        const folder = this.getFolder('library', variant)
        for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
          if (!entry.isFile() || entry.name.endsWith('.tmp')) continue
          const match = entry.name.match(/^(movie|show)-(\d+)-/)
          if (match && !activeIds.has(`${match[1]}:${match[2]}`)) {
            await fs.rm(path.join(folder, entry.name), { force: true })
            deleted++
          }
        }
      }
      await fs.writeFile(markerPath, new Date().toISOString())
      return deleted
    } catch (error) {
      this.logger.debug(`Skipped library image-cache reconciliation: ${error}`)
      return 0
    }
  }

  private async removeExpiredFiles(
    folder: string,
    retentionMs: number,
  ): Promise<number> {
    let deleted = 0
    const now = Date.now()
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const filePath = path.join(folder, entry.name)
      const stats = await fs.stat(filePath)
      const maxAge = entry.name.endsWith('.tmp') ? DAY_MS : retentionMs
      if (now - stats.mtimeMs > maxAge) {
        await fs.rm(filePath, { force: true })
        deleted++
      }
    }
    return deleted
  }

  private scheduleSizeEnforcement(): void {
    if (process.env.NODE_ENV === 'test' || this.sizeEnforcementTimer) return
    this.sizeEnforcementTimer = setTimeout(() => {
      this.sizeEnforcementTimer = undefined
      void this.enforceSizeLimit().catch((error) =>
        this.logger.warn(`TMDB image cache size enforcement failed: ${error}`),
      )
    }, 10_000)
    this.sizeEnforcementTimer.unref()
  }

  private async enforceSizeLimit(limitGb?: number): Promise<number> {
    const configuredGb = Number(
      limitGb ?? this.settingsService.image_cache_max_gb,
    )
    const maxBytes =
      (Number.isFinite(configuredGb) && configuredGb > 0
        ? configuredGb
        : DEFAULT_MAX_CACHE_GB) * GB_BYTES
    const folders = [
      this.getFolder('discover', 'poster'),
      this.getFolder('discover', 'backdrop'),
      this.getFolder('actors', 'profile'),
      this.getFolder('library', 'backdrop'),
      this.getFolder('library', 'poster'),
    ]
    const filesByPriority = await Promise.all(
      folders.map(async (folder) => {
        const files = await Promise.all(
          (await fs.readdir(folder, { withFileTypes: true }))
            .filter((entry) => entry.isFile() && !entry.name.endsWith('.tmp'))
            .map(async (entry) => {
              const filePath = path.join(folder, entry.name)
              const stats = await fs.stat(filePath)
              return { filePath, size: stats.size, mtimeMs: stats.mtimeMs }
            }),
        )
        return files.sort((a, b) => a.mtimeMs - b.mtimeMs)
      }),
    )
    let totalBytes = filesByPriority
      .flat()
      .reduce((total, file) => total + file.size, 0)
    if (totalBytes <= maxBytes) return 0

    let deleted = 0
    for (const files of filesByPriority) {
      for (const file of files) {
        if (totalBytes <= maxBytes) return deleted
        await fs.rm(file.filePath, { force: true })
        totalBytes -= file.size
        deleted++
      }
    }
    return deleted
  }

  private async removeOlderVersions(
    folder: string,
    currentPath: string,
  ): Promise<void> {
    const currentName = path.basename(currentPath)
    const prefix = currentName.split('-').slice(0, 3).join('-') + '-'
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        entry.name !== currentName &&
        entry.name.startsWith(prefix) &&
        !entry.name.endsWith('.tmp')
      ) {
        await fs.rm(path.join(folder, entry.name), { force: true })
      }
    }
  }

  private async findExactCachedImage(
    folder: string,
    type: TmdbMediaType | 'person',
    id: number,
    size: string,
    imagePath: string,
  ): Promise<string | undefined> {
    const filePath = path.join(
      folder,
      this.getFilename(type, id, size, imagePath),
    )
    return (await this.fileExists(filePath)) ? filePath : undefined
  }

  private async findCachedImage(
    folder: string,
    type: TmdbMediaType | 'person',
    id: number,
    size: string,
  ): Promise<string | undefined> {
    const prefix = `${type}-${id}-${size}-`
    const matches = (await fs.readdir(folder, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.startsWith(prefix),
    )
    if (matches.length === 0) return undefined

    const candidates = await Promise.all(
      matches.map(async (entry) => {
        const filePath = path.join(folder, entry.name)
        return { filePath, mtimeMs: (await fs.stat(filePath)).mtimeMs }
      }),
    )
    return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath
  }

  private async findLegacyCachedImage(
    folder: string,
    type: TmdbMediaType | 'person',
    id: number,
    size: string,
  ): Promise<string | undefined> {
    const prefix = `${type}-${id}-${size}-legacy.`
    const entry = (await fs.readdir(folder, { withFileTypes: true })).find(
      (candidate) => candidate.isFile() && candidate.name.startsWith(prefix),
    )
    return entry ? path.join(folder, entry.name) : undefined
  }

  private getFilename(
    type: TmdbMediaType | 'person',
    id: number,
    size: string,
    imagePath: string,
  ): string {
    const extension = path.extname(imagePath).toLowerCase()
    const version = createHash('sha1')
      .update(imagePath)
      .digest('hex')
      .slice(0, 12)
    return `${type}-${id}-${size}-${version}${extension}`
  }

  private getFolder(
    scope: TmdbImageScope | 'actors',
    variant: TmdbImageVariant | 'profile',
  ): string {
    if (scope === 'actors') return path.join(this.cacheRoot, 'actors')
    return path.join(
      this.cacheRoot,
      scope,
      variant === 'poster' ? 'posters' : 'backdrops',
    )
  }

  private async ensureCacheDirectories(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.getFolder('library', 'poster'), { recursive: true }),
      fs.mkdir(this.getFolder('library', 'backdrop'), { recursive: true }),
      fs.mkdir(this.getFolder('discover', 'poster'), { recursive: true }),
      fs.mkdir(this.getFolder('discover', 'backdrop'), { recursive: true }),
      fs.mkdir(this.getFolder('actors', 'profile'), { recursive: true }),
    ])
  }

  private async migrateLegacyCacheFiles(): Promise<void> {
    const entries = await fs.readdir(this.cacheRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const mediaMatch = entry.name.match(
        /^(movie|show)-(\d+)-(poster|backdrop)-(w[^.]+)(\.[A-Za-z0-9]+)$/,
      )
      const actorMatch = entry.name.match(
        /^person-(\d+)-profile-(w[^.]+)(\.[A-Za-z0-9]+)$/,
      )
      if (mediaMatch) {
        const [, type, id, variant, size, extension] = mediaMatch
        const destination = path.join(
          this.getFolder('library', variant as TmdbImageVariant),
          `${type}-${id}-${size}-legacy${extension}`,
        )
        await this.moveIfDestinationMissing(
          path.join(this.cacheRoot, entry.name),
          destination,
        )
      } else if (actorMatch) {
        const [, id, size, extension] = actorMatch
        const destination = path.join(
          this.getFolder('actors', 'profile'),
          `person-${id}-${size}-legacy${extension}`,
        )
        await this.moveIfDestinationMissing(
          path.join(this.cacheRoot, entry.name),
          destination,
        )
      }
    }
  }

  private async moveIfDestinationMissing(
    source: string,
    destination: string,
  ): Promise<void> {
    if (await this.fileExists(destination)) {
      await fs.rm(source, { force: true })
      return
    }
    await fs.rename(source, destination)
  }

  private async touchIfNeeded(filePath: string): Promise<void> {
    const stats = await fs.stat(filePath)
    if (Date.now() - stats.mtimeMs > DAY_MS) {
      const now = new Date()
      await fs.utimes(filePath, now, now)
    }
  }

  private async isMarkerFresh(
    markerPath: string,
    maxAgeMs: number,
  ): Promise<boolean> {
    try {
      return Date.now() - (await fs.stat(markerPath)).mtimeMs < maxAgeMs
    } catch {
      return false
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private toCachedImage(
    filePath: string,
    scope: TmdbImageScope | 'actors',
    immutable: boolean,
  ): CachedTmdbImage {
    return {
      filePath,
      contentType: this.getImageContentType(path.extname(filePath)),
      browserMaxAgeSeconds: BROWSER_MAX_AGE_SECONDS[scope],
      immutable,
    }
  }

  private getImageContentType(extension: string): string {
    if (extension.toLowerCase() === '.png') return 'image/png'
    if (extension.toLowerCase() === '.webp') return 'image/webp'
    return 'image/jpeg'
  }

  private isValidId(id: number): boolean {
    return Number.isSafeInteger(id) && id > 0
  }

  private isValidImagePath(
    imagePath: string | undefined,
    optional = false,
  ): imagePath is string {
    if (!imagePath) return optional
    return /^\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(imagePath)
  }
}
