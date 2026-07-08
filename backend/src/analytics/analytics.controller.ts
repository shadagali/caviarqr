import {
  Controller,
  Get,
  Param,
} from '@nestjs/common'

import { AnalyticsService } from './analytics.service'

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ====================================
  // DASHBOARD
  // ====================================

  @Get(
    'dashboard/:businessId',
  )
  getDashboard(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getDashboard(
      Number(businessId),
    )
  }

  // ====================================
  // TOP SELLING ITEMS
  // ====================================

  @Get(
    'top-items/:businessId',
  )
  getTopItems(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getTopItems(
      Number(businessId),
    )
  }

  // ====================================
  // REVENUE CHART
  // LAST 30 DAYS
  // ====================================

  @Get(
    'revenue-chart/:businessId',
  )
  getRevenueChart(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getRevenueChart(
      Number(businessId),
    )
  }

  // ====================================
  // RECENT ORDERS
  // ====================================

  @Get(
    'recent-orders/:businessId',
  )
  getRecentOrders(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getRecentOrders(
      Number(businessId),
    )
  }

  // ====================================
  // LEGACY ENDPOINTS
  // KEEP FOR COMPATIBILITY
  // ====================================

  @Get(
    'revenue/:businessId',
  )
  getRevenue(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getRevenue(
      Number(businessId),
    )
  }

  @Get(
    'orders/:businessId',
  )
  getOrders(
    @Param('businessId')
    businessId: string,
  ) {
    return this.analyticsService.getOrders(
      Number(businessId),
    )
  }

  @Get('stats')
  getStats() {
    return this.analyticsService.getStats()
  }
}