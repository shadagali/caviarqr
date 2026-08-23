import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'
import { join } from 'path'

loadEnv({
  path: join(process.cwd(), '.env'),
})

function required(
  name: string,
  developmentFallback?: string,
): string {
  const isProduction =
    process.env.NODE_ENV === 'production'

  const value =
    process.env[name]?.trim()

  if (value) {
    return value
  }

  if (
    !isProduction &&
    developmentFallback !== undefined
  ) {
    return developmentFallback
  }

  throw new Error(
    `${name} is required.`,
  )
}

function positiveInteger(
  value: string,
  name: string,
): number {
  const parsed =
    Number.parseInt(value, 10)

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    )
  }

  return parsed
}

const isProduction =
  process.env.NODE_ENV === 'production'

const sslEnabled =
  process.env.DB_SSL === 'true'

const sslCaBase64 =
  process.env.DB_SSL_CA_BASE64?.trim()

const ssl = sslEnabled
  ? {
      rejectUnauthorized: true,
      ...(sslCaBase64
        ? {
            ca: Buffer.from(
              sslCaBase64,
              'base64',
            ).toString('utf8'),
          }
        : {}),
    }
  : false

export default new DataSource({
  type: 'postgres',

  host: required(
    'DB_HOST',
    'localhost',
  ),

  port: positiveInteger(
    required(
      'DB_PORT',
      '5433',
    ),
    'DB_PORT',
  ),

  username: required(
    'DB_USERNAME',
    'postgres',
  ),

  password: required(
    'DB_PASSWORD',
    'postgres',
  ),

  database: required(
    'DB_NAME',
    'tapserve',
  ),

  entities: [
    join(
      __dirname,
      '..',
      '**',
      '*.entity.{ts,js}',
    ),
  ],

  migrations: [
    join(
      __dirname,
      '..',
      'migrations',
      '*{.ts,.js}',
    ),
  ],

  synchronize: false,
  migrationsRun: false,

  ssl,

  logging: [
    'error',
    'warn',
    'migration',
  ],

  extra: {
    max: positiveInteger(
      process.env.DB_POOL_MAX || '10',
      'DB_POOL_MAX',
    ),

    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    keepAlive: true,

    application_name:
      isProduction
        ? 'caviarqr-migrations'
        : 'caviarqr-migrations-local',
  },
})