import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { BusinessModule } from './business/business.module';
import { MenuModule } from './menu/menu.module';
import { OrderModule } from './order/order.module';
import { StripeModule } from './stripe/stripe.module';
import { PublicModule } from './public/public.module';
import { SetupModule } from './setup/setup.module';
import { WebhookModule } from './webhook/webhook.module';

// ❌ REMOVE THESE (IMPORTANT)
// import { BullModule } from '@nestjs/bullmq';
// import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5433,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'tapserve',
      autoLoadEntities: true,
      synchronize: true,
    }),

    // ❌ REMOVE BULLMQ COMPLETELY
    // BullModule.forRoot({
    //   connection: {
    //     host: 'localhost',
    //     port: 6379,
    //   },
    // }),

    // ❌ REMOVE QUEUE MODULE
    // QueueModule,

    BusinessModule,
    MenuModule,
    OrderModule,
    StripeModule,
    PublicModule,
    SetupModule,
    WebhookModule,
  ],
})
export class AppModule {}