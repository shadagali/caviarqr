import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'

import { AppModule } from './app.module'

import * as express from 'express'
import helmet from 'helmet'

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
      {
        rawBody: true,
      },
    )

  // =====================================
  // SECURITY HEADERS
  // =====================================

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  )

  // =====================================
  // STRIPE RAW BODY
  // MUST COME BEFORE JSON PARSER
  // =====================================

  app.use(
    '/webhook/stripe',
    express.raw({
      type:
        'application/json',
    }),
  )

  // =====================================
  // NORMAL JSON
  // =====================================

  app.use(express.json())

  // =====================================
  // VALIDATION
  // =====================================

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,
    }),
  )

  // =====================================
  // CORS
  // =====================================

  app.enableCors({
    origin: true,
    credentials: true,
  })

  await app.listen(3001)

  console.log(
    '🚀 Backend running on http://localhost:3001',
  )
}

bootstrap()