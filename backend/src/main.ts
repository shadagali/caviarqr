import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

import * as express from 'express'

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
      {
        rawBody: true,
      },
    )

  // 🔥 STRIPE RAW BODY
  app.use(
    '/webhook/stripe',
    express.raw({
      type: 'application/json',
    }),
  )

  // 🔥 NORMAL JSON FOR EVERYTHING ELSE
  app.use(express.json())

  app.enableCors()

  await app.listen(3001)

  console.log(
    '🚀 Backend running on http://localhost:3001',
  )
}

bootstrap()