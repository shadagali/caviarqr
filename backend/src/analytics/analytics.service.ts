import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Order } from '../order/order.entity'

@Injectable()
export class AnalyticsService {

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>
  ) {}

  async getRevenue(businessId: number) {

    const orders = await this.orderRepo.find({
      where: { businessId: Number(businessId) }
    })

    const revenue = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0
    )

    return {
      revenue
    }

  }

  async getOrders(businessId: number) {

    return this.orderRepo.find({
      where: { businessId: Number(businessId) },
      order: { createdAt: 'DESC' }
    })

  }

}