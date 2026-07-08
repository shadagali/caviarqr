import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  BadRequestException,
} from '@nestjs/common'

import { BusinessService } from '../business/business.service'
import { MaintenanceService } from './maintenance.service'

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private businessService: BusinessService,
    private maintenanceService: MaintenanceService,
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
    const { storeCode } = body

    const tables = Number(
      body.tables || 10,
    )

    if (
      !storeCode ||
      storeCode.trim().length < 3
    ) {
      throw new BadRequestException(
        'Valid storeCode required',
      )
    }

    if (
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
          email: `${storeCode}@caviarqr.com`,
          password: 'temp123',
        })
    }

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
        url: `http://localhost:3000/store/${storeCode}?table=${i}`,
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
      count: stores.length,
      stores,
    }
  }

  // =========================
  // 🔥 ACTION CENTER
  // =========================

  @Get('action-center')
  async getActionCenter() {
    return this.maintenanceService.getIssues()
  }

  // =========================
  // 🔥 ISSUES ONLY
  // =========================

  @Get('issues')
  async getIssues() {
    return this.maintenanceService.getIssues()
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
    return this.maintenanceService.getAllOrders()
  }

  // =========================
  // 🔥 GET CAFE DETAILS
  // =========================

  @Get('cafe/:storeCode')
  async getCafe(
    @Param('storeCode')
    storeCode: string,
  ) {
    return this.maintenanceService.getCafeDetails(
      storeCode,
    )
  }

  // =========================
  // 🔥 UPDATE PROCESSING FEE
  // =========================

  @Patch('cafe/:storeCode/processing-fee')
  async updateProcessingFee(
    @Param('storeCode')
    storeCode: string,

    @Body()
    body: {
      processingFeePercent: number
    },
  ) {
    return this.maintenanceService.updateProcessingFee(
      storeCode,
      body.processingFeePercent,
    )
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  @Patch('resolve/:id')
  async resolveIssue(
    @Param('id') id: string,
  ) {
    return this.maintenanceService.resolveIssue(
      Number(id),
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
      name: string
      note: string
    },
  ) {
    return this.maintenanceService.emailCustomer(
      body,
    )
  }
}