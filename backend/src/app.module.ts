import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ScheduleModule } from '@nestjs/schedule'

import { APP_GUARD } from '@nestjs/core'

import {
  ThrottlerModule,
  ThrottlerGuard,
} from '@nestjs/throttler'

import { join } from 'path'

import { BusinessModule } from './business/business.module'
import { MenuModule } from './menu/menu.module'
import { PublicModule } from './public/public.module'
import { OrderModule } from './order/order.module'
import { StripeModule } from './stripe/stripe.module'
import { WebhookModule } from './webhook/webhook.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { MaintenanceModule } from './maintenance/maintenance.module'
import { HealthModule } from './health/health.module'

import { Business } from './business/business.entity'
import { MenuItem } from './menu/menu.entity'
import { Order } from './order/order.entity'
import { PendingOrder } from './pending-order/pending-order.entity'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    ServeStaticModule.forRoot({
      rootPath: join(
        __dirname,
        '..',
        'uploads',
      ),

      serveRoot:
        '/uploads',
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',

      host:
        process.env.DB_HOST ||
        'localhost',

      port:
        Number(
          process.env.DB_PORT ||
            5433,
        ),

      username:
        process.env.DB_USERNAME ||
        'postgres',

      password:
        process.env.DB_PASSWORD ||
        'postgres',

      database:
        process.env.DB_NAME ||
        'tapserve',

      entities: [
        Business,
        MenuItem,
        Order,
        PendingOrder,
      ],

      synchronize:
        process.env.NODE_ENV !==
        'production',
    }),

    BusinessModule,

    MenuModule,

    PublicModule,

    OrderModule,

    StripeModule,

    WebhookModule,

    AnalyticsModule,

    MaintenanceModule,

    HealthModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}