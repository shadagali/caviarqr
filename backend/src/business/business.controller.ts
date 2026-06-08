import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common'

import { BusinessService } from './business.service'

@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
  ) {}

  // =========================
  // 🔥 SIGNUP
  // =========================
  @Post('signup')
  async signup(
    @Body()
    body: {
      email: string
      password: string
      storeCode: string
    },
  ) {
    return this.businessService.signup(
      body,
    )
  }

  // =========================
  // 🔥 LOGIN
  // =========================
  @Post('login')
  async login(
    @Body()
    body: {
      email: string
      password: string
    },
  ) {
    return this.businessService.login(
      body,
    )
  }

  // =========================
  // 🔥 KITCHEN LOGIN
  // =========================
  @Post('kitchen-login')
  async kitchenLogin(
    @Body()
    body: {
      storeCode: string
      password: string
    },
  ) {
    return this.businessService.kitchenLogin(
      body,
    )
  }

  // =========================
  // 🔥 SET KITCHEN PASSWORD
  // =========================
  @Post('set-kitchen-password')
  async setKitchenPassword(
    @Body()
    body: {
      businessId: number
      password: string
    },
  ) {
    return this.businessService.setKitchenPassword(
      body.businessId,
      body.password,
    )
  }

  // =========================
  // 🔥 DISABLE PASSWORD
  // =========================
  @Post(
    'disable-kitchen-password',
  )
  async disableKitchenPassword(
    @Body()
    body: {
      businessId: number
    },
  ) {
    return this.businessService.disableKitchenPassword(
      body.businessId,
    )
  }

  // =========================
  // 🔥 SERVICE FEE
  // =========================
  @Post('set-service-fee')
  async setServiceFee(
    @Body()
    body: {
      businessId: number
      fee: number
    },
  ) {
    return this.businessService.setServiceFee(
      body.businessId,
      body.fee,
    )
  }

  // =========================
  // 🔥 BRANDING
  // =========================
  @Post('update-branding')
  async updateBranding(
    @Body()
    body: {
      businessId: number
      name?: string
      logo?: string
    },
  ) {
    return this.businessService.updateBranding(
      body.businessId,
      body.name,
      body.logo,
    )
  }

  // =========================
  // 🔥 OPEN / CLOSE KITCHEN
  // =========================
  @Patch(
    'toggle-open/:businessId',
  )
  async toggleOpen(
    @Param('businessId')
    businessId: number,
  ) {
    return this.businessService.toggleOpen(
      Number(businessId),
    )
  }
}