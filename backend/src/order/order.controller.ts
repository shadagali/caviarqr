import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'

import {
  OrderService,
} from './order.service'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import {
  RefundService,
} from '../refund/refund.service'

import type {
  OwnerRequest,
} from '../owner-auth/owner-session.guard'

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService:
      OrderService,

    private readonly refundService:
      RefundService,
  ) {}

  // =========================
  // OWNER ACTION CENTER
  // =========================

  @Get(
    'action-center/:storeCode',
  )
  @UseGuards(OwnerSessionGuard)
  async getActionCenter(
    @Req()
    request: OwnerRequest,

    @Param('storeCode')
    storeCode: string,
  ) {
    const businessId =
      Number(
        request.owner?.businessId,
      )

    const ownerStoreCode =
      String(
        request.owner?.storeCode ||
          '',
      )
        .trim()
        .toLowerCase()

    const requestedStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (
      !Number.isInteger(
        businessId,
      ) ||
      businessId < 1 ||
      !ownerStoreCode ||
      ownerStoreCode !==
        requestedStoreCode
    ) {
      throw new ForbiddenException(
        'You can only access your own cafe.',
      )
    }

    return this.orderService
      .getActionCenter(
        ownerStoreCode,
        businessId,
      )
  }

  // =========================
  // REFUND ORDER
  // =========================

  @Patch(
    'refund/:paymentIntentId',
  )
  @UseGuards(OwnerSessionGuard)
  async refundOrder(
    @Req()
    request: OwnerRequest,

    @Param('paymentIntentId')
    paymentIntentId: string,
  ) {
    const businessId =
      Number(
        request.owner?.businessId,
      )

    if (
      !Number.isInteger(
        businessId,
      ) ||
      businessId < 1
    ) {
      throw new ForbiddenException(
        'You can only refund your own cafe orders.',
      )
    }

    return this.refundService
      .createOwnerRefundByPaymentIntent(
        paymentIntentId,
        businessId,
        {
          requestedBy:
            `OWNER:${businessId}`,

          requestIp:
            null,

          userAgent:
            null,
        },
      )
  }

  // =========================
  // RESOLVE OWNER ACTION
  // =========================

  @Patch(
    'resolve/:id',
  )
  @UseGuards(OwnerSessionGuard)
  async resolveOwnerAction(
    @Req()
    request: OwnerRequest,

    @Param('id')
    id: string,
  ) {
    const businessId =
      Number(
        request.owner?.businessId,
      )

    if (
      !Number.isInteger(
        businessId,
      ) ||
      businessId < 1
    ) {
      throw new ForbiddenException(
        'You can only resolve your own cafe issues.',
      )
    }

    return this.orderService
      .resolveOwnerAction(
        Number(id),
        'OWNER',
        businessId,
      )
  }
}
