import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common'

import { BusinessService } from './business.service'
import { BusinessDeletionReadinessService } from './business-deletion-readiness.service'

import type {
  Request,
} from 'express'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import type {
  OwnerRequest,
} from '../owner-auth/owner-session.guard'

@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService:
      BusinessService,
    private readonly deletionReadiness: BusinessDeletionReadinessService,
  ) {}

  @Post('delete-account/readiness')
  @UseGuards(OwnerSessionGuard)
  async checkAccountDeletion(
    @Req() request: OwnerRequest,
    @Body() body: { password?: string; storeCode?: string },
  ) {
    return this.deletionReadiness.check(
      request.owner!.businessId,
      request.owner!.storeCode,
      body,
    )
  }

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
      termsAccepted?: boolean
      termsVersion?: string
      privacyAcknowledged?: boolean
      privacyVersion?: string
    },

    @Req()
    request: Request,
  ) {
    return this.businessService.signup(
      body,
      {
        ipAddress:
          request.ip ||
          request.socket
            ?.remoteAddress ||
          null,

        userAgent:
          request.get(
            'user-agent',
          ) ||
          null,
      },
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
  @UseGuards(OwnerSessionGuard)
  async setCountryAndCurrency(
    @Req()
    request: OwnerRequest,

    @Body()
    body: {
      countryCode: string
    },
  ) {
    return this.businessService
      .setCountryAndCurrency(
        request.owner!.businessId,
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

  @Get('kitchen-password-status')
  @UseGuards(OwnerSessionGuard)
  async kitchenPasswordStatus(
    @Req()
    request: OwnerRequest,
  ) {
    return this.businessService
      .kitchenPasswordStatus(
        request.owner!.businessId,
      )
  }

  @Post('set-kitchen-password')
  @UseGuards(OwnerSessionGuard)
  async setKitchenPassword(
    @Req()
    request: OwnerRequest,

    @Body()
    body: {
      password: string
    },
  ) {
    return this.businessService
      .setKitchenPassword(
        request.owner!.businessId,
        body.password,
      )
  }

  // =========================
  // 🔥 DISABLE PASSWORD
  // =========================

  @Post(
    'disable-kitchen-password',
  )
  @UseGuards(OwnerSessionGuard)
  async disableKitchenPassword(
    @Req()
    request: OwnerRequest,
  ) {
    return this.businessService
      .disableKitchenPassword(
        request.owner!.businessId,
      )
  }

  // =========================
  // 🔥 SERVICE FEE
  // =========================

  @Post('set-service-fee')
  @UseGuards(OwnerSessionGuard)
  async setServiceFee(
    @Req()
    request: OwnerRequest,

    @Body()
    body: {
      fee: number
    },
  ) {
    return this.businessService
      .setServiceFee(
        request.owner!.businessId,
        Number(
          body.fee,
        ),
      )
  }

  // =========================
  // 🔥 BRANDING
  // =========================

  @Post('update-branding')
  @UseGuards(OwnerSessionGuard)
  async updateBranding(
    @Req()
    request: OwnerRequest,

    @Body()
    body: {
      name?: string
      logo?: string
    },
  ) {
    return this.businessService
      .updateBranding(
        request.owner!.businessId,
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
  @UseGuards(OwnerSessionGuard)
  async toggleOpen(
    @Req()
    request: OwnerRequest,
  ) {
    return this.businessService
      .toggleOpen(
        request.owner!.businessId,
      )
  }
}