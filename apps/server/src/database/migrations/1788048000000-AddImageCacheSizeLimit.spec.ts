import { DataSource } from 'typeorm'
import { AddImageCacheSizeLimit1788048000000 } from './1788048000000-AddImageCacheSizeLimit'

describe('AddImageCacheSizeLimit1788048000000', () => {
  let dataSource: DataSource

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    })
    await dataSource.initialize()
    await dataSource.query(
      'CREATE TABLE "settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    )
  })

  afterEach(async () => {
    await dataSource.destroy()
  })

  it('adds and removes the image cache size limit', async () => {
    const migration = new AddImageCacheSizeLimit1788048000000()
    const runner = dataSource.createQueryRunner()

    await migration.up(runner)
    const columns = (await runner.query('PRAGMA table_info("settings")')) as {
      name: string
      dflt_value: string
    }[]
    expect(
      columns.find((column) => column.name === 'image_cache_max_gb'),
    ).toMatchObject({ dflt_value: '10' })

    await migration.down(runner)
    const remaining = (await runner.query('PRAGMA table_info("settings")')) as {
      name: string
    }[]
    expect(remaining.map((column) => column.name)).toEqual(['id'])
    await runner.release()
  })
})
