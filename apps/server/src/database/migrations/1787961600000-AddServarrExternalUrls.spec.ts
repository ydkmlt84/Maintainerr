import { DataSource } from 'typeorm'
import { AddServarrExternalUrls1787961600000 } from './1787961600000-AddServarrExternalUrls'

describe('AddServarrExternalUrls1787961600000', () => {
  let dataSource: DataSource

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    })
    await dataSource.initialize()
    await dataSource.query(
      'CREATE TABLE "radarr_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    )
    await dataSource.query(
      'CREATE TABLE "sonarr_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    )
  })

  afterEach(async () => {
    await dataSource.destroy()
  })

  it('adds and removes browser-facing URL columns', async () => {
    const migration = new AddServarrExternalUrls1787961600000()
    const runner = dataSource.createQueryRunner()

    await migration.up(runner)
    const radarrAdded = (await runner.query(
      'PRAGMA table_info("radarr_settings")',
    )) as { name: string }[]
    const sonarrAdded = (await runner.query(
      'PRAGMA table_info("sonarr_settings")',
    )) as { name: string }[]
    expect(radarrAdded.map((column) => column.name)).toContain('externalUrl')
    expect(sonarrAdded.map((column) => column.name)).toContain('externalUrl')

    await migration.down(runner)
    const radarrRemoved = (await runner.query(
      'PRAGMA table_info("radarr_settings")',
    )) as { name: string }[]
    const sonarrRemoved = (await runner.query(
      'PRAGMA table_info("sonarr_settings")',
    )) as { name: string }[]
    expect(radarrRemoved.map((column) => column.name)).toEqual(['id'])
    expect(sonarrRemoved.map((column) => column.name)).toEqual(['id'])
    await runner.release()
  })
})
