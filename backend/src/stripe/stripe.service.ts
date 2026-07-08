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

@Injectable()
export class StripeService {
  private readonly logger =
    new Logger(
      StripeService.name,
    )

  private stripe: Stripe

  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {
    // 🔥 DIRECT STRIPE KEY
    const key =
      'sk_test_51Sxh4AKZAB5HMPha5usVVKGeyWcWBEqiFjVMGwPCVOFbbx56mJaJOcZrObsxj35zM92583ovMqnfGUI31JcL1rbP00TUzKY5xh'

    console.log(
      '🔥 USING STRIPE KEY:',
      key,
    )

    if (
      !key ||
      !key.startsWith('sk_')
    ) {
      throw new Error(
        '❌ Invalid Stripe key',
      )
    }

    this.logger.log(
      '✅ Stripe initialized',
    )

    this.stripe = new Stripe(
      key,
      {
        // 🔥 REQUIRED BY YOUR INSTALLED STRIPE SDK
        apiVersion:
          '2026-02-25.clover',
      },
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
        subtotal +
        serviceFeeAmount

      const platformFee =
        Math.round(
          finalTotal *
            100 *
            0.0075,
        )

      let paymentIntentData:
        | any
        | undefined =
        undefined

      if (
        business.stripeAccountId
      ) {
        try {
          const acc =
            await this.stripe.accounts.retrieve(
              business.stripeAccountId,
            )

          if (
            acc.charges_enabled &&
            acc.payouts_enabled
          ) {
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
          }
        } catch {}
      }

      const safeItems =
        data.items.map(
          (i) => ({
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
                i.price || 0,
              ),
          }),
        )

      // 🔥 DEBUG
      console.log(
        '🔥 CHECKOUT PAYLOAD:',
        {
          storeCode:
            data.storeCode,

          tableNumber:
            data.tableNumber,

          items: safeItems,
        },
      )

      const {
        businessId,
        storeCode,
        tableNumber,
        items,
      } = data

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
              ...data.items.map(
                (i) => {
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

                  return {
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
                            finalPrice *
                              100,
                          ),
                      },

                    quantity:
                      Number(
                        i.qty ||
                          1,
                      ),
                  }
                },
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

              items: JSON.stringify(
                data.items.map(
                  (i) => ({
                    id: i.id,

                    name:
                      i.name || 'Item',

                    qty:
                      Number(
                        i.qty || 1,
                      ),

                    price:
                      Number(
                        i.price || 0,
                      ),
                  }),
                ),
              ),
            },

            success_url:
              `http://localhost:3000/store/${data.storeCode}?success=1`,

            cancel_url:
              `http://localhost:3000/store/${data.storeCode}`,
          },
        )

      // 🔥 DEBUG
      console.log(
        '🔥 STRIPE SESSION CREATED:',
        session.id,
      )

      console.log(
        '🔥 SESSION METADATA:',
        session.metadata,
      )

      // 🔥 SAFE NON-BLOCKING TEST
      setTimeout(() => {
        try {
          console.log(
            '🔥 ORDER FLOW ACTIVE',
          )
        } catch (err: any) {
          console.log(
            '⚠️ ORDER FLOW ERROR:',
            err.message,
          )
        }
      }, 100)

      return {
        url: session.url,
      }
    } catch (err: any) {
      console.log(err)

      throw new BadRequestException(
        err?.message ||
          'Payment failed',
      )
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
            'http://localhost:3000/dashboard/owner',

          return_url:
            'http://localhost:3000/dashboard/owner',

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

    if (
      !business?.stripeAccountId
    ) {
      return null
    }

    const acc =
      await this.stripe.accounts.retrieve(
        business.stripeAccountId,
      )

    return {
      charges_enabled:
        acc.charges_enabled,

      payouts_enabled:
        acc.payouts_enabled,
    }
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