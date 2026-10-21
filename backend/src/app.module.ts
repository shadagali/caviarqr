import { Module } from '@nestjs/common'

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config'

import {
  TypeOrmModule,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm'

import {
  ServeStaticModule,
} from '@nestjs/serve-static'

import {
  ScheduleModule,
} from '@nestjs/schedule'

import {
  APP_GUARD,
} from '@nestjs/core'

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler'

import { join } from 'path'

import {
  BusinessModule,
} from './business/business.module'

import {
  MenuModule,
} from './menu/menu.module'

import {
  PublicModule,
} from './public/public.module'

import {
  OrderModule,
} from './order/order.module'

import {
  StripeModule,
} from './stripe/stripe.module'

import {
  ShopModule,
} from './shop/shop.module'

import {
  WebhookModule,
} from './webhook/webhook.module'

import {
  AnalyticsModule,
} from './analytics/analytics.module'

import {
  MaintenanceModule,
} from './maintenance/maintenance.module'

import {
  MaintenanceAuthModule,
} from './maintenance-auth/maintenance-auth.module'

import {
  HealthModule,
} from './health/health.module'

import {
  RefundModule,
} from './refund/refund.module'

import {
  SupportModule,
} from './support/support.module'

import {
  KitchenAuthModule,
} from './kitchen-auth/kitchen-auth.module'

import {
  Business,
} from './business/business.entity'

import {
  MenuItem,
} from './menu/menu.entity'

import {
  Order,
} from './order/order.entity'

import {
  PendingOrder,
} from './pending-order/pending-order.entity'

import {
  MaintenanceAdmin,
} from './maintenance-auth/maintenance-admin.entity'

import {
  RefundAttempt,
} from './refund/entities/refund-attempt.entity'

import {
  MarketingSubscriber,
} from './marketing/marketing-subscriber.entity'

import {
  MarketingCampaign,
} from './marketing/marketing-campaign.entity'

function parsePositiveInteger(
  value: string,
  variableName: string,
) {
  const parsed =
    Number.parseInt(value, 10)

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new Error(
      `${variableName} must be a positive integer.`,
    )
  }

  return parsed
}

function databaseOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  const isProduction =
    config.get<string>(
      'NODE_ENV',
    ) === 'production'

  function required(
    variableName: string,
    developmentFallback?: string,
  ) {
    const value =
      config.get<string>(
        variableName,
      )?.trim()

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
      `${variableName} is required.`,
    )
  }

  const port =
    parsePositiveInteger(
      required(
        'DB_PORT',
        '5433',
      ),
      'DB_PORT',
    )

  const poolMax =
    parsePositiveInteger(
      config.get<string>(
        'DB_POOL_MAX',
      ) || '10',
      'DB_POOL_MAX',
    )

  const sslEnabled =
    config.get<string>(
      'DB_SSL',
    ) === 'true'

  const sslCaBase64 =
    config.get<string>(
      'DB_SSL_CA_BASE64',
    )?.trim()

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

  return {
    type: 'postgres',

    host: required(
      'DB_HOST',
      'localhost',
    ),

    port,

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

    /*
     * Keep the explicit list for the
     * entities that already exist.
     *
     * autoLoadEntities also registers
     * future entities included through
     * TypeOrmModule.forFeature().
     */
    entities: [
      Business,
      MenuItem,
      Order,
      PendingOrder,
      MaintenanceAdmin,
      RefundAttempt,
      MarketingSubscriber,
      MarketingCampaign,
    ],

    autoLoadEntities: true,

    /*
     * Never let TypeORM silently modify
     * production or development schemas.
     * All schema changes use migrations.
     */
    synchronize: false,

    /*
     * Run migrations as a dedicated
     * deployment command—not independently
     * from every ECS container.
     */
    migrationsRun: false,

    migrations: [
      join(
        __dirname,
        'migrations',
        '*{.ts,.js}',
      ),
    ],

    ssl,

    retryAttempts: 10,
    retryDelay: 3_000,

    maxQueryExecutionTime:
      isProduction
        ? 2_000
        : 5_000,

    logging: [
      'error',
      'warn',
      'migration',
    ],

    extra: {
      max: poolMax,

      idleTimeoutMillis:
        30_000,

      connectionTimeoutMillis:
        5_000,

      statement_timeout:
        15_000,

      query_timeout:
        20_000,

      keepAlive: true,

      application_name:
        'caviarqr-api',
    },
  }
}

const developmentStaticUploads = [
  ServeStaticModule.forRoot({
    rootPath: join(
      __dirname,
      '..',
      'uploads',
    ),
    serveRoot: '/uploads',
  }),
]

import { MarketingModule } from './marketing/marketing.module'
import { SalesModule } from './sales/sales.module'

import { DemoRequestModule } from './demo-request/demo-request.module'

import {
  OrderArchiveModule,
} from './archive/order-archive.module'

@Module({
  imports: [
    MarketingModule,
    SalesModule,
    DemoRequestModule,

    ConfigModule.forRoot({
      isGlobal: true,

      cache: true,

      expandVariables: true,
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRootAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory: (
        config:
          ConfigService,
      ) => [
        {
          name: 'default',

          ttl:
            Number(
              config.get<string>(
                'THROTTLE_TTL_MS',
              ) || '60000',
            ),

          limit:
            Number(
              config.get<string>(
                'THROTTLE_LIMIT',
              ) || '600',
            ),

          blockDuration:
            60_000,
        },
      ],
    }),

    ...developmentStaticUploads,

    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory:
        databaseOptions,
    }),

    BusinessModule,
    KitchenAuthModule,
    MenuModule,
    PublicModule,
    OrderModule,
    StripeModule,
    ShopModule,

    /*
     * RefundModule must be loaded before
     * WebhookModule uses RefundService.
     */
    RefundModule,

    /*
     * Customer receipt/support chat.
     * SupportModule registers the support
     * entities through forFeature(), which
     * are picked up by autoLoadEntities.
     */
    SupportModule,

    WebhookModule,

    AnalyticsModule,
    MaintenanceAuthModule,
    MaintenanceModule,
    HealthModule,
    OrderArchiveModule,
  ],

  providers: [
    {
      provide:
        APP_GUARD,

      useClass:
        ThrottlerGuard,
    },
  ],
})
export class AppModule {}