import { Controller, Post, Body } from '@nestjs/common'
import { OrderService } from '../order/order.service'

@Controller('stripe')
export class StripeController {
  constructor(private orderService: OrderService) {}

  // 🔥 MAIN ENTRY (SAFE)
  @Post('checkout')
  async checkout(@Body() body: any) {
    return this.orderService.createOrder(body)
  }
}