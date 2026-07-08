import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  BadRequestException,
  Query,
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
  // 🔥 ORDER HISTORY (60 DAYS)
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
  // 🚨 ACTION CENTER
  // =========================
  @Get('action-center/:storeCode')
  async getActionCenter(
    @Param('storeCode')
    storeCode: string,
  ) {
    return this.orderService.getActionCenter(
      storeCode,
    )
  }

  // =========================
  // 🔍 SEARCH ORDERS
  // =========================
  @Get('search/:storeCode')
  async searchOrders(
    @Param('storeCode')
    storeCode: string,

    @Query('q')
    query: string,
  ) {
    return this.orderService.searchOrders(
      storeCode,
      query,
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

  // =========================
  // ✅ RESOLVE OWNER ACTION
  // =========================
  @Patch('resolve/:id')
  async resolveOwnerAction(
    @Param('id')
    id: string,

    @Body('resolvedBy')
    resolvedBy = 'OWNER',
  ) {
    return this.orderService.resolveOwnerAction(
      Number(id),
      resolvedBy,
    )
  }

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
}