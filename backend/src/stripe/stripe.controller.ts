import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common'

import {
  Throttle,
} from '@nestjs/throttler'

import {
  CreateCheckoutDto,
} from './dto/create-checkout.dto'

import {
  StripeBusinessDto,
} from './dto/stripe-business.dto'

import {
  StripeService,
} from './stripe.service'

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly service:
      StripeService,
  ) {}

  // =====================================
  // PUBLIC CUSTOMER CHECKOUT
  // =====================================

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  checkout(
    @Body()
    dto: CreateCheckoutDto,
  ) {
    return this.service
      .createCheckoutSession(dto)
  }

  // =====================================
  // OWNER STRIPE CONNECT ONBOARDING
  // =====================================

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  connect(
    @Body()
    dto: StripeBusinessDto,
  ) {
    return this.service
      .createConnectLink(
        dto.businessId,
      )
  }

  // =====================================
  // OWNER STRIPE DASHBOARD LINK
  // =====================================

  @Post('dashboard')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  dashboard(
    @Body()
    dto: StripeBusinessDto,
  ) {
    return this.service
      .getDashboardLink(
        dto.businessId,
      )
  }

  // =====================================
  // OWNER CONNECTED ACCOUNT BALANCE
  // =====================================

  @Get('balance')
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  balance(
    @Query()
    query: StripeBusinessDto,
  ) {
    return this.service
      .getBalance(
        query.businessId,
      )
  }

  // =====================================
  // PUBLIC SAFE STRIPE STATUS REFRESH
  // =====================================

  @Get('status')
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  async status(
    @Query()
    query: StripeBusinessDto,
  ) {
    const status =
      await this.service
        .isStripeReady(
          query.businessId,
        )

    /*
     * Do not expose the connected
     * Stripe account ID publicly.
     *
     * Calling isStripeReady() also
     * refreshes and persists the latest
     * Stripe readiness state.
     */
    return {
      connected:
        status.connected,

      charges_enabled:
        status.charges_enabled,

      payouts_enabled:
        status.payouts_enabled,

      details_submitted:
        status.details_submitted,

      ready:
        status.ready,

      issueActive:
        status.issueActive,

      message:
        status.message,
    }
  }
}