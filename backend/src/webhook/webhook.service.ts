import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import { Repository } from 'typeorm'

import Stripe from 'stripe'

import {
  Order,
  OrderStatus,
  OwnerIssueSeverity,
  OwnerIssueType,
} from '../order/order.entity'

import { Business } from '../business/business.entity'

import { OrderGateway } from '../order/order.gateway'

import {
  PendingOrder,
  PendingOrderStatus,
} from '../pending-order/pending-order.entity'

@Injectable()
export class WebhookService {
  private readonly logger =
    new Logger(WebhookService.name)

  private stripe: Stripe

  private readonly webhookSecret: string

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,

    private gateway: OrderGateway,
  ) {
    const key =
      process.env.STRIPE_SECRET_KEY

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET

    if (
      !key ||
      !key.startsWith('sk_')
    ) {
      throw new Error(
        '❌ Missing or invalid STRIPE_SECRET_KEY in .env',
      )
    }

    if (
      !webhookSecret ||
      !webhookSecret.startsWith('whsec_')
    ) {
      throw new Error(
        '❌ Missing or invalid STRIPE_WEBHOOK_SECRET in .env',
      )
    }

    this.webhookSecret =
      webhookSecret

    this.stripe = new Stripe(
      key,
      {
        apiVersion:
          '2026-02-25.clover',
      },
    )

    this.logger.log(
      '✅ Stripe webhook service initialized from environment',
    )
  }

  // =========================
  // 🚨 OWNER ACTION
  // =========================

  private async createOwnerIssue(
    order: Order,
    issue: OwnerIssueType,
    severity: OwnerIssueSeverity,
    message: string,
  ) {
    if (!order.id) {
      return
    }

    if (order.requiresOwnerAction) {
      return
    }

    order.requiresOwnerAction = true

    order.issueResolved = false

    order.issueType = issue

    order.ownerIssueType = issue

    order.ownerIssueSeverity =
      severity

    order.ownerActionMessage =
      message

    order.ownerActionCreatedAt =
      new Date()

    order.ownerActionId =
      `ACT-${String(
        order.id,
      ).padStart(6, '0')}`

    await this.orderRepo.save(order)

    this.gateway.emitOrderUpdate(
      order.businessId,
      order,
    )

    this.logger.error(
      `[ACTION CENTER] ${issue}`,
      JSON.stringify({
        issueId:
          order.ownerActionId,

        orderId:
          order.id,

        severity,

        message,
      }),
    )
  }

  // =========================
  // 🔥 PENDING ORDER HELPERS
  // =========================

  private async findPendingOrder(
    pendingOrderId: number,
    stripeSessionId: string,
  ) {
    if (pendingOrderId) {
      const byId =
        await this.pendingOrderRepo.findOne({
          where: {
            id: pendingOrderId,
          },
        })

      if (byId) {
        return byId
      }
    }

    if (stripeSessionId) {
      const bySession =
        await this.pendingOrderRepo.findOne({
          where: {
            stripeSessionId,
          },
        })

      if (bySession) {
        return bySession
      }
    }

    return null
  }

  private async markPendingCompleted(
    pendingOrderId: number,
    stripeSessionId: string,
    stripePaymentIntentId: string,
  ) {
    try {
      const pendingOrder =
        await this.findPendingOrder(
          pendingOrderId,
          stripeSessionId,
        )

      if (!pendingOrder) {
        this.logger.warn(
          `PENDING_ORDER_NOT_FOUND: ${
            pendingOrderId ||
            stripeSessionId
          }`,
        )

        return
      }

      pendingOrder.status =
        PendingOrderStatus.COMPLETED

      pendingOrder.stripeSessionId =
        stripeSessionId

      pendingOrder.stripePaymentIntentId =
        stripePaymentIntentId ||
        null

      pendingOrder.failureReason =
        null

      await this.pendingOrderRepo.save(
        pendingOrder,
      )

      this.logger.log(
        `PendingOrder ${pendingOrder.id} marked COMPLETED.`,
      )
    } catch (err: any) {
      this.logger.error(
        'PENDING_ORDER_COMPLETE_FAILED',
        err,
      )
    }
  }

  private async markPendingFailed(
    pendingOrderId: number,
    stripeSessionId: string,
    stripePaymentIntentId: string,
    reason: string,
  ) {
    try {
      const pendingOrder =
        await this.findPendingOrder(
          pendingOrderId,
          stripeSessionId,
        )

      if (!pendingOrder) {
        this.logger.warn(
          `PENDING_ORDER_FAIL_NOT_FOUND: ${
            pendingOrderId ||
            stripeSessionId
          }`,
        )

        return
      }

      pendingOrder.status =
        PendingOrderStatus.FAILED

      pendingOrder.stripeSessionId =
        stripeSessionId

      pendingOrder.stripePaymentIntentId =
        stripePaymentIntentId ||
        null

      pendingOrder.failureReason =
        reason

      await this.pendingOrderRepo.save(
        pendingOrder,
      )

      this.logger.error(
        `PendingOrder ${pendingOrder.id} marked FAILED: ${reason}`,
      )
    } catch (err: any) {
      this.logger.error(
        'PENDING_ORDER_FAIL_SAVE_FAILED',
        err,
      )
    }
  }

  // =========================
  // 🔥 KITCHEN ACK TIMEOUT
  // =========================

  private scheduleKitchenAckTimeout(
    orderId: number,
    businessId: number,
  ) {
    setTimeout(async () => {
      try {
        const latestOrder =
          await this.orderRepo.findOne({
            where: {
              id: orderId,
              businessId,
            },
          })

        if (!latestOrder) {
          this.logger.error(
            `KITCHEN_ACK_CHECK_ORDER_NOT_FOUND: ${orderId}`,
          )

          return
        }

        if (
          latestOrder.kitchenAcknowledged
        ) {
          this.logger.log(
            `Kitchen acknowledged Order ${orderId}. No action needed.`,
          )

          return
        }

        if (
          latestOrder.status ===
            OrderStatus.REFUNDED ||
          latestOrder.status ===
            OrderStatus.DONE
        ) {
          this.logger.log(
            `Order ${orderId} already ${latestOrder.status}. Skipping ACK issue.`,
          )

          return
        }

        latestOrder.acknowledgementRetries =
          (latestOrder.acknowledgementRetries ||
            0) + 1

        await this.orderRepo.save(
          latestOrder,
        )

        await this.createOwnerIssue(
          latestOrder,
          OwnerIssueType.KITCHEN_ACK_TIMEOUT,
          OwnerIssueSeverity.CRITICAL,
          'Kitchen did not confirm receiving this paid order within 30 seconds. Check the kitchen tablet/internet and refund the customer if the order was not prepared.',
        )

        this.logger.error(
          `KITCHEN_ACK_TIMEOUT: Order ${orderId}`,
        )
      } catch (err: any) {
        this.logger.error(
          'KITCHEN_ACK_TIMEOUT_CHECK_FAILED',
          err,
        )
      }
    }, 30000)
  }

  // =========================
  // 🔥 WEBHOOK
  // =========================

  async handleStripeWebhook(
    sig: string,
    rawBody: any,
  ) {
    let event: Stripe.Event

    if (!sig) {
      throw new BadRequestException(
        'Missing Stripe signature',
      )
    }

    try {
      event =
        this.stripe.webhooks.constructEvent(
          rawBody,
          sig,
          this.webhookSecret,
        )

      console.log(
        '🔥 WEBHOOK:',
        event.type,
      )
    } catch (err: any) {
      this.logger.error(
        'WEBHOOK_SIGNATURE_VERIFY_FAILED',
        err?.message ||
          err,
      )

      throw new BadRequestException(
        'Webhook signature verification failed',
      )
    }

    // =========================
    // 🔥 CHECKOUT COMPLETE
    // =========================

    if (
      event.type ===
      'checkout.session.completed'
    ) {
      const session =
        event.data
          .object as Stripe.Checkout.Session

      await this.handleCheckoutCompleted(
        session,
      )
    }

    // =========================
    // 🔥 PAYMENT SUCCESS
    // =========================

    if (
      event.type ===
      'payment_intent.succeeded'
    ) {
      console.log(
        '✅ PAYMENT SUCCESS',
      )
    }

    return {
      received: true,
    }
  }

  // =========================
  // 🔥 CREATE ORDER
  // =========================

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const stripeSessionId =
      session.id || ''

    const pendingOrderId =
      Number(
        session.metadata
          ?.pendingOrderId || 0,
      )

    const paymentIntentId =
      typeof session.payment_intent ===
      'string'
        ? session.payment_intent
        : session.payment_intent
            ?.id || ''

    try {
      console.log(
        '🔥 PROCESSING CHECKOUT',
      )

      console.log(
        '🔥 SESSION:',
        stripeSessionId,
      )

      // =========================
      // 🔥 CUSTOMER INFO
      // =========================

      const customerEmail =
        session.customer_details
          ?.email || ''

      const customerName =
        session.customer_details
          ?.name || ''

      // =========================
      // 🔥 METADATA
      // =========================

      const storeCode =
        session.metadata?.storeCode

      const itemsRaw =
        session.metadata?.items

      const tableNumber =
        session.metadata
          ?.tableNumber

      console.log(
        '🔥 METADATA:',
        session.metadata,
      )

      if (!storeCode) {
        this.logger.error(
          'STORE_CODE_MISSING',
        )

        await this.markPendingFailed(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
          'STORE_CODE_MISSING',
        )

        return
      }

      // =========================
      // 🔥 BUSINESS
      // =========================

      const business =
        await this.businessRepo.findOne({
          where: {
            storeCode,
          },
        })

      if (!business) {
        this.logger.error(
          `BUSINESS_NOT_FOUND: ${storeCode}`,
        )

        await this.markPendingFailed(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
          `BUSINESS_NOT_FOUND: ${storeCode}`,
        )

        return
      }

      // =========================
      // 🔥 DUPLICATE PAYMENT CHECK
      // =========================

      if (paymentIntentId) {
        const existingOrder =
          await this.orderRepo.findOne({
            where: {
              stripePaymentIntentId:
                paymentIntentId,
            },
          })

        if (existingOrder) {
          this.logger.warn(
            `DUPLICATE_WEBHOOK_IGNORED: PaymentIntent ${paymentIntentId} already created Order ${existingOrder.id}`,
          )

          await this.markPendingCompleted(
            pendingOrderId,
            stripeSessionId,
            paymentIntentId,
          )

          return
        }
      }

      // =========================
      // 🔥 ITEMS
      // =========================

      let items: any[] = []

      if (itemsRaw) {
        try {
          items =
            JSON.parse(itemsRaw)
        } catch {
          this.logger.error(
            'INVALID_ORDER_DATA',
          )

          items = []
        }
      }

      // =========================
      // 🔥 TOTALS
      // =========================

      const total =
        Number(
          (
            (session.amount_total ||
              0) / 100
          ).toFixed(2),
        )

      // =========================
      // 🔥 PLATFORM FEE
      // Uses the cafe's configured processing fee
      // =========================

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

      console.log(
        '🔥 PROCESSING FEE:',
        {
          processingFeePercent,
          platformFee,
        },
      )

      // =========================
      // 🔥 CREATE ORDER
      // =========================

      const order =
        new Order()

      order.businessId =
        business.id

      order.storeCode =
        business.storeCode

      order.items = items

      order.total = total

      order.tableNumber =
        tableNumber
          ? parseInt(
              tableNumber,
              10,
            )
          : 0

      order.status =
        OrderStatus.NEW

      order.platformFee =
        platformFee

      // =========================
      // 🔥 CUSTOMER
      // =========================

      order.customerEmail =
        customerEmail

      order.customerName =
        customerName

      order.stripeSessionId =
        stripeSessionId

      // =========================
      // 🔥 KITCHEN ACK DEFAULTS
      // =========================

      order.kitchenAcknowledged =
        false

      order.kitchenAcknowledgedAt =
        null

      order.acknowledgementRetries =
        0

      // =========================
      // 🔥 ACTION CENTER
      // =========================

      order.issueResolved =
        false

      order.issueType =
        'ORDER_RECEIVED'

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

      // =========================
      // 🔥 STRIPE
      // =========================

      order.stripePaymentIntentId =
        paymentIntentId

      console.log(
        '🔥 ABOUT TO SAVE ORDER:',
        {
          pendingOrderId,

          businessId:
            order.businessId,

          storeCode:
            order.storeCode,

          total:
            order.total,

          tableNumber:
            order.tableNumber,

          stripePaymentIntentId:
            order.stripePaymentIntentId,
        },
      )

      let saved: Order

      try {
        saved =
          await this.orderRepo.save(
            order,
          )

        await this.markPendingCompleted(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
        )

        if (
          !saved.items ||
          saved.items.length === 0
        ) {
          await this.createOwnerIssue(
            saved,
            OwnerIssueType.INVALID_ORDER_DATA,
            OwnerIssueSeverity.CRITICAL,
            'Order metadata could not be parsed.',
          )
        }

        console.log(
          '✅ SAVE SUCCESS:',
          saved,
        )
      } catch (err: any) {
        this.logger.error(
          'DATABASE_SAVE_FAILED',
          err,
        )

        this.logger.error(
          err?.message,
        )

        await this.markPendingFailed(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
          `DATABASE_SAVE_FAILED: ${
            err?.message ||
            'Unknown database error'
          }`,
        )

        return
      }

      console.log(
        '✅ ORDER CREATED:',
        saved.id,
      )

      this.logger.log(
        `Order ${saved.id} successfully created.`,
      )

      // =========================
      // 🔥 REALTIME
      // =========================

      try {
        this.gateway.emitNewOrder(
          business.id,
          saved,
        )

        this.logger.log(
          `Order ${saved.id} sent to kitchen.`,
        )

        this.scheduleKitchenAckTimeout(
          saved.id,
          business.id,
        )
      } catch (err) {
        await this.createOwnerIssue(
          saved,
          OwnerIssueType.SOCKET_EMIT_FAILED,
          OwnerIssueSeverity.CRITICAL,
          'Kitchen never received the paid order.',
        )

        this.logger.error(
          'SOCKET_EMIT_FAILED',
          err,
        )
      }
    } catch (err: any) {
      this.logger.error(
        'WEBHOOK_PROCESSING_FAILED',
        err,
      )

      await this.markPendingFailed(
        pendingOrderId,
        stripeSessionId,
        paymentIntentId,
        `WEBHOOK_PROCESSING_FAILED: ${
          err?.message ||
          'Unknown webhook error'
        }`,
      )
    }
  }
}