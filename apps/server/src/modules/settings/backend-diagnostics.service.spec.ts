jest.mock('../../app/config/databasePath', () => {
  const os = jest.requireActual<typeof import('os')>('os')
  const path = jest.requireActual<typeof import('path')>('path')
  const root = path.join(os.tmpdir(), `maintainerr-diagnostics-${process.pid}`)
  return {
    dataDir: root,
    resolveDatabasePath: () => path.join(root, 'maintainerr.sqlite'),
  }
})

jest.mock('../../app/config/imageCachePath', () => {
  const os = jest.requireActual<typeof import('os')>('os')
  const path = jest.requireActual<typeof import('path')>('path')
  return {
    resolveImageCachePath: () =>
      path.join(
        os.tmpdir(),
        `maintainerr-diagnostics-${process.pid}`,
        'cache',
        'tmdb',
      ),
  }
})

import { mkdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { DataSource } from 'typeorm'
import { dataDir, resolveDatabasePath } from '../../app/config/databasePath'
import { resolveImageCachePath } from '../../app/config/imageCachePath'
import { BackendDiagnosticsService } from './backend-diagnostics.service'
import { SettingsService } from './settings.service'

describe('BackendDiagnosticsService', () => {
  const dataSource = {
    isInitialized: true,
    query: jest.fn(),
    showMigrations: jest.fn(),
  } as unknown as jest.Mocked<DataSource>
  const settingsService = {
    image_cache_max_gb: 10,
  } as unknown as SettingsService
  const service = new BackendDiagnosticsService(dataSource, settingsService)

  beforeAll(async () => {
    await mkdir(path.join(dataDir, 'logs'), { recursive: true })
    await mkdir(path.join(dataDir, 'cache', 'tmdb'), { recursive: true })
    await writeFile(resolveDatabasePath(), 'test')
    await writeFile(path.join(resolveImageCachePath(), 'poster.jpg'), 'image')
  })

  beforeEach(() => {
    jest.clearAllMocks()
    dataSource.query.mockImplementation(async (query: string) => {
      if (query === 'PRAGMA quick_check') return [{ quick_check: 'ok' }]
      if (query === 'PRAGMA foreign_key_check') return []
      if (query.includes('COUNT(*)')) return [{ count: 1 }]
      if (query.includes('ruleJson')) return [{ id: 1, ruleJson: '{}' }]
      return []
    })
    dataSource.showMigrations.mockResolvedValue(false)
  })

  afterAll(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('checks the database, permissions, and available storage', async () => {
    const result = await service.run()

    expect(['success', 'warning']).toContain(result.status)
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'database', status: 'success' }),
        expect.objectContaining({ id: 'data-directory', status: 'success' }),
        expect.objectContaining({ id: 'logs-directory', status: 'success' }),
        expect.objectContaining({ id: 'image-cache', status: 'success' }),
        expect.objectContaining({ id: 'data-storage' }),
      ]),
    )
    expect(dataSource.query).toHaveBeenCalledWith('PRAGMA quick_check')
  })

  it('reports an SQLite integrity failure as an error', async () => {
    dataSource.query.mockImplementation(async (query: string) => {
      if (query === 'PRAGMA quick_check') {
        return [{ quick_check: 'database malformed' }]
      }
      if (query === 'PRAGMA foreign_key_check') return []
      if (query.includes('COUNT(*)')) return [{ count: 1 }]
      if (query.includes('ruleJson')) return []
      return []
    })

    const result = await service.run()

    expect(result.status).toBe('error')
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: 'database',
        status: 'error',
        message: expect.stringContaining('database malformed'),
      }),
    )
  })

  it('reports the image cache size against its configured limit', async () => {
    const usage = await service.getImageCacheUsage()

    expect(usage.usedBytes).toBe(5)
    expect(usage.limitBytes).toBe(10 * 1024 * 1024 * 1024)
    expect(usage.percentage).toBeGreaterThan(0)
  })

  it('reports invalid stored rule data', async () => {
    dataSource.query.mockImplementation(async (query: string) => {
      if (query === 'PRAGMA quick_check') return [{ quick_check: 'ok' }]
      if (query === 'PRAGMA foreign_key_check') return []
      if (query.includes('COUNT(*)')) return [{ count: 1 }]
      if (query.includes('ruleJson')) {
        return [{ id: 42, ruleJson: 'not-json' }]
      }
      return []
    })

    const result = await service.run()

    expect(result.status).toBe('error')
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        id: 'database-records',
        status: 'error',
        message: expect.stringContaining('IDs: 42'),
      }),
    )
  })
})
