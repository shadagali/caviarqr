import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { OwnerSessionGuard } from '../owner-auth/owner-session.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Business,
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