import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common'

import {
  AnalyticsService,
} from './analytics.service'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import type {
  OwnerRequest,
} from '../owner-auth/owner-session.guard'

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService:
      AnalyticsService,
  ) {}

  // ====================================
  // DASHBOARD
  // ====================================

  @Get(
    'dashboard/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getDashboard(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getDashboard(
        request.owner!.businessId,
      )
  }

  // ====================================
  // TOP SELLING ITEMS
  // ====================================

  @Get(
    'top-items/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getTopItems(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getTopItems(
        request.owner!.businessId,
      )
  }

  // ====================================
  // REVENUE CHART
  // ====================================

  @Get(
    'revenue-chart/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getRevenueChart(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getRevenueChart(
        request.owner!.businessId,
      )
  }

  // ====================================
  // RECENT ORDERS
  // ====================================

  @Get(
    'recent-orders/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getRecentOrders(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getRecentOrders(
        request.owner!.businessId,
      )
  }

  // ====================================
  // LEGACY ENDPOINTS
  // URLs kept for compatibility.
  // Signed owner cafe is authoritative.
  // ====================================

  @Get(
    'revenue/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getRevenue(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getRevenue(
        request.owner!.businessId,
      )
  }

  @Get(
    'orders/:businessId',
  )
  @UseGuards(OwnerSessionGuard)
  getOrders(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getOrders(
        request.owner!.businessId,
      )
  }

  // Previously returned data across ALL cafes.
  // Preserve response shape but scope it to
  // the authenticated owner's cafe.
  @Get('stats')
  @UseGuards(OwnerSessionGuard)
  getStats(
    @Req()
    request: OwnerRequest,
  ) {
    return this.analyticsService
      .getStats(
        request.owner!.businessId,
      )
  }
}
