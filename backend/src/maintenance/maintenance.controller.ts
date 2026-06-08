import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
} from '@nestjs/common'
import { BusinessService } from '../business/business.service'

@Controller('maintenance')
export class MaintenanceController {
  constructor(private businessService: BusinessService) {}

  // 🔥 CREATE STORE + QR LINKS
  @Post('create-store')
  async createStore(
    @Body()
    body: {
      storeCode: string
      tables?: number
    },
  ) {
    const { storeCode } = body
    const tables = Number(body.tables || 10)

    // 🔒 VALIDATION
    if (!storeCode || storeCode.trim().length < 3) {
      throw new BadRequestException('Valid storeCode required')
    }

    if (tables <= 0 || tables > 100) {
      throw new BadRequestException('Tables must be between 1 and 100')
    }

    // 🔒 CHECK IF STORE EXISTS
    let business = await this.businessService.findByStoreCode(storeCode)

    // 🔥 CREATE IF NOT EXISTS
    if (!business) {
      business = await this.businessService.create({
        storeCode,
        email: `${storeCode}@caviarqr.com`,
        password: 'temp123', // owner should reset later
      })
    }

    // 🔥 FIXED TYPE (NO TS ERROR)
    const links: { table: number; url: string }[] = []

    for (let i = 1; i <= tables; i++) {
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

  // 🔥 GET ALL STORES
  @Get('stores')
  async getStores() {
    const stores = await this.businessService.getAllStoreCodes()

    return {
      success: true,
      count: stores.length,
      stores,
    }
  }
}