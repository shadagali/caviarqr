import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common'

import { StripeService } from './stripe.service'

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly service: StripeService,
  ) {}

  // =========================
  // 🔥 CHECKOUT
  // =========================
  @Post('checkout')
  async checkout(
    @Body()
    body: {
      businessId: number
      storeCode: string
      tableNumber: number
      items: any[]
    },
  ) {
    return this.service.createCheckoutSession(
      body,
    )
  }

  // =========================
  // 🔥 CONNECT STRIPE
  // =========================
  @Post('connect')
  async connect(
    @Body()
    body: {
      businessId: number
    },
  ) {
    if (!body?.businessId) {
      throw new BadRequestException(
        'businessId required',
      )
    }

    return this.service.createConnectLink(
      Number(body.businessId),
    )
  }

  // =========================
  // 🔥 CONNECT (BROWSER TEST)
  // =========================
  @Get('connect')
  async connectGet(
    @Query('businessId')
    businessId: string,
  ) {
    const id = Number(
      businessId || 1,
    )

    if (!id) {
      throw new BadRequestException(
        'Invalid businessId',
      )
    }

    return this.service.createConnectLink(
      id,
    )
  }

  // =========================
  // 🔥 WITHDRAW / DASHBOARD
  // =========================
  @Get('dashboard')
  async dashboard(
    @Query('businessId')
    businessId: string,
  ) {
    const id = Number(
      businessId,
    )

    if (!id) {
      throw new BadRequestException(
        'Invalid businessId',
      )
    }

    return this.service.getDashboardLink(
      id,
    )
  }

  // =========================
  // 🔥 BALANCE
  // =========================
  @Get('balance')
  async balance(
    @Query('businessId')
    businessId: string,
  ) {
    const id = Number(
      businessId,
    )

    if (!id) {
      throw new BadRequestException(
        'Invalid businessId',
      )
    }

    return this.service.getBalance(
      id,
    )
  }

  // =========================
  // 🔥 STATUS
  // =========================
  @Get('status')
  async status(
    @Query('businessId')
    businessId: string,
  ) {
    const id = Number(
      businessId,
    )

    if (!id) {
      throw new BadRequestException(
        'Invalid businessId',
      )
    }

    return this.service.isStripeReady(
      id,
    )
  }

  // =========================
  // 🔥 REFUND
  // =========================
  @Post('refund')
  async refund(
    @Body()
    body: {
      paymentIntentId: string
    },
  ) {
    if (
      !body?.paymentIntentId
    ) {
      throw new BadRequestException(
        'paymentIntentId required',
      )
    }

    return this.service.refundOrder(
      body.paymentIntentId,
    )
  }
}