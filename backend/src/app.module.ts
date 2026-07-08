import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ServeStaticModule } from '@nestjs/serve-static'

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

@Module({
  imports: [
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

      host: 'localhost',

      port: 5433,

      username:
        'postgres',

      password:
        'postgres',

      database:
        'tapserve',

      entities: [
        Business,
        MenuItem,
        Order,
      ],

      synchronize: true,
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