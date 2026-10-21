import {
  NestFactory,
} from '@nestjs/core'

import {
  AppModule,
} from '../app.module'

import {
  OrderArchiveService,
} from './order-archive.service'

async function main() {
  const app =
    await NestFactory
      .createApplicationContext(
        AppModule,
        {
          logger: [
            'error',
            'warn',
            'log',
          ],
        },
      )

  try {
    const service =
      app.get(
        OrderArchiveService,
      )

    const before =
      await service.status()

    console.log(
      'ARCHIVE_STATUS_BEFORE=' +
      JSON.stringify(before),
    )

    const result =
      await service.archiveAll(100)

    console.log(
      'ARCHIVE_RESULT=' +
      JSON.stringify(result),
    )

    const after =
      await service.status()

    console.log(
      'ARCHIVE_STATUS_AFTER=' +
      JSON.stringify(after),
    )

    console.log(
      '✓ ARCHIVE COPY FINISHED',
    )

    console.log(
      '✓ NO ORDER ROWS DELETED',
    )
  } finally {
    await app.close()
  }
}

main().catch(error => {
  console.error(
    'ARCHIVE_CLI_FAILED',
    error,
  )

  process.exit(1)
})
