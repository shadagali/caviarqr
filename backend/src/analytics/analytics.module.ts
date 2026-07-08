import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from '../order/order.entity'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
    ]),
  ],

  controllers: [
    AnalyticsController,
  ],

  providers: [
    AnalyticsService,
  ],

  exports: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}