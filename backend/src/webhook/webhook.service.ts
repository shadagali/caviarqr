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

@Injectable()
export class WebhookService {
  private readonly logger =
    new Logger(WebhookService.name)

  private stripe: Stripe

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    private gateway: OrderGateway,
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

    order.ownerIssueType = issue

    order.ownerIssueSeverity = severity

    order.ownerActionMessage = message

    order.ownerActionCreatedAt =
      new Date()

    order.ownerActionId =
      `ACT-${String(
        order.id,
      ).padStart(6, '0')}`

    await this.orderRepo.save(order)

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
  // 🔥 WEBHOOK
  // =========================

  async handleStripeWebhook(
    sig: string,
    rawBody: any,
  ) {
    let event: Stripe.Event

    try {
      event = JSON.parse(
        rawBody.toString(),
      ) as Stripe.Event

      console.log(
        '🔥 WEBHOOK:',
        event.type,
      )
    } catch (err: any) {
      this.logger.error(
        'WEBHOOK_PARSE_FAILED',
        err,
      )

      throw new BadRequestException(
        'Webhook parse failed',
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
    try {
      console.log(
        '🔥 PROCESSING CHECKOUT',
      )

      console.log(
        '🔥 SESSION:',
        session.id,
      )

      // ✅ REAL PAYMENT INTENT
      const paymentIntentId =
        typeof session.payment_intent ===
        'string'
          ? session.payment_intent
          : session.payment_intent
              ?.id || ''

      // =========================
      // 🔥 CUSTOMER INFO
      // =========================

      const customerEmail =
        session.customer_details?.email ||
        ''

      const customerName =
        session.customer_details?.name ||
        ''

      const stripeSessionId =
        session.id || ''

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

        return
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

      const platformFee = +(
        total *
        (processingFeePercent / 100)
      ).toFixed(2)

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
      // 🔥 ACTION CENTER
      // =========================

      order.issueResolved =
        false

      order.issueType =
        'ORDER_RECEIVED'

      // =========================
      // 🔥 STRIPE
      // =========================

      order.stripePaymentIntentId =
        paymentIntentId

      console.log(
        '🔥 ABOUT TO SAVE ORDER:',
        {
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

        if (saved.items.length === 0) {
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
    }
  }
}