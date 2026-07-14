import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common'

import {
  Cron,
  CronExpression,
} from '@nestjs/schedule'

import { InjectRepository } from '@nestjs/typeorm'

import {
  Repository,
  In,
  LessThan,
} from 'typeorm'

import Stripe from 'stripe'

import {
  Order,
  OrderStatus,
  OwnerIssueSeverity,
  OwnerIssueType,
} from '../order/order.entity'

import { Business } from '../business/business.entity'

import {
  PendingOrder,
  PendingOrderStatus,
} from '../pending-order/pending-order.entity'

@Injectable()
export class MaintenanceService {
  private readonly logger =
    new Logger(
      MaintenanceService.name,
    )

  private stripe: Stripe

  private reconciliationRunning = false

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,
  ) {
    this.stripe = new Stripe(
      'sk_test_51Sxh4AKZAB5HMPha5usVVKGeyWcWBEqiFjVMGwPCVOFbbx56mJaJOcZrObsxj35zM92583ovMqnfGUI31JcL1rbP00TUzKY5xh',
      {
        apiVersion:
          '2026-02-25.clover',
      },
    )
  }

  // =========================
  // 🚨 OWNER ACTION HELPER
  // =========================

  private async createOwnerIssue(
    order: Order,
    issue: OwnerIssueType,
    severity: OwnerIssueSeverity,
    message: string,
  ) {
    if (!order.id) {
      return order
    }

    order.requiresOwnerAction = true
    order.issueResolved = false

    order.ownerIssueType = issue
    order.ownerIssueSeverity = severity
    order.ownerActionMessage = message

    order.ownerActionCreatedAt =
      new Date()

    order.ownerActionId =
      `ACT-${String(
        order.id,
      ).padStart(6, '0')}`

    return this.orderRepo.save(
      order,
    )
  }

  // =========================
  // 🔥 AUTOMATIC RECONCILIATION
  // Runs every 1 minute
  // =========================

  @Cron(CronExpression.EVERY_MINUTE)
  async runAutomaticReconciliation() {
    if (this.reconciliationRunning) {
      return
    }

    this.reconciliationRunning = true

    try {
      const result =
        await this.reconcilePendingOrders()

      if (result.checked > 0) {
        this.logger.log(
          `Automatic reconciliation checked ${result.checked} pending orders.`,
        )
      }
    } catch (err: any) {
      this.logger.error(
        'AUTOMATIC_RECONCILIATION_FAILED',
        err,
      )
    } finally {
      this.reconciliationRunning = false
    }
  }

  // =========================
  // 🔥 RECONCILE PENDING ORDERS
  // =========================

  async reconcilePendingOrders() {
    const cutoff =
      new Date(
        Date.now() -
          2 * 60 * 1000,
      )

    const pendingOrders =
      await this.pendingOrderRepo.find({
        where: {
          status: In([
            PendingOrderStatus.CREATED,
            PendingOrderStatus.CHECKOUT_CREATED,
          ]),

          createdAt:
            LessThan(cutoff),

          issueCreated: false,
        },

        order: {
          id: 'ASC',
        },

        take: 50,
      })

    const results: any[] = []

    for (const pending of pendingOrders) {
      try {
        // No Stripe session means payment was never opened properly.
        // This is not a customer-paid issue.
        if (!pending.stripeSessionId) {
          pending.status =
            PendingOrderStatus.EXPIRED

          pending.failureReason =
            'Checkout session was never created.'

          await this.pendingOrderRepo.save(
            pending,
          )

          results.push({
            pendingOrderId:
              pending.id,

            status:
              'EXPIRED_NO_SESSION',
          })

          continue
        }

        const session =
          await this.stripe.checkout.sessions.retrieve(
            pending.stripeSessionId,
          )

        const paymentIntentId =
          typeof session.payment_intent ===
          'string'
            ? session.payment_intent
            : session.payment_intent
                ?.id || ''

        pending.stripePaymentIntentId =
          paymentIntentId || null

        // Paid in Stripe but our normal webhook flow did not complete.
        if (
          session.payment_status ===
            'paid' ||
          session.status ===
            'complete'
        ) {
          const existingByPaymentIntent =
            paymentIntentId
              ? await this.orderRepo.findOne({
                  where: {
                    stripePaymentIntentId:
                      paymentIntentId,
                  },
                })
              : null

          const existingBySession =
            await this.orderRepo.findOne({
              where: {
                stripeSessionId:
                  pending.stripeSessionId,
              },
            })

          const existingOrder =
            existingByPaymentIntent ||
            existingBySession

          if (existingOrder) {
            pending.status =
              PendingOrderStatus.COMPLETED

            pending.issueCreated =
              true

            pending.failureReason =
              null

            await this.pendingOrderRepo.save(
              pending,
            )

            results.push({
              pendingOrderId:
                pending.id,

              orderId:
                existingOrder.id,

              status:
                'ORDER_ALREADY_EXISTS',
            })

            continue
          }

          const business =
            await this.businessRepo.findOne({
              where: {
                id: pending.businessId,
              },
            })

          if (!business) {
            pending.status =
              PendingOrderStatus.FAILED

            pending.failureReason =
              'Business not found during reconciliation.'

            pending.issueCreated =
              true

            await this.pendingOrderRepo.save(
              pending,
            )

            results.push({
              pendingOrderId:
                pending.id,

              status:
                'FAILED_BUSINESS_NOT_FOUND',
            })

            continue
          }

          const total =
            Number(
              (
                (session.amount_total ||
                  pending.total * 100 ||
                  0) / 100
              ).toFixed(2),
            )

          const processingFeePercent =
            business.processingFeePercent ??
            1.75

          const platformFee =
            Number(
              (
                total *
                (processingFeePercent /
                  100)
              ).toFixed(2),
            )

          const order =
            new Order()

          order.businessId =
            business.id

          order.storeCode =
            business.storeCode ||
            pending.storeCode

          order.items =
            pending.items || []

          order.total =
            total

          order.platformFee =
            platformFee

          order.tableNumber =
            pending.tableNumber || 0

          order.customerEmail =
            session.customer_details?.email ||
            ''

          order.customerName =
            session.customer_details?.name ||
            ''

          order.status =
            OrderStatus.NEW

          order.stripePaymentIntentId =
            paymentIntentId || null

          order.stripeSessionId =
            pending.stripeSessionId

          order.kitchenAcknowledged =
            false

          order.kitchenAcknowledgedAt =
            null

          order.acknowledgementRetries =
            0

          order.issueType =
            'WEBHOOK_RECOVERED'

          order.issueResolved =
            false

          order.requiresOwnerAction =
            false

          order.ownerIssueType =
            null

          order.ownerIssueSeverity =
            null

          order.ownerActionMessage =
            null

          order.ownerActionId =
            null

          order.ownerActionResolvedBy =
            null

          order.ownerActionResolvedAt =
            null

          order.ownerActionCreatedAt =
            null

          let saved =
            await this.orderRepo.save(
              order,
            )

          saved =
            await this.createOwnerIssue(
              saved,
              OwnerIssueType.WEBHOOK_TIMEOUT,
              OwnerIssueSeverity.CRITICAL,
              'Stripe shows this customer paid, but the normal webhook flow did not finish. This order was recovered by reconciliation. Check the kitchen and refund the customer if the order was not prepared.',
            )

          pending.status =
            PendingOrderStatus.COMPLETED

          pending.issueCreated =
            true

          pending.failureReason =
            'Paid order recovered by reconciliation.'

          await this.pendingOrderRepo.save(
            pending,
          )

          results.push({
            pendingOrderId:
              pending.id,

            orderId:
              saved.id,

            status:
              'RECOVERED_PAID_ORDER',
          })

          continue
        }

        // Customer never completed payment.
        if (
          session.status ===
            'expired' ||
          session.payment_status ===
            'unpaid'
        ) {
          pending.status =
            PendingOrderStatus.EXPIRED

          pending.failureReason =
            'Checkout was not paid.'

          await this.pendingOrderRepo.save(
            pending,
          )

          results.push({
            pendingOrderId:
              pending.id,

            status:
              'EXPIRED_UNPAID',
          })

          continue
        }

        results.push({
          pendingOrderId:
            pending.id,

          status:
            'STILL_PENDING',
        })
      } catch (err: any) {
        this.logger.error(
          `RECONCILE_PENDING_ORDER_FAILED: ${pending.id}`,
          err,
        )

        pending.failureReason =
          err?.message ||
          'Reconciliation failed.'

        await this.pendingOrderRepo.save(
          pending,
        )

        results.push({
          pendingOrderId:
            pending.id,

          status:
            'ERROR',

          message:
            err?.message,
        })
      }
    }

    return {
      checked:
        pendingOrders.length,

      results,
    }
  }

  // =========================
  // 🔥 GET ALL OPEN ISSUES
  // =========================

  async getIssues() {
    return this.orderRepo.find({
      where: {
        requiresOwnerAction: true,
        issueResolved: false,
      },
      order: {
        id: 'DESC',
      },
    })
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  async resolveIssue(id: number) {
    const order =
      await this.orderRepo.findOne({
        where: {
          id,
        },
      })

    if (!order) {
      throw new BadRequestException(
        'Order not found',
      )
    }

    order.issueResolved = true
    order.issueType = ''
    order.requiresOwnerAction = false
    order.ownerIssueType = null
    order.ownerIssueSeverity = null
    order.ownerActionMessage = null
    order.ownerActionResolvedAt =
      new Date()
    order.ownerActionResolvedBy =
      'MAINTENANCE'

    await this.orderRepo.save(order)

    return {
      success: true,
      orderId: order.id,
    }
  }

  // =========================
  // 🔥 EMAIL CUSTOMER
  // =========================

  async emailCustomer(body: {
    orderId: number
    email: string
    name: string
    note: string
  }) {
    console.log('EMAIL CUSTOMER')
    console.log(body)

    return {
      success: true,
      message: 'Email queued',
    }
  }

  // =========================
  // 🔥 GET ALL ORDERS
  // =========================

  async getAllOrders() {
    return this.orderRepo.find({
      order: {
        id: 'DESC',
      },
    })
  }

  // =========================
  // 🔥 DASHBOARD STATS
  // =========================

  async getDashboardStats() {
    const orders =
      await this.orderRepo.find()

    const revenue =
      orders.reduce(
        (sum, o) => sum + o.total,
        0,
      )

    return {
      totalOrders:
        orders.length,

      totalRevenue:
        revenue,

      unresolvedIssues:
        orders.filter(
          (o) =>
            o.requiresOwnerAction &&
            !o.issueResolved,
        ).length,

      refundedOrders:
        orders.filter(
          (o) =>
            o.status ===
            OrderStatus.REFUNDED,
        ).length,
    }
  }

  // =========================
  // 🔥 ADMIN DASHBOARD
  // =========================

  async getAdminDashboard() {
    const orders =
      await this.orderRepo.find({
        order: {
          id: 'DESC',
        },
      })

    const totalRevenue =
      orders.reduce(
        (sum, o) => sum + o.total,
        0,
      )

    const totalOrders =
      orders.length

    const unresolvedIssues =
      orders.filter(
        (o) =>
          o.requiresOwnerAction &&
          !o.issueResolved,
      ).length

    const refundedOrders =
      orders.filter(
        (o) =>
          o.status ===
          OrderStatus.REFUNDED,
      ).length

    const platformFees =
      orders.reduce(
        (sum, o) =>
          sum +
          (o.platformFee || 0),
        0,
      )

    const averageOrderValue =
      totalOrders > 0
        ? totalRevenue /
          totalOrders
        : 0

    return {
      totalRevenue,
      totalOrders,
      unresolvedIssues,
      refundedOrders,
      platformFees,
      averageOrderValue,
      recentOrders:
        orders.slice(0, 10),
    }
  }

  // =========================
  // 🔥 GET CAFE DETAILS
  // =========================

  async getCafeDetails(
    storeCode: string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Cafe not found',
      )
    }

    const orders =
      await this.orderRepo.find({
        where: {
          storeCode,
        },
        order: {
          id: 'DESC',
        },
      })

    const today =
      new Date()

    today.setHours(
      0,
      0,
      0,
      0,
    )

    const month =
      new Date()

    month.setDate(1)

    month.setHours(
      0,
      0,
      0,
      0,
    )

    const todayOrders =
      orders.filter(
        (o) =>
          new Date(
            o.createdAt,
          ) >= today,
      )

    const monthOrders =
      orders.filter(
        (o) =>
          new Date(
            o.createdAt,
          ) >= month,
      )

    return {
      business,

      todayRevenue:
        todayOrders.reduce(
          (s, o) =>
            s +
            o.total,
          0,
        ),

      monthRevenue:
        monthOrders.reduce(
          (s, o) =>
            s +
            o.total,
          0,
        ),

      allTimeRevenue:
        orders.reduce(
          (s, o) =>
            s +
            o.total,
          0,
        ),

      todayPlatformFees:
        todayOrders.reduce(
          (s, o) =>
            s +
            o.platformFee,
          0,
        ),

      monthPlatformFees:
        monthOrders.reduce(
          (s, o) =>
            s +
            o.platformFee,
          0,
        ),

      allTimePlatformFees:
        orders.reduce(
          (s, o) =>
            s +
            o.platformFee,
          0,
        ),

      averageOrder:
        orders.length
          ? orders.reduce(
              (s, o) =>
                s +
                o.total,
              0,
            ) /
            orders.length
          : 0,

      refunds:
        orders.filter(
          (o) =>
            o.status ===
            OrderStatus.REFUNDED,
        ).length,

      openIssues:
        orders.filter(
          (o) =>
            o.requiresOwnerAction &&
            !o.issueResolved,
        ).length,

      recentOrders:
        orders.slice(
          0,
          15,
        ),
    }
  }

  // =========================
  // 🔥 UPDATE PROCESSING FEE
  // =========================

  async updateProcessingFee(
    storeCode: string,
    fee: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Cafe not found',
      )
    }

    const processingFee =
      Number(fee)

    if (
      Number.isNaN(processingFee) ||
      processingFee < 0 ||
      processingFee > 10
    ) {
      throw new BadRequestException(
        'Processing fee must be between 0 and 10%',
      )
    }

    business.processingFeePercent =
      processingFee

    await this.businessRepo.save(
      business,
    )

    return {
      success: true,
      processingFeePercent:
        business.processingFeePercent,
    }
  }
}