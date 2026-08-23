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
    private readonly businessService:
      BusinessService,
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
  // 🔐 FORGOT PASSWORD
  // =========================

  @Post('forgot-password')
  async forgotPassword(
    @Body()
    body: {
      email: string
    },
  ) {
    return this.businessService
      .forgotPassword(
        String(
          body.email || '',
        ),
      )
  }

  // =========================
  // 🔐 RESET PASSWORD
  // =========================

  @Post('reset-password')
  async resetPassword(
    @Body()
    body: {
      token: string
      password: string
    },
  ) {
    return this.businessService
      .resetPassword(
        String(
          body.token || '',
        ),
        String(
          body.password || '',
        ),
      )
  }

  // =========================
  // 🔥 COUNTRY / CURRENCY
  // =========================

  @Patch(
    'country-currency/:businessId',
  )
  async setCountryAndCurrency(
    @Param('businessId')
    businessId: string,

    @Body()
    body: {
      countryCode: string
    },
  ) {
    return this.businessService
      .setCountryAndCurrency(
        Number(businessId),
        body.countryCode,
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
      password?: string
    },
  ) {
    return this.businessService
      .kitchenLogin(
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
    return this.businessService
      .setKitchenPassword(
        Number(
          body.businessId,
        ),
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
    return this.businessService
      .disableKitchenPassword(
        Number(
          body.businessId,
        ),
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
    return this.businessService
      .setServiceFee(
        Number(
          body.businessId,
        ),
        Number(
          body.fee,
        ),
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
    return this.businessService
      .updateBranding(
        Number(
          body.businessId,
        ),
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
    businessId: string,
  ) {
    return this.businessService
      .toggleOpen(
        Number(
          businessId,
        ),
      )
  }
}