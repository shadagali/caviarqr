import { Controller, Post, Body, Get, Param } from '@nestjs/common'
import { BusinessService } from './business.service'

@Controller('business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  // 🔐 REGISTER
  @Post('register')
  async register(@Body() body: any) {
    return this.businessService.register(body)
  }

  // 🔐 LOGIN (FIXED)
  @Post('login')
  async login(@Body() body: any) {
    return this.businessService.login(
      body.storeCode,
      body.password,
    )
  }

  // 💰 EARNINGS
  @Get('earnings/:storeCode')
  async getEarnings(@Param('storeCode') storeCode: string) {
    return this.businessService.getEarnings(storeCode)
  }

  // 💸 WITHDRAW
  @Post('withdraw/:storeCode')
  async withdraw(@Param('storeCode') storeCode: string) {
    return this.businessService.withdraw(storeCode)
  }
}