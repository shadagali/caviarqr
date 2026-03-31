import { Controller, Get, Param } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'

@Controller('analytics')
export class AnalyticsController {

  constructor(
    private analyticsService: AnalyticsService
  ) {}

  @Get('revenue/:businessId')
  getRevenue(@Param('businessId') businessId: string) {

    return this.analyticsService.getRevenue(Number(businessId))

  }

  @Get('orders/:businessId')
  getOrders(@Param('businessId') businessId: string) {

    return this.analyticsService.getOrders(Number(businessId))

  }

}