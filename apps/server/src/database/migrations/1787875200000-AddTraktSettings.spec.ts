import { DataSource } from 'typeorm'
import { AddTraktSettings1787875200000 } from './1787875200000-AddTraktSettings'

describe('AddTraktSettings1787875200000', () => {
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

  it('adds and removes all Trakt configuration columns', async () => {
    const migration = new AddTraktSettings1787875200000()
    const runner = dataSource.createQueryRunner()

    await migration.up(runner)
    const added = (await runner.query('PRAGMA table_info("settings")')) as {
      name: string
    }[]
    expect(added.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'trakt_client_id',
        'trakt_client_secret',
        'trakt_access_token',
        'trakt_refresh_token',
        'trakt_token_expires_at',
        'trakt_username',
      ]),
    )

    await migration.down(runner)
    const removed = (await runner.query('PRAGMA table_info("settings")')) as {
      name: string
    }[]
    expect(removed.map((column) => column.name)).toEqual(['id'])
    await runner.release()
  })
})
