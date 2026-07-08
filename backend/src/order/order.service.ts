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
  OwnerIssueSeverity,
  OwnerIssueType,
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
    this.logger.log(
      'Order Service Started',
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
  // 🚨 OWNER ACTION
  // =========================

  private async flagOwnerAction(
    order: Order,
    issue: OwnerIssueType,
    severity: OwnerIssueSeverity,
    message: string,
  ) {

    if (
      order.requiresOwnerAction &&
      order.ownerIssueSeverity ===
        OwnerIssueSeverity.CRITICAL
    ) {
      return
    }

    order.requiresOwnerAction = true

    order.ownerIssueType = issue

    order.ownerIssueSeverity = severity

    order.ownerActionMessage = message

    order.ownerActionCreatedAt =
      new Date()

    if (!order.id) {
      throw new Error(
        'Cannot create owner action before the order has been saved.',
      )
    }

    if (!order.ownerActionId) {
      order.ownerActionId =
        `ACT-${String(
          order.id,
        ).padStart(6, '0')}`
    }

    this.logger.warn(
      JSON.stringify({
        actionCenter: true,
        issueId: order.ownerActionId,
        issue,
        severity,
        orderId: order.id,
        customer: order.customerName,
        paymentIntent: order.stripePaymentIntentId,
        message,
        createdAt: order.ownerActionCreatedAt,
      }),
    )

    await this.orderRepo.save(order)
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

        await this.flagOwnerAction(
          existing,
          OwnerIssueType.DUPLICATE_PAYMENT,
          OwnerIssueSeverity.WARNING,
          'Duplicate payment attempt detected.',
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

      if (!saved.items || saved.items.length === 0) {
        await this.flagOwnerAction(
          saved,
          OwnerIssueType.INVALID_ORDER_DATA,
          OwnerIssueSeverity.CRITICAL,
          'Order was created with no menu items.',
        )
      }

      try {
        this.gateway.emitNewOrder(
          data.businessId,
          saved,
        )
      } catch (err) {
        await this.flagOwnerAction(
          saved,
          OwnerIssueType.SOCKET_EMIT_FAILED,
          OwnerIssueSeverity.CRITICAL,
          'Kitchen never received the paid order.',
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

      // 🔥 AUTO RESOLVE ACTION CENTER ISSUES
      if (
        status ===
          OrderStatus.PREPARING ||
        status ===
          OrderStatus.READY ||
        status ===
          OrderStatus.DONE
      ) {
        order.requiresOwnerAction =
          false

        order.ownerIssueType =
          null

        order.ownerIssueSeverity =
          null

        order.ownerActionMessage =
          null

        order.ownerActionResolvedAt =
          new Date()

        order.ownerActionResolvedBy =
          'KITCHEN'

        order.ownerActionCreatedAt =
          null

        order.ownerActionId =
          null

        order.issueResolved = true

        order.issueType = null
      }

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
        this.logger.error(
          'Socket update failed',
          err,
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
  // 🔥 PAST ORDERS (60 DAYS)
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
            60 *
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

      if (!order.stripePaymentIntentId) {
        throw new BadRequestException(
          'Order has no Stripe Payment Intent.',
        )
      }

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

      order.requiresOwnerAction =
        false

      order.ownerIssueType =
        null

      order.ownerIssueSeverity =
        null

      order.ownerActionMessage =
        null

      order.ownerActionResolvedAt =
        new Date()

      order.ownerActionResolvedBy =
        'REFUND'

      order.ownerActionCreatedAt =
        null

      order.ownerActionId =
        null

      order.issueResolved = true

      order.issueType = null

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
        this.logger.error(
          'Socket update failed',
          err,
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

  // =========================
  // 🚨 ACTION CENTER
  // =========================
  async getActionCenter(
    storeCode: string,
  ) {
    try {
      return await this.orderRepo
        .createQueryBuilder('order')
        .where(
          'order.storeCode = :storeCode',
          { storeCode },
        )
        .andWhere(
          'order.requiresOwnerAction = :flag',
          { flag: true },
        )
        .orderBy(
          'order.ownerActionCreatedAt',
          'DESC',
        )
        .getMany()
    } catch (err) {
      this.logger.error(
        'Error fetching action center orders',
        err,
      )

      throw err
    }
  }

  // =========================
  // 🔍 SEARCH ORDERS
  // =========================
  async searchOrders(
    storeCode: string,
    query: string,
  ) {
    try {
      const qb = this.orderRepo
        .createQueryBuilder('order')
        .where(
          'order.storeCode = :storeCode',
          { storeCode },
        )

      if (
        query &&
        query.trim().length > 0
      ) {
        qb.andWhere(
          `(
            order.customerName ILIKE :q
            OR order.customerEmail ILIKE :q
            OR order.stripePaymentIntentId ILIKE :q
            OR order.ownerActionId ILIKE :q
            OR CAST(order.id AS TEXT) ILIKE :q
            OR CAST(order.tableNumber AS TEXT) ILIKE :q
          )`,
          { q: `%${query}%` },
        )
      }

      return await qb
        .orderBy('order.id', 'DESC')
        .getMany()
    } catch (err) {
      this.logger.error(
        'Error searching orders',
        err,
      )

      throw err
    }
  }

  // =========================
  // ✅ RESOLVE OWNER ACTION
  // =========================
  async resolveOwnerAction(
    id: number,
    resolvedBy: string,
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

      if (!order.requiresOwnerAction) {
        throw new BadRequestException(
          'This order has no open action to resolve.',
        )
      }

      order.requiresOwnerAction = false

      order.issueResolved = true
      order.issueType = null

      order.ownerIssueType = null
      order.ownerIssueSeverity = null
      order.ownerActionMessage = null

      order.ownerActionResolvedAt = new Date()
      order.ownerActionResolvedBy = resolvedBy

      order.ownerActionCreatedAt = null
      order.ownerActionId = null

      const saved =
        await this.orderRepo.save(order)

      try {
        this.gateway.emitOrderUpdate(
          order.businessId,
          saved,
        )
      } catch (err) {
        this.logger.error(
          'Socket update failed',
          err,
        )
      }

      this.logger.log(
        `Owner action resolved for order ${saved.id}`,
      )

      return saved
    } catch (err) {
      this.logger.error(
        'Error resolving owner action',
        err,
      )

      throw err
    }
  }
}