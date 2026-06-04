import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { resolveDatabasePath } from './databasePath'

const ormConfig: TypeOrmModuleOptions = {
  type: 'better-sqlite3',
  logging: false,
  database: resolveDatabasePath(),
  subscribers: ['./**/*.subscriber{.ts,.js}'],
  migrations:
    process.env.NODE_ENV === 'production'
      ? ['/opt/app/apps/server/dist/database/migrations/**/*{.js,.ts}']
      : ['./dist/database/migrations/**/*{.js,.ts}'],
  autoLoadEntities: true,
  migrationsRun: true,
}
export default ormConfig
