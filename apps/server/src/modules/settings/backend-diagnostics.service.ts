import {
  BackendDiagnosticCheck,
  BackendDiagnostics,
  ImageCacheUsage,
} from '@maintainerr/contracts'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { constants } from 'fs'
import { access, open, readdir, stat, statfs, unlink } from 'fs/promises'
import path from 'path'
import { DataSource } from 'typeorm'
import { dataDir, resolveDatabasePath } from '../../app/config/databasePath'
import { resolveImageCachePath } from '../../app/config/imageCachePath'
import { SettingsService } from './settings.service'

const GB = 1024 * 1024 * 1024

@Injectable()
export class BackendDiagnosticsService {
  private cachedImageBytes?: { bytes: number; expiresAt: number }
  private imageSizeLoad?: Promise<number>

  constructor(
    private readonly dataSource: DataSource,
    private readonly settingsService: SettingsService,
  ) {}

  public async run(): Promise<BackendDiagnostics> {
    const cacheDir = resolveImageCachePath()
    const storageChecks = await this.getStorageChecks(cacheDir)
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkDatabaseRecords(),
      this.checkWritableDirectory('data-directory', 'Data directory', dataDir),
      this.checkWritableDirectory(
        'logs-directory',
        'Log directory',
        path.join(dataDir, 'logs'),
      ),
      this.checkWritableDirectory(
        'image-cache',
        'Image cache directory',
        cacheDir,
      ),
      this.checkCacheCapacity(),
      ...storageChecks,
    ])

    const status = checks.some((check) => check.status === 'error')
      ? 'error'
      : checks.some((check) => check.status === 'warning')
        ? 'warning'
        : 'success'

    return { status, checkedAt: new Date().toISOString(), checks }
  }

  public async getImageCacheUsage(): Promise<ImageCacheUsage> {
    const usedBytes = await this.getImageCacheSize()
    const configuredLimit = Number(this.settingsService.image_cache_max_gb)
    const limitBytes =
      (Number.isFinite(configuredLimit) && configuredLimit > 0
        ? configuredLimit
        : 10) * GB
    return {
      usedBytes,
      limitBytes,
      remainingBytes: Math.max(0, limitBytes - usedBytes),
      percentage: limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0,
    }
  }

  private async getStorageChecks(
    cacheDir: string,
  ): Promise<Promise<BackendDiagnosticCheck>[]> {
    const checks = [
      this.checkDiskSpace('data-storage', 'Application storage', dataDir),
    ]
    try {
      const [dataStats, cacheStats] = await Promise.all([
        stat(dataDir),
        stat(cacheDir),
      ])
      if (dataStats.dev !== cacheStats.dev) {
        checks.push(
          this.checkDiskSpace('cache-storage', 'Image cache storage', cacheDir),
        )
      }
    } catch {
      // The directory checks will report a missing or inaccessible path.
    }
    return checks
  }

  private async checkDatabase(): Promise<BackendDiagnosticCheck> {
    const databasePath = resolveDatabasePath()
    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('The database connection is not initialized.')
      }
      await access(databasePath, constants.R_OK | constants.W_OK)
      const result = (await this.dataSource.query(
        'PRAGMA quick_check',
      )) as Record<string, unknown>[]
      const integrityResult = String(
        result[0]?.quick_check ?? Object.values(result[0] ?? {})[0] ?? '',
      )
      if (integrityResult.toLowerCase() !== 'ok') {
        return {
          id: 'database',
          title: 'Database',
          status: 'error',
          message: `SQLite reported an integrity problem: ${integrityResult || 'unknown result'}.`,
        }
      }
      if (await this.dataSource.showMigrations()) {
        return {
          id: 'database',
          title: 'Database',
          status: 'warning',
          message:
            'The database is healthy, but one or more migrations are pending.',
        }
      }
      return {
        id: 'database',
        title: 'Database',
        status: 'success',
        message: 'SQLite integrity and migration checks passed.',
      }
    } catch (error) {
      return {
        id: 'database',
        title: 'Database',
        status: 'error',
        message: this.errorMessage(error, 'The database health check failed.'),
      }
    }
  }

  private async checkDatabaseRecords(): Promise<BackendDiagnosticCheck> {
    try {
      const foreignKeyProblems = (await this.dataSource.query(
        'PRAGMA foreign_key_check',
      )) as unknown[]
      const settingsCountResult = (await this.dataSource.query(
        'SELECT COUNT(*) AS count FROM "settings"',
      )) as { count: number | string }[]
      const settingsCount = Number(settingsCountResult[0]?.count ?? 0)
      const rules = (await this.dataSource.query(
        'SELECT "id", "ruleJson" FROM "rules"',
      )) as { id: number; ruleJson: string }[]
      const invalidRuleIds = rules
        .filter((rule) => {
          try {
            JSON.parse(rule.ruleJson)
            return false
          } catch {
            return true
          }
        })
        .map((rule) => rule.id)

      const problems: string[] = []
      if (foreignKeyProblems.length > 0) {
        problems.push(
          `${foreignKeyProblems.length} orphaned database relationship${foreignKeyProblems.length === 1 ? '' : 's'}`,
        )
      }
      if (settingsCount !== 1) {
        problems.push(
          settingsCount === 0
            ? 'the settings record is missing'
            : `${settingsCount} settings records exist instead of one`,
        )
      }
      if (invalidRuleIds.length > 0) {
        problems.push(
          `${invalidRuleIds.length} rule${invalidRuleIds.length === 1 ? '' : 's'} contain invalid stored data (IDs: ${invalidRuleIds.slice(0, 10).join(', ')}${invalidRuleIds.length > 10 ? ', …' : ''})`,
        )
      }

      return problems.length > 0
        ? {
            id: 'database-records',
            title: 'Database records',
            status: 'error',
            message: `Found ${problems.join('; ')}.`,
          }
        : {
            id: 'database-records',
            title: 'Database records',
            status: 'success',
            message:
              'Relationships, settings, and stored rule data are consistent.',
          }
    } catch (error) {
      return {
        id: 'database-records',
        title: 'Database records',
        status: 'error',
        message: this.errorMessage(
          error,
          'Stored database records could not be validated.',
        ),
      }
    }
  }

  private async checkCacheCapacity(): Promise<BackendDiagnosticCheck> {
    try {
      const usage = await this.getImageCacheUsage()
      return {
        id: 'image-cache-capacity',
        title: 'Image cache capacity',
        status: usage.percentage >= 75 ? 'warning' : 'success',
        message:
          usage.percentage >= 75
            ? `The image cache is ${usage.percentage.toFixed(0)}% full with ${this.formatBytes(usage.remainingBytes)} remaining.`
            : `The image cache is ${usage.percentage.toFixed(0)}% full.`,
      }
    } catch (error) {
      return {
        id: 'image-cache-capacity',
        title: 'Image cache capacity',
        status: 'error',
        message: this.errorMessage(
          error,
          'Image cache usage could not be read.',
        ),
      }
    }
  }

  private async getImageCacheSize(): Promise<number> {
    if (this.cachedImageBytes && this.cachedImageBytes.expiresAt > Date.now()) {
      return this.cachedImageBytes.bytes
    }
    if (this.imageSizeLoad !== undefined) return this.imageSizeLoad

    this.imageSizeLoad = this.directorySize(resolveImageCachePath())
      .then((bytes) => {
        this.cachedImageBytes = { bytes, expiresAt: Date.now() + 30_000 }
        return bytes
      })
      .finally(() => {
        this.imageSizeLoad = undefined
      })
    return this.imageSizeLoad
  }

  private async directorySize(directory: string): Promise<number> {
    const entries = await readdir(directory, { withFileTypes: true })
    let total = 0
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) total += await this.directorySize(entryPath)
      else if (entry.isFile()) total += (await stat(entryPath)).size
    }
    return total
  }

  private async checkWritableDirectory(
    id: string,
    title: string,
    directory: string,
  ): Promise<BackendDiagnosticCheck> {
    const probePath = path.join(
      directory,
      `.maintainerr-permission-check-${randomUUID()}`,
    )
    let probeCreated = false
    try {
      await access(directory, constants.R_OK | constants.W_OK)
      const probe = await open(probePath, 'wx')
      probeCreated = true
      await probe.close()
      await unlink(probePath)
      probeCreated = false
      return {
        id,
        title,
        status: 'success',
        message: `Read, write, and delete access confirmed for ${directory}.`,
      }
    } catch (error) {
      return {
        id,
        title,
        status: 'error',
        message: `${this.errorMessage(error, 'The permission check failed.')} (${directory})`,
      }
    } finally {
      if (probeCreated) await unlink(probePath).catch(() => undefined)
    }
  }

  private async checkDiskSpace(
    id: string,
    title: string,
    directory: string,
  ): Promise<BackendDiagnosticCheck> {
    try {
      const storage = await statfs(directory)
      const available = storage.bavail * storage.bsize
      const total = storage.blocks * storage.bsize
      const availablePercent = total > 0 ? (available / total) * 100 : 0
      const availableLabel = this.formatBytes(available)
      const status =
        available < GB
          ? 'error'
          : available < 5 * GB || availablePercent < 5
            ? 'warning'
            : 'success'
      return {
        id,
        title,
        status,
        message:
          status === 'success'
            ? `${availableLabel} available (${availablePercent.toFixed(0)}% free).`
            : `Only ${availableLabel} is available (${availablePercent.toFixed(1)}% free).`,
      }
    } catch (error) {
      return {
        id,
        title,
        status: 'error',
        message: this.errorMessage(
          error,
          'Available disk space could not be checked.',
        ),
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }
}
