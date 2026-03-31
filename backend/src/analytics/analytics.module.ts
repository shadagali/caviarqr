import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalyticsService } from './analytics.service'
import { AnalyticsController } from './analytics.controller'
import { Order } from '../order/order.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}