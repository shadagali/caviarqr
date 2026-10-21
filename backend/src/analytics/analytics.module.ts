import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from '../order/order.entity'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { OwnerSessionGuard } from '../owner-auth/owner-session.guard'

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
    OwnerSessionGuard,
  ],

  exports: [
    AnalyticsService,
  ],
})
export class AnalyticsModule {}