import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('order')
export class OrderController {
  constructor(private orderService: OrderService) {}

  // 🔥 POLLING ENDPOINT
  @Get(':storeCode')
  async getOrders(@Param('storeCode') storeCode: string) {
    return this.orderService.getOrdersByStore(storeCode);
  }

  // 🔥 UPDATE STATUS (KITCHEN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: number,
    @Body() body: { status: string },
  ) {
    return this.orderService.updateStatus(id, body.status);
  }
}