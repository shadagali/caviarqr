import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common'

import { BusinessService } from '../business/business.service'
import { MaintenanceService } from './maintenance.service'
import { MaintenanceJwtGuard } from '../maintenance-auth/maintenance-jwt.guard'

@Controller('maintenance')
@UseGuards(MaintenanceJwtGuard)
export class MaintenanceController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  // =========================
  // 🔥 CREATE STORE + QR LINKS
  // =========================

  @Post('create-store')
  async createStore(
    @Body()
    body: {
      storeCode: string
      tables?: number
    },
  ) {
    const storeCode =
      String(body?.storeCode || '')
        .trim()
        .toLowerCase()

    const tables =
      Number(body?.tables || 10)

    if (
      !storeCode ||
      storeCode.length < 3
    ) {
      throw new BadRequestException(
        'Valid storeCode required',
      )
    }

    if (
      Number.isNaN(tables) ||
      tables <= 0 ||
      tables > 100
    ) {
      throw new BadRequestException(
        'Tables must be between 1 and 100',
      )
    }

    let business =
      await this.businessService.findByStoreCode(
        storeCode,
      )

    if (!business) {
      business =
        await this.businessService.create({
          storeCode,
          email:
            `${storeCode}@caviarqr.com`,
          password:
            'temp123',
        })
    }

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.WEB_URL ||
      'http://localhost:3000'

    const cleanFrontendUrl =
      frontendUrl.replace(
        /\/+$/,
        '',
      )

    const links: {
      table: number
      url: string
    }[] = []

    for (
      let i = 1;
      i <= tables;
      i++
    ) {
      links.push({
        table: i,
        url:
          `${cleanFrontendUrl}/store/${storeCode}?table=${i}`,
      })
    }

    return {
      success: true,
      storeCode,
      tables,
      links,
    }
  }

  // =========================
  // 🔥 GET STORES
  // =========================

  @Get('stores')
  async getStores() {
    const stores =
      await this.businessService.getAllStoreCodes()

    return {
      success: true,
      count:
        stores.length,
      stores,
    }
  }

  // =========================
  // 🔥 ACTION CENTER
  // =========================

  @Get('action-center')
  async getActionCenter() {
    const issues =
      await this.maintenanceService.getIssues()

    return {
      success: true,
      issues,
    }
  }

  // =========================
  // 🔥 ISSUES ONLY
  // =========================

  @Get('issues')
  async getIssues() {
    const issues =
      await this.maintenanceService.getIssues()

    return {
      success: true,
      issues,
    }
  }

  // =========================
  // 🔥 RECONCILE PENDING ORDERS
  // =========================

  @Post('reconcile-pending-orders')
  async reconcilePendingOrders() {
    return this.maintenanceService.reconcilePendingOrders()
  }

  // =========================
  // 🔥 DASHBOARD STATS
  // =========================

  @Get('stats')
  async getStats() {
    return this.maintenanceService.getDashboardStats()
  }

  // =========================
  // 🔥 ALL ORDERS
  // =========================

  @Get('orders')
  async getAllOrders() {
    const orders =
      await this.maintenanceService.getAllOrders()

    return {
      success: true,
      orders,
    }
  }

  // =========================
  // 🔥 GET CAFE DETAILS
  // =========================

  @Get('cafe/:storeCode')
  async getCafe(
    @Param('storeCode')
    storeCode: string,
  ) {
    const cleanStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    const data =
      await this.maintenanceService.getCafeDetails(
        cleanStoreCode,
      )

    return {
      success: true,
      ...data,
    }
  }

  // =========================
  // 🔥 UPDATE PROCESSING FEE
  // =========================

  @Patch(
    'cafe/:storeCode/processing-fee',
  )
  async updateProcessingFee(
    @Param('storeCode')
    storeCode: string,

    @Body()
    body: {
      processingFeePercent: number
    },
  ) {
    const cleanStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    const fee =
      Number(
        body?.processingFeePercent,
      )

    if (Number.isNaN(fee)) {
      throw new BadRequestException(
        'Valid processing fee is required.',
      )
    }

    return this.maintenanceService.updateProcessingFee(
      cleanStoreCode,
      fee,
    )
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  @Patch('resolve/:id')
  async resolveIssue(
    @Param('id')
    id: string,
  ) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    return this.maintenanceService.resolveIssue(
      orderId,
    )
  }

  // =========================
  // 💳 REFUND ORDER
  // =========================

  @Patch('refund/:id')
  async refundOrder(
    @Param('id')
    id: string,

    @Body()
    body: {
      reason?: string
    },
  ) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const reason =
      String(
        body?.reason ||
          'Refunded by CaviarQR maintenance.',
      ).trim()

    return this.maintenanceService.refundOrder(
      orderId,
      {
        reason,
        performedBy:
          'MAINTENANCE_ADMIN',
      },
    )
  }

  // =========================
  // 🔥 EMAIL CUSTOMER
  // =========================

  @Post('email-customer')
  async emailCustomer(
    @Body()
    body: {
      orderId: number
      email: string
      name?: string
      note: string
    },
  ) {
    return this.maintenanceService.emailCustomer(
      body,
    )
  }

  // =========================
  // 🔥 CAVIARQR PLATFORM BALANCE
  // =========================

  @Get('platform-balance')
  async getPlatformBalance() {
    return this.maintenanceService.getPlatformBalance()
  }

  // =========================
  // 🔥 WITHDRAW CAVIARQR COMMISSION
  // =========================

  @Post('platform-withdraw')
  async withdrawPlatformBalance(
    @Body()
    body: {
      amount?: number
    },
  ) {
    return this.maintenanceService.withdrawPlatformBalance(
      body?.amount,
    )
  }
}