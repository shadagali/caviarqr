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
      console.log(err)

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
        console.log(
          '❌ Missing storeCode',
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
        console.log(
          '❌ Business not found:',
          storeCode,
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

      const platformFee = +(
        total * 0.0075
      ).toFixed(2)

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

      // ✅ SAVE REAL PAYMENT INTENT
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

      let saved: any

      try {
        saved =
          await this.orderRepo.save(
            order,
          )

        console.log(
          '✅ SAVE SUCCESS:',
          saved,
        )
      } catch (err: any) {
        console.log(
          '❌ SAVE FAILED FULL ERROR:',
        )

        console.log(err)

        console.log(
          '❌ SAVE FAILED MESSAGE:',
          err?.message,
        )

        return
      }

      console.log(
        '✅ ORDER CREATED:',
        saved.id,
      )

      // =========================
      // 🔥 REALTIME
      // =========================

      try {
        this.gateway.emitNewOrder(
          business.id,
          saved,
        )

        console.log(
          '🔥 SOCKET EMITTED',
        )
      } catch (err) {
        console.log(
          '⚠️ Socket emit failed',
        )
      }
    } catch (err: any) {
      console.log(
        '❌ WEBHOOK ERROR:',
        err.message,
      )
    }
  }
}