import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Order } from '../order/order.entity'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  // 🔥 TOTAL REVENUE FOR BUSINESS
  async getRevenue(businessId: number) {
    const orders = await this.orderRepo.find({
      where: { businessId },
    })

    const revenue = orders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0,
    )

    return { revenue }
  }

  // 🔥 TOTAL ORDERS FOR BUSINESS
  async getOrders(businessId: number) {
    const orders = await this.orderRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    })

    return orders
  }

  // 🔥 OPTIONAL GLOBAL STATS
  async getStats() {
    const orders = await this.orderRepo.find()

    return {
      totalOrders: orders.length,
      revenue: orders.reduce(
        (sum, o) => sum + Number(o.total || 0),
        0,
      ),
    }
  }
}