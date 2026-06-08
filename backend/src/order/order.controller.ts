import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  BadRequestException,
} from '@nestjs/common'

import { OrderService } from './order.service'

import {
  OrderStatus,
} from './order.entity'

@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  // =========================
  // 🔥 ACTIVE KITCHEN ORDERS
  // =========================
  @Get(':storeCode')
  async getOrders(
    @Param('storeCode')
    storeCode: string,
  ) {
    return this.orderService.getOrdersByStore(
      storeCode,
    )
  }

  // =========================
  // 🔥 PAST ORDERS (24 HOURS)
  // =========================
  @Get('history/:storeCode')
  async getPastOrders(
    @Param('storeCode')
    storeCode: string,
  ) {
    return this.orderService.getPastOrders(
      storeCode,
    )
  }

  // =========================
  // 🔥 UPDATE STATUS
  // =========================
  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,

    @Body('status')
    status: OrderStatus,
  ) {
    if (!status) {
      throw new BadRequestException(
        'Status required',
      )
    }

    return this.orderService.updateStatus(
      Number(id),
      status,
    )
  }

  // =========================
  // 🔥 REFUND ORDER
  // =========================
  @Patch('refund/:paymentIntentId')
  async refundOrder(
    @Param('paymentIntentId')
    paymentIntentId: string,
  ) {
    return this.orderService.refundOrder(
      paymentIntentId,
    )
  }
}