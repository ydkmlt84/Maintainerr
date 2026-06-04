import * as fs from 'fs'
import path from 'path'

export const dataDir =
  process.env.NODE_ENV === 'production'
    ? '/opt/data'
    : path.join(__dirname, '../../../../../data')

const defaultDatabaseName = 'maintainerr.sqlite'
const databaseFilenamePattern = /^maintainerr.*\.sqlite$/i

export const resolveDatabasePath = () => {
  const defaultDatabasePath = path.join(dataDir, defaultDatabaseName)

  if (fs.existsSync(defaultDatabasePath)) {
    return defaultDatabasePath
  }

  if (!fs.existsSync(dataDir)) {
    return defaultDatabasePath
  }

  const matchingDatabases = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && databaseFilenamePattern.test(entry.name),
    )
    .map((entry) => entry.name)

  if (matchingDatabases.length === 0) {
    return defaultDatabasePath
  }

  if (matchingDatabases.length > 1) {
    throw new Error(
      `Multiple Maintainerr database files found in ${dataDir}: ${matchingDatabases.join(
        ', ',
      )}. Rename the database you want to use to ${defaultDatabaseName}.`,
    )
  }

  return path.join(dataDir, matchingDatabases[0])
}
