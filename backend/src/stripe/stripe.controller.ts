import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'

import {
  Throttle,
} from '@nestjs/throttler'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import type {
  OwnerRequest,
} from '../owner-auth/owner-session.guard'

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
  @UseGuards(OwnerSessionGuard)
  connect(
    @Req()
    request: OwnerRequest,
  ) {
    return this.service
      .createConnectLink(
        request.owner!.businessId,
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
  @UseGuards(OwnerSessionGuard)
  dashboard(
    @Req()
    request: OwnerRequest,
  ) {
    return this.service
      .getDashboardLink(
        request.owner!.businessId,
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
  @UseGuards(OwnerSessionGuard)
  balance(
    @Req()
    request: OwnerRequest,
  ) {
    return this.service
      .getBalance(
        request.owner!.businessId,
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
  @UseGuards(OwnerSessionGuard)
  async status(
    @Req()
    request: OwnerRequest,
  ) {
    const status =
      await this.service
        .isStripeReady(
          request.owner!.businessId,
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