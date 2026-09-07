import {
  Logger,
  ValidationPipe,
} from '@nestjs/common'

import { NestFactory } from '@nestjs/core'

import type {
  NestExpressApplication,
} from '@nestjs/platform-express'

import helmet from 'helmet'

import { AppModule } from './app.module'

function normalizeOrigin(
  value: string,
) {
  return value
    .trim()
    .replace(/\/+$/, '')
}

function isDefined(
  value: string | undefined,
): value is string {
  return Boolean(
    value &&
      value.trim(),
  )
}

async function bootstrap() {
  const logger =
    new Logger('Bootstrap')

  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
      {
        rawBody: true,

        logger:
          process.env.NODE_ENV ===
          'production'
            ? [
                'error',
                'warn',
                'log',
              ]
            : [
                'error',
                'warn',
                'log',
                'debug',
                'verbose',
              ],
      },
    )

  // Required when running behind an
  // AWS Application Load Balancer.
  // This lets Express correctly read
  // the original IP and protocol.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', 1)

  app.enableShutdownHooks()

  // =====================================
  // SECURITY HEADERS
  // =====================================

  app.use(
    helmet({
      // Keep disabled only if menu images
      // or uploads are loaded cross-origin.
      crossOriginResourcePolicy:
        false,
    }),
  )

  // =====================================
  // REQUEST BODY PARSING
  // =====================================
  //
  // Nest retains the original JSON bytes
  // in request.rawBody because rawBody=true.
  //
  // Do not register express.raw() separately.
  // Do not register express.json() separately.

  app.useBodyParser(
    'json',
    {
      limit: '2mb',
    },
  )

  app.useBodyParser(
    'urlencoded',
    {
      limit: '2mb',
      extended: true,
    },
  )

  // =====================================
  // GLOBAL VALIDATION
  // =====================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted:
        true,

      transform: true,

      transformOptions: {
        enableImplicitConversion:
          false,
      },

      validationError: {
        target: false,
        value: false,
      },

      disableErrorMessages:
        process.env.NODE_ENV ===
        'production',
    }),
  )

  // =====================================
  // CORS
  // =====================================

  const allowedOrigins =
    [
      process.env.FRONTEND_URL,
      process.env.WEB_URL,

      process.env.NODE_ENV ===
      'production'
        ? 'https://www.caviarqr.com'
        : undefined,

      process.env.NODE_ENV !==
      'production'
        ? 'http://localhost:3000'
        : undefined,

      process.env.NODE_ENV !==
      'production'
        ? 'http://127.0.0.1:3000'
        : undefined,
    ]
      .filter(isDefined)
      .map(normalizeOrigin)

  app.enableCors({
    origin: (
      origin,
      callback,
    ) => {
      // Browserless requests such as
      // Stripe, curl and server-to-server
      // requests normally have no Origin.
      if (!origin) {
        callback(
          null,
          true,
        )
        return
      }

      const normalizedOrigin =
        normalizeOrigin(origin)

      if (
        allowedOrigins.includes(
          normalizedOrigin,
        )
      ) {
        callback(
          null,
          true,
        )
        return
      }

      logger.warn(
        `Blocked CORS origin: ${normalizedOrigin}`,
      )

      callback(
        new Error(
          'Origin is not permitted.',
        ),
        false,
      )
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
    ],

    exposedHeaders: [
      'Content-Length',
      'X-Request-Id',
    ],

    maxAge: 86_400,
  })

  const port =
    Number.parseInt(
      process.env.PORT ||
        '3001',
      10,
    )

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw new Error(
      'PORT must be a valid TCP port.',
    )
  }

  const host =
    process.env.HOST ||
    '0.0.0.0'

  await app.listen(
    port,
    host,
  )

  logger.log(
    `CaviarQR backend listening on ${host}:${port}`,
  )

  logger.log(
    `Environment: ${
      process.env.NODE_ENV ||
      'development'
    }`,
  )
}

bootstrap().catch(
  (error: unknown) => {
    const logger =
      new Logger('Bootstrap')

    logger.error(
      'CaviarQR backend failed to start.',
      error instanceof Error
        ? error.stack
        : String(error),
    )

    process.exit(1)
  },
)