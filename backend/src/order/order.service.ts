import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Order } from './order.entity';
import { OrderGateway } from './order.gateway';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    private gateway: OrderGateway,
  ) {}

  // 🔥 CREATE ORDER (ALREADY USED BEFORE PAYMENT)
  async createOrder(data: {
    businessId: number;
    storeCode: string;
    items: any[];
    totalAmount: number;
    platformFee: number;
    stripePaymentIntentId?: string;
  }) {
    const order = this.orderRepo.create({
      ...data,
      status: 'PENDING',
    });

    return await this.orderRepo.save(order);
  }

  // 🔥 CALLED FROM WEBHOOK
  async markOrderPaid(stripePaymentIntentId: string) {
    const order = await this.orderRepo.findOne({
      where: { stripePaymentIntentId },
    });

    if (!order) {
      this.logger.error('Order not found for payment');
      return;
    }

    // ✅ IDEMPOTENT
    if (order.status !== 'PENDING') {
      return;
    }

    // STEP 1 → PAID
    order.status = 'PAID';
    await this.orderRepo.save(order);

    // STEP 2 → NEW (AUTO ENTER KITCHEN)
    order.status = 'NEW';
    await this.orderRepo.save(order);

    // 🔥 REAL-TIME PUSH
    this.gateway.emitNewOrder(order.storeCode, order);

    this.logger.log(`Order ${order.id} entered kitchen`);
  }

  // 🔥 KITCHEN FETCH (POLLING FALLBACK)
  async getOrdersByStore(storeCode: string) {
    return this.orderRepo.find({
      where: {
        storeCode,
        status: Not('PENDING'), // ❗ NEVER show unpaid
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  // 🔥 UPDATE STATUS FROM KITCHEN
  async updateStatus(orderId: number, status: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    order.status = status;
    await this.orderRepo.save(order);

    // 🔥 REAL-TIME UPDATE
    this.gateway.emitOrderUpdate(order.storeCode, order);

    return order;
  }
}