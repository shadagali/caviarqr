import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common'

import Stripe from 'stripe'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import { Repository } from 'typeorm'

import { Business } from '../business/business.entity'

import {
  PendingOrder,
  PendingOrderStatus,
} from '../pending-order/pending-order.entity'

@Injectable()
export class StripeService {
  private readonly logger =
    new Logger(
      StripeService.name,
    )

  private stripe: Stripe

  private readonly frontendUrl =
    process.env.FRONTEND_URL ||
    'http://localhost:3000'

  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,
  ) {
    const key =
      process.env.STRIPE_SECRET_KEY

    if (
      !key ||
      !key.startsWith('sk_')
    ) {
      throw new Error(
        '❌ Missing or invalid STRIPE_SECRET_KEY in .env',
      )
    }

    this.stripe = new Stripe(
      key,
      {
        apiVersion:
          '2026-02-25.clover',
      },
    )

    this.logger.log(
      '✅ Stripe initialized from environment',
    )
  }

  // =========================
  // 🔥 CHECKOUT
  // =========================

  async createCheckoutSession(
    data: {
      businessId: number
      storeCode: string
      tableNumber: number
      items: any[]
    },
  ) {
    let savedPendingOrder:
      | PendingOrder
      | null = null

    try {
      const business =
        await this.businessRepo.findOne({
          where: {
            storeCode:
              data.storeCode,
          },
        })

      if (!business) {
        throw new BadRequestException(
          'Business not found',
        )
      }

      if (!business.isOpen) {
        throw new BadRequestException(
          'Restaurant is currently closed',
        )
      }

      if (
        !data.items?.length
      ) {
        throw new BadRequestException(
          'Cart is empty',
        )
      }

      const subtotal =
        data.items.reduce(
          (sum, i) => {
            const finalPrice =
              Number(
                i.discount ||
                  0,
              ) > 0
                ? Number(
                    i.price,
                  ) *
                  (1 -
                    Number(
                      i.discount ||
                        0,
                    ) /
                      100)
                : Number(
                    i.price,
                  )

            return (
              sum +
              finalPrice *
                Number(
                  i.qty || 1,
                )
            )
          },
          0,
        )

      const feePercent =
        Number(
          business.serviceFee ||
            0,
        )

      const serviceFeeAmount =
        Number(
          (
            subtotal *
            (feePercent / 100)
          ).toFixed(2),
        )

      const finalTotal =
        Number(
          (
            subtotal +
            serviceFeeAmount
          ).toFixed(2),
        )

      const processingFeePercent =
        Number(
          business.processingFeePercent ??
            1.75,
        )

      const platformFee =
        Math.round(
          finalTotal *
            100 *
            (processingFeePercent / 100),
        )

      let paymentIntentData:
        | any
        | undefined =
        undefined

      if (!business.stripeAccountId) {
        business.stripeChargesEnabled =
          false

        business.stripePayoutsEnabled =
          false

        business.stripeDetailsSubmitted =
          false

        business.stripeAccountReady =
          false

        business.stripeIssueActive =
          true

        business.stripeIssueMessage =
          'Stripe account is not connected. Connect Stripe before accepting customer payments.'

        business.stripeIssueCreatedAt =
          business.stripeIssueCreatedAt ||
          new Date()

        business.stripeLastCheckedAt =
          new Date()

        await this.businessRepo.save(
          business,
        )

        throw new BadRequestException(
          'Restaurant payments are not ready yet. Please ask the owner to complete Stripe setup.',
        )
      }

      try {
        const acc =
          await this.stripe.accounts.retrieve(
            business.stripeAccountId,
          )

        const chargesEnabled =
          Boolean(
            acc.charges_enabled,
          )

        const payoutsEnabled =
          Boolean(
            acc.payouts_enabled,
          )

        const detailsSubmitted =
          Boolean(
            acc.details_submitted,
          )

        const stripeReady =
          chargesEnabled &&
          payoutsEnabled &&
          detailsSubmitted

        business.stripeChargesEnabled =
          chargesEnabled

        business.stripePayoutsEnabled =
          payoutsEnabled

        business.stripeDetailsSubmitted =
          detailsSubmitted

        business.stripeAccountReady =
          stripeReady

        business.stripeIssueActive =
          !stripeReady

        business.stripeIssueMessage =
          stripeReady
            ? null
            : 'Stripe account is not fully ready. Complete onboarding before accepting customer payments.'

        business.stripeIssueCreatedAt =
          stripeReady
            ? null
            : business.stripeIssueCreatedAt ||
              new Date()

        business.stripeLastCheckedAt =
          new Date()

        await this.businessRepo.save(
          business,
        )

        if (!stripeReady) {
          throw new BadRequestException(
            'Restaurant payments are not ready yet. Please ask the owner to complete Stripe setup.',
          )
        }

        paymentIntentData =
          {
            application_fee_amount:
              platformFee,

            transfer_data:
              {
                destination:
                  business.stripeAccountId,
              },
          }
      } catch (err: any) {
        if (
          err instanceof
          BadRequestException
        ) {
          throw err
        }

        business.stripeChargesEnabled =
          false

        business.stripePayoutsEnabled =
          false

        business.stripeDetailsSubmitted =
          false

        business.stripeAccountReady =
          false

        business.stripeIssueActive =
          true

        business.stripeIssueMessage =
          `Stripe account check failed: ${
            err?.message ||
            'Unknown Stripe error'
          }`

        business.stripeIssueCreatedAt =
          business.stripeIssueCreatedAt ||
          new Date()

        business.stripeLastCheckedAt =
          new Date()

        await this.businessRepo.save(
          business,
        )

        this.logger.warn(
          `STRIPE_ACCOUNT_CHECK_FAILED: ${err?.message}`,
        )

        throw new BadRequestException(
          'Could not verify restaurant payment account. Please try again or contact support.',
        )
      }

      const safeItems =
        data.items.map(
          (i) => {
            const originalPrice =
              Number(
                i.price || 0,
              )

            const discount =
              Number(
                i.discount || 0,
              )

            const finalPrice =
              discount > 0
                ? originalPrice *
                  (1 -
                    discount / 100)
                : originalPrice

            return {
              id: i.id,

              name:
                i.name ||
                'Item',

              qty:
                Number(
                  i.qty || 1,
                ),

              price:
                Number(
                  finalPrice.toFixed(2),
                ),

              originalPrice,

              discount,
            }
          },
        )

      // =========================
      // 🔥 CREATE PENDING ORDER FIRST
      // =========================

      const pendingOrder =
        this.pendingOrderRepo.create({
          businessId:
            business.id,

          storeCode:
            data.storeCode,

          tableNumber:
            Number(
              data.tableNumber ||
                0,
            ),

          items:
            safeItems,

          subtotal:
            Number(
              subtotal.toFixed(2),
            ),

          serviceFeeAmount,

          total:
            finalTotal,

          stripeSessionId:
            null,

          stripePaymentIntentId:
            null,

          status:
            PendingOrderStatus.CREATED,

          issueCreated:
            false,

          failureReason:
            null,
        })

      savedPendingOrder =
        await this.pendingOrderRepo.save(
          pendingOrder,
        )

      console.log(
        '✅ PENDING ORDER CREATED:',
        savedPendingOrder.id,
      )

      console.log(
        '🔥 CHECKOUT PAYLOAD:',
        {
          pendingOrderId:
            savedPendingOrder.id,

          storeCode:
            data.storeCode,

          tableNumber:
            data.tableNumber,

          items:
            safeItems,

          total:
            finalTotal,
        },
      )

      const session =
        await this.stripe.checkout.sessions.create(
          {
            mode: 'payment',

            payment_method_types:
              ['card'],

            customer_creation:
              'always',

            billing_address_collection:
              'required',

            phone_number_collection:
              {
                enabled: true,
              },

            line_items: [
              ...safeItems.map(
                (i) => ({
                  price_data:
                    {
                      currency:
                        'usd',

                      product_data:
                        {
                          name:
                            i.name ||
                            'Item',
                        },

                      unit_amount:
                        Math.round(
                          Number(
                            i.price || 0,
                          ) * 100,
                        ),
                    },

                  quantity:
                    Number(
                      i.qty || 1,
                    ),
                }),
              ),

              ...(serviceFeeAmount >
              0
                ? [
                    {
                      price_data:
                        {
                          currency:
                            'usd',

                          product_data:
                            {
                              name:
                                'Service Fee',
                            },

                          unit_amount:
                            Math.round(
                              serviceFeeAmount *
                                100,
                            ),
                        },

                      quantity: 1,
                    },
                  ]
                : []),
            ],

            ...(paymentIntentData
              ? {
                  payment_intent_data:
                    paymentIntentData,
                }
              : {}),

            metadata: {
              pendingOrderId:
                String(
                  savedPendingOrder.id,
                ),

              businessId:
                String(
                  business.id,
                ),

              storeCode:
                data.storeCode,

              tableNumber:
                String(
                  data.tableNumber,
                ),

              items:
                JSON.stringify(
                  safeItems,
                ),
            },

            success_url:
              `${this.frontendUrl}/store/${data.storeCode}?table=${data.tableNumber}&success=1&pendingOrderId=${savedPendingOrder.id}`,

            cancel_url:
              `${this.frontendUrl}/store/${data.storeCode}?table=${data.tableNumber}`,
          },
        )

      savedPendingOrder.stripeSessionId =
        session.id

      savedPendingOrder.status =
        PendingOrderStatus.CHECKOUT_CREATED

      await this.pendingOrderRepo.save(
        savedPendingOrder,
      )

      console.log(
        '🔥 STRIPE SESSION CREATED:',
        session.id,
      )

      console.log(
        '🔥 SESSION METADATA:',
        session.metadata,
      )

      return {
        url: session.url,

        pendingOrderId:
          savedPendingOrder.id,
      }
    } catch (err: any) {
      console.log(err)

      if (savedPendingOrder) {
        try {
          savedPendingOrder.status =
            PendingOrderStatus.FAILED

          savedPendingOrder.failureReason =
            err?.message ||
            'Checkout failed'

          await this.pendingOrderRepo.save(
            savedPendingOrder,
          )
        } catch {}
      }

      throw new BadRequestException(
        err?.message ||
          'Payment failed',
      )
    }
  }

  // =========================
  // 🔥 STRIPE ACCOUNT STATUS HELPER
  // =========================

  private async syncStripeAccountStatus(
    business: Business,
  ) {
    const now = new Date()

    if (!business.stripeAccountId) {
      business.stripeChargesEnabled =
        false

      business.stripePayoutsEnabled =
        false

      business.stripeDetailsSubmitted =
        false

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        'Stripe account is not connected. Connect Stripe before accepting real payments and payouts.'

      business.stripeIssueCreatedAt =
        business.stripeIssueCreatedAt ||
        now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        ready: false,
        issueActive: true,
        message:
          business.stripeIssueMessage,
      }
    }

    try {
      const acc =
        await this.stripe.accounts.retrieve(
          business.stripeAccountId,
        )

      const chargesEnabled =
        Boolean(
          acc.charges_enabled,
        )

      const payoutsEnabled =
        Boolean(
          acc.payouts_enabled,
        )

      const detailsSubmitted =
        Boolean(
          acc.details_submitted,
        )

      const ready =
        chargesEnabled &&
        payoutsEnabled &&
        detailsSubmitted

      business.stripeChargesEnabled =
        chargesEnabled

      business.stripePayoutsEnabled =
        payoutsEnabled

      business.stripeDetailsSubmitted =
        detailsSubmitted

      business.stripeAccountReady =
        ready

      business.stripeIssueActive =
        !ready

      business.stripeIssueMessage =
        ready
          ? null
          : 'Stripe account is not fully ready. Complete onboarding so charges and payouts work correctly.'

      business.stripeIssueCreatedAt =
        ready
          ? null
          : business.stripeIssueCreatedAt ||
            now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected: true,
        accountId:
          business.stripeAccountId,

        charges_enabled:
          chargesEnabled,

        payouts_enabled:
          payoutsEnabled,

        details_submitted:
          detailsSubmitted,

        ready,

        issueActive:
          !ready,

        message:
          business.stripeIssueMessage,
      }
    } catch (err: any) {
      business.stripeChargesEnabled =
        false

      business.stripePayoutsEnabled =
        false

      business.stripeDetailsSubmitted =
        false

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        `Stripe account status check failed: ${
          err?.message ||
          'Unknown Stripe error'
        }`

      business.stripeIssueCreatedAt =
        business.stripeIssueCreatedAt ||
        now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected: false,
        accountId:
          business.stripeAccountId,

        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        ready: false,
        issueActive: true,
        message:
          business.stripeIssueMessage,
      }
    }
  }

  // =========================
  // 🔥 CONNECT
  // =========================

  async createConnectLink(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    let accountId =
      business.stripeAccountId

    if (!accountId) {
      const account =
        await this.stripe.accounts.create(
          {
            type: 'express',

            country: 'US',

            email:
              business.email,

            capabilities:
              {
                card_payments:
                  {
                    requested:
                      true,
                  },

                transfers:
                  {
                    requested:
                      true,
                  },
              },
          },
        )

      accountId =
        account.id

      await this.businessRepo.update(
        business.id,
        {
          stripeAccountId:
            accountId,
        },
      )
    }

    const link =
      await this.stripe.accountLinks.create(
        {
          account:
            accountId,

          refresh_url:
            `${this.frontendUrl}/dashboard/owner`,

          return_url:
            `${this.frontendUrl}/dashboard/owner`,

          type:
            'account_onboarding',
        },
      )

    return {
      url: link.url,
    }
  }

  async getDashboardLink(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (
      !business?.stripeAccountId
    ) {
      return this.createConnectLink(
        businessId,
      )
    }

    const loginLink =
      await this.stripe.accounts.createLoginLink(
        business.stripeAccountId,
      )

    return {
      url: loginLink.url,
    }
  }

  async getBalance(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (
      !business?.stripeAccountId
    ) {
      return {
        connected: false,
        balance: 0,
      }
    }

    const balance =
      await this.stripe.balance.retrieve(
        {
          stripeAccount:
            business.stripeAccountId,
        },
      )

    return {
      connected: true,

      balance:
        (balance.available?.[0]
          ?.amount || 0) /
        100,
    }
  }

  async isStripeReady(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    return this.syncStripeAccountStatus(
      business,
    )
  }

  async refundOrder(
    paymentIntentId: string,
  ) {
    if (!paymentIntentId) {
      throw new BadRequestException(
        'No payment intent',
      )
    }

    try {
      const refund =
        await this.stripe.refunds.create(
          {
            payment_intent:
              paymentIntentId,
          },
        )

      return {
        success: true,
        refundId: refund.id,
      }
    } catch (err: any) {
      console.log(err)

      throw new BadRequestException(
        'Refund failed',
      )
    }
  }
}