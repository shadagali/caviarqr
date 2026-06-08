import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'

import {
  Repository,
} from 'typeorm'

import Stripe from 'stripe'

import {
  Order,
  OrderStatus,
} from './order.entity'

import { OrderGateway } from './order.gateway'

@Injectable()
export class OrderService {
  private readonly logger =
    new Logger(OrderService.name)

  private stripe: Stripe

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    private gateway: OrderGateway,
  ) {
    console.log(
      '🔥 ORDER SERVICE STARTED',
    )

    this.stripe = new Stripe(
      'sk_test_51Sxh4AKZAB5HMPha5usVVKGeyWcWBEqiFjVMGwPCVOFbbx56mJaJOcZrObsxj35zM92583ovMqnfGUI31JcL1rbP00TUzKY5xh',
      {
        apiVersion:
          '2026-02-25.clover',
      },
    )
  }

  // =========================
  // 🔥 CREATE ORDER
  // =========================
  async createOrder(data: {
    businessId: number
    storeCode?: string
    tableNumber?: number
    items: any[]
    total: number
    stripePaymentIntentId: string
  }) {
    try {
      const existing =
        await this.orderRepo.findOne({
          where: {
            stripePaymentIntentId:
              data.stripePaymentIntentId,
          },
        })

      if (existing) {
        this.logger.warn(
          `Duplicate order prevented: ${data.stripePaymentIntentId}`,
        )

        return existing
      }

      const platformFee = +(
        data.total * 0.0075
      ).toFixed(2)

      const order =
        new Order()

      order.businessId =
        data.businessId

      order.storeCode =
        data.storeCode || ''

      order.tableNumber =
        data.tableNumber || 0

      order.items = data.items

      order.total = data.total

      order.platformFee =
        platformFee

      order.stripePaymentIntentId =
        data.stripePaymentIntentId

      order.status =
        OrderStatus.NEW

      const saved =
        await this.orderRepo.save(
          order,
        )

      try {
        this.gateway.emitNewOrder(
          data.businessId,
          saved,
        )
      } catch (err) {
        console.log(
          'Socket emit failed',
        )
      }

      this.logger.log(
        `✅ Order created: ${saved.id}`,
      )

      return saved
    } catch (err) {
      this.logger.error(
        'Error creating order',
        err,
      )

      throw err
    }
  }

  // =========================
  // 🔥 UPDATE STATUS
  // =========================
  async updateStatus(
    id: number,
    status: OrderStatus,
  ) {
    try {
      const order =
        await this.orderRepo.findOne({
          where: { id },
        })

      if (!order) {
        throw new BadRequestException(
          'Order not found',
        )
      }

      console.log(
        '🔥 STATUS UPDATE REQUEST',
        {
          orderId: id,
          oldStatus: order.status,
          newStatus: status,
          time: new Date().toISOString(),
        },
      )

      order.status = status

      const saved =
        await this.orderRepo.save(
          order,
        )

      console.log(
        '🔥 STATUS UPDATED',
        {
          orderId: saved.id,
          status: saved.status,
        },
      )

      try {
        this.gateway.emitOrderUpdate(
          order.businessId,
          saved,
        )
      } catch (err) {
        console.log(
          'Socket update failed',
        )
      }

      return saved
    } catch (err) {
      this.logger.error(
        'Error updating order status',
        err,
      )

      throw err
    }
  }

  // =========================
  // 🔥 GET ORDERS
  // =========================
  async getOrdersByStore(
    storeCode: string,
  ) {
    try {
      return await this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .where(
          'order.storeCode = :storeCode',
          {
            storeCode,
          },
        )
        .andWhere(
          'order.status != :done',
          {
            done:
              OrderStatus.DONE,
          },
        )
        .andWhere(
          'order.status != :refunded',
          {
            refunded:
              OrderStatus.REFUNDED,
          },
        )
        .orderBy(
          'order.id',
          'DESC',
        )
        .getMany()
    } catch (err) {
      this.logger.error(
        'Error fetching orders',
        err,
      )

      throw err
    }
  }

  // =========================
  // 🔥 PAST ORDERS (24 HOURS)
  // =========================
  async getPastOrders(
    storeCode: string,
  ) {
    try {
      console.log(
        '🔥 HISTORY REQUEST:',
        storeCode,
      )

      const cutoff =
        new Date(
          Date.now() -
            24 *
              60 *
              60 *
              1000,
        )

      return await this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .where(
          'order.storeCode = :storeCode',
          {
            storeCode,
          },
        )
        .andWhere(
          'order.createdAt >= :cutoff',
          {
            cutoff,
          },
        )
        .orderBy(
          'order.id',
          'DESC',
        )
        .getMany()
    } catch (err) {
      console.log(
        '🔥 HISTORY ERROR:',
        err,
      )

      this.logger.error(
        'Error fetching order history',
        err,
      )

      throw err
    }
  }

  // =========================
  // 🔥 REFUND ORDER
  // =========================
  async refundOrder(
    paymentIntentId: string,
  ) {
    try {
      const order =
        await this.orderRepo.findOne({
          where: {
            stripePaymentIntentId:
              paymentIntentId,
          },
        })

      if (!order) {
        throw new BadRequestException(
          'Order not found',
        )
      }

      if (
        order.status ===
        OrderStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Already refunded',
        )
      }

      console.log(
        '🔥 REFUNDING:',
        order.stripePaymentIntentId,
      )

      const balance =
        await this.stripe.balance.retrieve()

      console.log(
        '🔥 STRIPE BALANCE OK:',
        balance.available,
      )

      // ✅ NORMAL REFUND
      const refund =
        await this.stripe.refunds.create(
          {
            payment_intent:
              order.stripePaymentIntentId,
          },
        )

      console.log(
        '✅ REFUND SUCCESS:',
        refund.id,
      )

      order.status =
        OrderStatus.REFUNDED

      const saved =
        await this.orderRepo.save(
          order,
        )

      try {
        this.gateway.emitOrderUpdate(
          order.businessId,
          saved,
        )
      } catch (err) {
        console.log(
          'Socket update failed',
        )
      }

      return saved
    } catch (err) {
      console.log(err)

      this.logger.error(
        'Refund update failed',
        err,
      )

      throw err
    }
  }
}