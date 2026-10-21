import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'

import type {
  Request,
} from 'express'

import {
  SalesService,
} from './sales.service'

import {
  SalesPartnerGuard,
} from './sales-partner.guard'

import {
  SalesStripeService,
} from './sales-stripe.service'

import {
  SalesDashboardService,
} from './sales-dashboard.service'

import {
  SalesTaxReportService,
} from './sales-tax-report.service'

import type {
  SalesPartnerRequest,
} from './sales-partner.guard'

@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService:
      SalesService,

    private readonly salesStripeService:
      SalesStripeService,

    private readonly salesDashboardService:
      SalesDashboardService,

    private readonly salesTaxReportService:
      SalesTaxReportService,
  ) {}

  @Get('agreement')
  agreement() {
    return this.salesService.agreement()
  }

  @Post('signup')
  async signup(
    @Body()
    body: {
      email: string
      password: string
      legalName: string
      displayName?: string
      phone?: string
      agreementAccepted: boolean
      agreementVersion: string
    },

    @Req()
    request: Request,
  ) {
    const signupEnabled =
      String(
        process.env
          .SALES_SIGNUP_ENABLED ||
        '',
      )
        .trim()
        .toLowerCase() ===
      'true'

    if (!signupEnabled) {
      throw new ServiceUnavailableException(
        'Sales Partner signup is not currently available.',
      )
    }

    /*
     * Do not trust X-Forwarded-For directly.
     *
     * Express derives request.ip using the
     * configured trust-proxy policy. In
     * production the backend is bound only
     * to localhost and Caddy is the single
     * public reverse-proxy hop.
     */
    const ipAddress =
      request.ip ||
      null

    const userAgent =
      String(
        request.headers[
          'user-agent'
        ] || '',
      ).trim() ||
      null

    return this.salesService.signup(
      body,
      {
        ipAddress,
        userAgent,
      },
    )
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: {
      email: string
      password: string
    },
  ) {
    return this.salesService.login(
      body,
    )
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body()
    body: {
      email: string
    },
  ) {
    return this.salesService
      .forgotPassword(
        body.email,
      )
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body()
    body: {
      token: string
      password: string
    },
  ) {
    return this.salesService
      .resetPassword(
        body.token,
        body.password,
      )
  }

  @Get('me')
  @UseGuards(
    SalesPartnerGuard,
  )
  async me(
    @Req()
    request:
      SalesPartnerRequest,
  ) {
    return this.salesService.me(
      request
        .salesPartner!
        .id,
    )
  }

  @Get('dashboard')
  @UseGuards(
    SalesPartnerGuard,
  )
  async dashboard(
    @Req()
    request:
      SalesPartnerRequest,
  ) {
    return this
      .salesDashboardService
      .dashboard(
        request
          .salesPartner!
          .id,
      )
  }

  @Get('tax-summary')
  @UseGuards(
    SalesPartnerGuard,
  )
  async taxSummary(
    @Req()
    request:
      SalesPartnerRequest,

    @Query('year')
    year?: string,
  ) {
    return this
      .salesTaxReportService
      .partnerSummary(
        request
          .salesPartner!
          .id,
        year,
      )
  }

  @Get('stripe/status')
  @UseGuards(
    SalesPartnerGuard,
  )
  async stripeStatus(
    @Req()
    request:
      SalesPartnerRequest,
  ) {
    return this
      .salesStripeService
      .status(
        request
          .salesPartner!
          .id,
      )
  }

  @Post('stripe/onboarding')
  @HttpCode(200)
  @UseGuards(
    SalesPartnerGuard,
  )
  async stripeOnboarding(
    @Req()
    request:
      SalesPartnerRequest,
  ) {
    return this
      .salesStripeService
      .createOnboardingLink(
        request
          .salesPartner!
          .id,
      )
  }

  @Post('stripe/dashboard')
  @HttpCode(200)
  @UseGuards(
    SalesPartnerGuard,
  )
  async stripeDashboard(
    @Req()
    request:
      SalesPartnerRequest,
  ) {
    return this
      .salesStripeService
      .createDashboardLink(
        request
          .salesPartner!
          .id,
      )
  }
}
