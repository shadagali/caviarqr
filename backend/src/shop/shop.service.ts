import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  DataSource,
  Repository,
} from 'typeorm'

import Stripe from 'stripe'

import { Resend } from 'resend'

import {
  randomBytes,
} from 'crypto'

import {
  ShopProduct,
} from './shop-product.entity'

import {
  ShopOrder,
} from './shop-order.entity'

import {
  ShopOrderItem,
} from './shop-order-item.entity'

import {
  SalesPartner,
  SalesPartnerStatus,
} from '../sales/entities/sales-partner.entity'

type CheckoutItemInput = {
  productId: number
  quantity: number
}

@Injectable()
export class ShopService {
  private readonly logger =
    new Logger(ShopService.name)

  private readonly stripe: Stripe

  private readonly resend:
    Resend | null

  private readonly emailFrom:
    string

  private readonly frontendUrl: string

  constructor(
    @InjectRepository(ShopProduct)
    private readonly productRepo:
      Repository<ShopProduct>,

    @InjectRepository(ShopOrder)
    private readonly orderRepo:
      Repository<ShopOrder>,

    @InjectRepository(ShopOrderItem)
    private readonly orderItemRepo:
      Repository<ShopOrderItem>,

    private readonly dataSource:
      DataSource,
  ) {
    const key =
      String(
        process.env.STRIPE_SECRET_KEY ||
          '',
      ).trim()

    const isProduction =
      process.env.NODE_ENV ===
      'production'

    if (!key) {
      throw new Error(
        'Missing STRIPE_SECRET_KEY.',
      )
    }

    if (
      isProduction &&
      !key.startsWith('sk_live_')
    ) {
      throw new Error(
        'Production requires a Stripe live secret key.',
      )
    }

    this.stripe =
      new Stripe(
        key,
        {
          apiVersion:
            '2026-02-25.clover',
        },
      )

    const resendKey =
      String(
        process.env.RESEND_API_KEY ||
          '',
      ).trim()

    this.resend =
      resendKey
        ? new Resend(
            resendKey,
          )
        : null

    this.emailFrom =
      String(
        process.env
          .MAINTENANCE_EMAIL_FROM ||
          'CaviarQR <onboarding@resend.dev>',
      ).trim()

    this.frontendUrl =
      String(
        process.env.FRONTEND_URL ||
          process.env.WEB_URL ||
          'http://localhost:3000',
      )
        .trim()
        .replace(/\/+$/, '')
  }

  async getPublicProducts() {
    return this.productRepo.find({
      where: {
        active: true,
      },

      order: {
        id: 'ASC',
      },
    })
  }

  async getAdminProducts() {
    return this.productRepo.find({
      order: {
        createdAt: 'DESC',
      },
    })
  }

  async createProduct(
    body: Record<string, unknown>,
  ) {
    const name =
      this.normalizeName(
        body?.name,
      )

    const description =
      this.normalizeDescription(
        body?.description,
      )

    const priceCents =
      this.normalizePriceCents(
        body?.priceCents,
      )

    const inventory =
      this.normalizeInventory(
        body?.inventory,
      )

    const active =
      body?.active === undefined
        ? true
        : body.active === true

    const product =
      this.productRepo.create({
        name,
        description,
        priceCents,
        inventory,
        active,
        imageUrl: null,
      })

    return this.productRepo.save(
      product,
    )
  }

  async updateProduct(
    id: number,
    body: Record<string, unknown>,
  ) {
    const product =
      await this.findProduct(id)

    if (
      body.name !== undefined
    ) {
      product.name =
        this.normalizeName(
          body.name,
        )
    }

    if (
      body.description !==
      undefined
    ) {
      product.description =
        this.normalizeDescription(
          body.description,
        )
    }

    if (
      body.priceCents !==
      undefined
    ) {
      product.priceCents =
        this.normalizePriceCents(
          body.priceCents,
        )
    }

    if (
      body.inventory !==
      undefined
    ) {
      product.inventory =
        this.normalizeInventory(
          body.inventory,
        )
    }

    if (
      body.active !== undefined
    ) {
      product.active =
        body.active === true
    }

    return this.productRepo.save(
      product,
    )
  }

  async setProductImage(
    id: number,
    imageUrl: string,
  ) {
    const product =
      await this.findProduct(id)

    product.imageUrl =
      String(
        imageUrl || '',
      ).trim()

    if (!product.imageUrl) {
      throw new BadRequestException(
        'Image URL is required.',
      )
    }

    return this.productRepo.save(
      product,
    )
  }

  async getOrders(
    input: {
      view?: unknown
      limit?: unknown
      cursor?: unknown
      search?: unknown
    } = {},
  ) {
    const view =
      String(
        input?.view ||
          'active',
      )
        .trim()
        .toLowerCase() ===
      'past'
        ? 'past'
        : 'active'

    const parsedLimit =
      Number(
        input?.limit ||
          50,
      )

    const limit =
      Number.isInteger(
        parsedLimit,
      )
        ? Math.min(
            Math.max(
              parsedLimit,
              1,
            ),
            100,
          )
        : 50

    const parsedCursor =
      Number(
        input?.cursor ||
          0,
      )

    const cursor =
      Number.isInteger(
        parsedCursor,
      ) &&
      parsedCursor > 0
        ? parsedCursor
        : null

    const search =
      String(
        input?.search ||
          '',
      )
        .trim()
        .slice(
          0,
          120,
        )

    const applyFilters = (
      qb: any,
    ) => {
      qb.andWhere(
        '"shopOrder"."paymentStatus" = :paid',
        {
          paid:
            'PAID',
        },
      )

      if (
        view ===
        'past'
      ) {
        qb.andWhere(
          `(
            "shopOrder"."fulfillmentStatus" = :delivered
            OR "shopOrder"."refundStatus" IN (:...pastRefundStatuses)
          )`,
          {
            delivered:
              'DELIVERED',

            pastRefundStatuses: [
              'SUCCEEDED',
              'PENDING',
            ],
          },
        )
      } else {
        qb.andWhere(
          '"shopOrder"."fulfillmentStatus" <> :delivered',
          {
            delivered:
              'DELIVERED',
          },
        )

        qb.andWhere(
          '"shopOrder"."refundStatus" NOT IN (:...inactiveRefundStatuses)',
          {
            inactiveRefundStatuses: [
              'SUCCEEDED',
              'PENDING',
            ],
          },
        )
      }

      if (search) {
        qb.andWhere(
          `(
            "shopOrder"."orderNumber" ILIKE :search
            OR COALESCE("shopOrder"."email", '') ILIKE :search
            OR COALESCE("shopOrder"."customerName", '') ILIKE :search
            OR COALESCE("shopOrder"."trackingNumber", '') ILIKE :search
          )`,
          {
            search:
              `%${search}%`,
          },
        )
      }

      return qb
    }

    const countQuery =
      this.orderRepo
        .createQueryBuilder(
          'shopOrder',
        )

    applyFilters(
      countQuery,
    )

    const total =
      await countQuery
        .getCount()

    const pageQuery =
      this.orderRepo
        .createQueryBuilder(
          'shopOrder',
        )

    applyFilters(
      pageQuery,
    )

    if (cursor) {
      pageQuery.andWhere(
        '"shopOrder"."id" < :cursor',
        {
          cursor,
        },
      )
    }

    const rows =
      await pageQuery
        .orderBy(
          'shopOrder.id',
          'DESC',
        )
        .take(
          limit + 1,
        )
        .getMany()

    const hasMore =
      rows.length >
      limit

    const orders =
      hasMore
        ? rows.slice(
            0,
            limit,
          )
        : rows

    const orderIds =
      orders.map(
        order =>
          order.id,
      )

    const items =
      orderIds.length
        ? await this
            .orderItemRepo
            .createQueryBuilder(
              'item',
            )
            .where(
              'item."orderId" IN (:...orderIds)',
              {
                orderIds,
              },
            )
            .orderBy(
              'item.id',
              'ASC',
            )
            .getMany()
        : []

    const itemsByOrder =
      new Map<
        number,
        ShopOrderItem[]
      >()

    for (
      const item
      of items
    ) {
      const existing =
        itemsByOrder.get(
          item.orderId,
        ) || []

      existing.push(
        item,
      )

      itemsByOrder.set(
        item.orderId,
        existing,
      )
    }

    const nextCursor =
      hasMore &&
      orders.length
        ? orders[
            orders.length -
              1
          ].id
        : null

    return {
      orders:
        orders.map(
          order => ({
            ...order,

            items:
              itemsByOrder.get(
                order.id,
              ) || [],
          }),
        ),

      page: {
        view,
        limit,
        total,
        hasMore,
        nextCursor,
      },
    }
  }

  async updateFulfillment(
    id: number,
    body: Record<string, unknown>,
  ) {
    if (
      !Number.isInteger(id) ||
      id < 1
    ) {
      throw new BadRequestException(
        'Invalid shop order.',
      )
    }

    const order =
      await this.orderRepo
        .findOne({
          where: {
            id,
          },
        })

    if (!order) {
      throw new NotFoundException(
        'Shop order not found.',
      )
    }

    if (
      order.paymentStatus !==
      'PAID'
    ) {
      throw new BadRequestException(
        'Only paid hardware orders can be fulfilled.',
      )
    }

    if (
      order.refundStatus ===
        'SUCCEEDED' ||
      order.refundStatus ===
        'PENDING'
    ) {
      throw new BadRequestException(
        'Refunded hardware orders cannot be fulfilled.',
      )
    }

    const fulfillmentStatus =
      String(
        body
          ?.fulfillmentStatus ||
          '',
      )
        .trim()
        .toUpperCase()

    const allowed =
      new Set([
        'UNFULFILLED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
      ])

    if (
      !allowed.has(
        fulfillmentStatus,
      )
    ) {
      throw new BadRequestException(
        'Invalid fulfillment status.',
      )
    }

    const trackingNumber =
      String(
        body?.trackingNumber ||
          '',
      )
        .trim()
        .slice(
          0,
          120,
        )

    order.fulfillmentStatus =
      fulfillmentStatus

    order.trackingNumber =
      trackingNumber ||
      null

    if (
      fulfillmentStatus ===
      'DELIVERED'
    ) {
      if (!order.shippedAt) {
        order.shippedAt =
          new Date()
      }

      if (!order.deliveredAt) {
        order.deliveredAt =
          new Date()
      }
    } else {
      order.deliveredAt =
        null

      if (
        fulfillmentStatus ===
        'SHIPPED'
      ) {
        if (!order.shippedAt) {
          order.shippedAt =
            new Date()
        }
      } else {
        order.shippedAt =
          null
      }
    }

    return this.orderRepo
      .save(
        order,
      )
  }

  private async sendHardwareRefundConfirmation(
    orderId: number,
  ): Promise<void> {
    try {
      const existing =
        await this.orderRepo
          .findOne({
            where: {
              id: orderId,
            },
          })

      if (
        !existing ||
        existing.refundStatus !==
          'SUCCEEDED' ||
        !existing.email ||
        existing
          .refundConfirmationEmailSentAt
      ) {
        return
      }

      /*
       * Atomically claim the email.
       * A stale claim may be retried
       * after two minutes.
       */
      const claimBefore =
        new Date(
          Date.now() -
            2 * 60 * 1000,
        )

      const claim =
        await this.orderRepo
          .createQueryBuilder()
          .update(ShopOrder)
          .set({
            refundConfirmationEmailLastAttemptAt:
              new Date(),

            refundConfirmationEmailAttempts:
              () =>
                '"refundConfirmationEmailAttempts" + 1',

            refundConfirmationEmailFailureMessage:
              null,
          })
          .where(
            '"id" = :orderId',
            {
              orderId,
            },
          )
          .andWhere(
            '"refundStatus" = :refundStatus',
            {
              refundStatus:
                'SUCCEEDED',
            },
          )
          .andWhere(
            '"email" IS NOT NULL',
          )
          .andWhere(
            '"refundConfirmationEmailSentAt" IS NULL',
          )
          .andWhere(
            `(
              "refundConfirmationEmailLastAttemptAt" IS NULL
              OR "refundConfirmationEmailLastAttemptAt" < :claimBefore
            )`,
            {
              claimBefore,
            },
          )
          .execute()

      if (
        !claim.affected
      ) {
        return
      }

      const order =
        await this.orderRepo
          .findOne({
            where: {
              id: orderId,
            },
          })

      if (
        !order ||
        !order.email
      ) {
        return
      }

      if (!this.resend) {
        await this.orderRepo
          .update(
            orderId,
            {
              refundConfirmationEmailFailureMessage:
                'RESEND_API_KEY is not configured.',
            },
          )

        this.logger.error(
          `SHOP_REFUND_EMAIL_FAILED order=${orderId}: RESEND_API_KEY missing`,
        )

        return
      }

      const customerName =
        this.escapeHtml(
          order.customerName ||
            'there',
        )

      const orderNumber =
        this.escapeHtml(
          order.orderNumber,
        )

      const refundAmount =
        this.escapeHtml(
          this.shopMoney(
            order
              .refundAmountCents ??
              order.totalCents,
          ),
        )

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#111111;line-height:1.5;">
          <h1 style="font-size:26px;margin:0 0 18px;">
            Your refund has been issued
          </h1>

          <p>
            Hi ${customerName},
          </p>

          <p>
            Your refund for CaviarQR order
            <strong>${orderNumber}</strong>
            has been processed.
          </p>

          <div style="background:#f7f7f7;border-radius:12px;padding:18px;margin:22px 0;">
            <div style="font-size:13px;color:#666666;">
              Refund amount
            </div>

            <div style="font-size:24px;font-weight:700;margin-top:4px;">
              ${refundAmount}
            </div>
          </div>

          <p>
            The refund was sent back to your original payment method.
            Your bank or card issuer may take several business days
            to display the credit.
          </p>

          <p style="margin-top:28px;">
            Thank you,<br />
            CaviarQR
          </p>
        </div>
      `

      const idempotencyKey =
        `hardware-refund-confirmation-${order.orderNumber}`
          .slice(
            0,
            255,
          )

      let lastError:
        unknown = null

      for (
        let attempt = 1;
        attempt <= 3;
        attempt++
      ) {
        try {
          const response =
            await this.resend
              .emails
              .send(
                {
                  from:
                    this.emailFrom,

                  to:
                    order.email,

                  subject:
                    `CaviarQR refund confirmed · ${order.orderNumber}`,

                  html,
                },
                {
                  idempotencyKey,
                },
              )

          if (
            response.error
          ) {
            throw new Error(
              response.error.message ||
                'Resend rejected the refund confirmation email.',
            )
          }

          await this.orderRepo
            .update(
              orderId,
              {
                refundConfirmationEmailSentAt:
                  new Date(),

                refundConfirmationEmailFailureMessage:
                  null,
              },
            )

          this.logger.log(
            `SHOP_REFUND_EMAIL_SENT order=${orderId}`,
          )

          return
        } catch (error) {
          lastError =
            error

          if (
            attempt < 3
          ) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  attempt === 1
                    ? 500
                    : 1000,
                ),
            )
          }
        }
      }

      const message =
        String(
          (
            lastError as {
              message?: unknown
            }
          )?.message ||
            'Refund confirmation email failed.',
        )
          .slice(
            0,
            1000,
          )

      await this.orderRepo
        .update(
          orderId,
          {
            refundConfirmationEmailFailureMessage:
              message,
          },
        )

      this.logger.error(
        `SHOP_REFUND_EMAIL_FAILED order=${orderId}: ${message}`,
      )
    } catch (error) {
      /*
       * Email must NEVER cause a
       * successful Stripe refund to
       * become a failed refund request.
       */
      this.logger.error(
        `SHOP_REFUND_EMAIL_INTERNAL_ERROR order=${orderId}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      )
    }
  }

  async refundHardwareOrder(
    id: number,
    body: Record<string, unknown>,
  ) {
    if (
      !Number.isInteger(id) ||
      id < 1
    ) {
      throw new BadRequestException(
        'Invalid hardware order.',
      )
    }

    const reason =
      String(
        body?.reason ||
          '',
      )
        .trim()
        .slice(
          0,
          500,
        )

    if (
      reason.length < 3
    ) {
      throw new BadRequestException(
        'Refund reason is required.',
      )
    }

    let order =
      await this.orderRepo
        .findOne({
          where: {
            id,
          },
        })

    if (!order) {
      throw new NotFoundException(
        'Hardware order not found.',
      )
    }

    if (
      order.refundStatus ===
        'SUCCEEDED' &&
      order.stripeRefundId
    ) {
      await this
        .sendHardwareRefundConfirmation(
          order.id,
        )

      return {
        success: true,
        alreadyRefunded: true,
        order,
      }
    }

    if (
      order.paymentStatus !==
      'PAID'
    ) {
      throw new BadRequestException(
        'Only paid hardware orders can be refunded.',
      )
    }

    if (
      !order
        .stripePaymentIntentId
    ) {
      throw new BadRequestException(
        'This hardware order has no Stripe PaymentIntent.',
      )
    }

    const idempotencyKey =
      order
        .refundIdempotencyKey ||
      `caviarqr-hardware-refund-${order.orderNumber}`
        .slice(
          0,
          255,
        )

    /*
     * The same key is permanently
     * associated with this order.
     * Repeated clicks/retries cannot
     * create multiple Stripe refunds.
     */
    order.refundIdempotencyKey =
      idempotencyKey

    order.refundReason =
      reason

    order.refundRequestedAt =
      order.refundRequestedAt ||
      new Date()

    order.refundStatus =
      'CREATING'

    order.refundFailureMessage =
      null

    await this.orderRepo
      .save(
        order,
      )

    try {
      const refund =
        await this.stripe
          .refunds
          .create(
            {
              payment_intent:
                order
                  .stripePaymentIntentId,

              reason:
                'requested_by_customer',

              metadata: {
                checkoutType:
                  'hardware_store',

                shopOrderId:
                  String(
                    order.id,
                  ),

                orderNumber:
                  order.orderNumber,

                source:
                  'caviarqr_maintenance',
              },
            },
            {
              idempotencyKey,
            },
          )

      const stripeStatus =
        String(
          refund.status ||
            'unknown',
        )
          .trim()
          .toUpperCase()

      order.stripeRefundId =
        refund.id

      order.refundAmountCents =
        Number(
          refund.amount ||
            order.totalCents,
        )

      order.refundStatus =
        stripeStatus ===
        'SUCCEEDED'
          ? 'SUCCEEDED'
          : stripeStatus ===
              'PENDING'
            ? 'PENDING'
            : stripeStatus

      order.refundedAt =
        order.refundStatus ===
        'SUCCEEDED'
          ? new Date()
          : null

      order.refundFailureMessage =
        null

      order =
        await this.orderRepo
          .save(
            order,
          )

      this.logger.log(
        `SHOP_REFUND_CREATED order=${order.id} refund=${refund.id} status=${order.refundStatus}`,
      )

      if (
        order.refundStatus ===
        'SUCCEEDED'
      ) {
        await this
          .sendHardwareRefundConfirmation(
            order.id,
          )
      }

      return {
        success: true,
        alreadyRefunded: false,
        order,
      }
    } catch (
      error: any
    ) {
      /*
       * Network/API failures can be
       * ambiguous. Retrying this order
       * remains safe because Stripe
       * receives the same idempotency
       * key every time.
       */
      const errorType =
        String(
          error?.type ||
            '',
        )

      const uncertain =
        errorType ===
          'StripeConnectionError' ||
        errorType ===
          'StripeAPIError'

      order.refundStatus =
        uncertain
          ? 'UNKNOWN'
          : 'FAILED'

      order.refundFailureMessage =
        String(
          error?.message ||
            'Hardware refund failed.',
        )
          .slice(
            0,
            1000,
          )

      await this.orderRepo
        .save(
          order,
        )

      this.logger.error(
        `SHOP_REFUND_FAILED order=${order.id} status=${order.refundStatus}: ${order.refundFailureMessage}`,
      )

      throw new BadRequestException(
        uncertain
          ? 'Refund status is uncertain. Retry this same order; duplicate refunds are prevented.'
          : order
              .refundFailureMessage,
      )
    }
  }

  async createCheckout(
    body: {
      items?: CheckoutItemInput[]
      salesCode?: string
    },
  ) {
    /*
     * Referral codes are never trusted
     * for partner IDs or discount amounts.
     * The browser supplies only a code.
     */
    const salesCode =
      String(
        body?.salesCode || '',
      )
        .trim()
        .toUpperCase()

    if (
      salesCode.length > 32
    ) {
      throw new BadRequestException(
        'Sales Partner code is invalid or unavailable.',
      )
    }

    const requested =
      this.normalizeCheckoutItems(
        body?.items,
      )

    const ids =
      [...requested.keys()]

    const expiresAt =
      new Date(
        Date.now() +
          35 * 60 * 1000,
      )

    const reserved =
      await this.dataSource
        .transaction(
          async (manager) => {
            /*
             * Resolve attribution inside the same
             * transaction that creates the hardware
             * order. Only ACTIVE partners may create
             * new attributed sales.
             */
            let salesPartner:
              SalesPartner | null =
              null

            if (salesCode) {
              salesPartner =
                await manager
                  .getRepository(
                    SalesPartner,
                  )
                  .createQueryBuilder(
                    'salesPartner',
                  )
                  .setLock(
                    'pessimistic_read',
                  )
                  .where(
                    'salesPartner.referralCode = :salesCode',
                    {
                      salesCode,
                    },
                  )
                  .andWhere(
                    'salesPartner.status = :salesPartnerStatus',
                    {
                      salesPartnerStatus:
                        SalesPartnerStatus
                          .ACTIVE,
                    },
                  )
                  .getOne()

              if (!salesPartner) {
                throw new BadRequestException(
                  'Sales Partner code is invalid or unavailable.',
                )
              }
            }

            const hardwareDiscountBps =
              salesPartner
                ? Number(
                    salesPartner
                      .hardwareDiscountBps ||
                      0,
                  )
                : 0

            if (
              !Number.isInteger(
                hardwareDiscountBps,
              ) ||
              hardwareDiscountBps < 0 ||
              hardwareDiscountBps >
                10000
            ) {
              throw new BadRequestException(
                'Sales Partner promotion is unavailable.',
              )
            }

            const productRepo =
              manager.getRepository(
                ShopProduct,
              )

            const products =
              await productRepo
                .createQueryBuilder(
                  'product',
                )
                .setLock(
                  'pessimistic_write',
                )
                .where(
                  'product.id IN (:...ids)',
                  {
                    ids,
                  },
                )
                .getMany()

            if (
              products.length !==
              ids.length
            ) {
              throw new BadRequestException(
                'One or more products are unavailable.',
              )
            }

            /*
             * subtotalCents remains the original
             * merchandise subtotal. The actual
             * Sales Partner discount is snapshotted
             * separately on ShopOrder.
             */
            let subtotalCents = 0
            let salesDiscountCents = 0

            const lineData:
              {
                product:
                  ShopProduct
                quantity:
                  number
                checkoutUnitPriceCents:
                  number
              }[] = []

            for (
              const product
              of products
            ) {
              const quantity =
                requested.get(
                  product.id,
                ) || 0

              if (!product.active) {
                throw new BadRequestException(
                  `${product.name} is unavailable.`,
                )
              }

              if (
                product.inventory <
                quantity
              ) {
                throw new BadRequestException(
                  `${product.name} does not have enough stock.`,
                )
              }

              subtotalCents +=
                product.priceCents *
                quantity

              /*
               * Discount each physical unit in
               * integer cents. This guarantees
               * the amount saved in our database
               * exactly matches the Stripe line
               * item amounts we later create.
               */
              const unitDiscountCents =
                Math.floor(
                  (
                    product.priceCents *
                    hardwareDiscountBps
                  ) /
                    10000,
                )

              const checkoutUnitPriceCents =
                product.priceCents -
                unitDiscountCents

              if (
                checkoutUnitPriceCents <
                0
              ) {
                throw new BadRequestException(
                  'Sales Partner promotion is unavailable.',
                )
              }

              salesDiscountCents +=
                unitDiscountCents *
                quantity

              product.inventory -=
                quantity

              lineData.push({
                product,
                quantity,
                checkoutUnitPriceCents,
              })
            }

            await productRepo.save(
              products,
            )

            const shippingCents = 0

            const totalCents =
              subtotalCents -
              salesDiscountCents +
              shippingCents

            const orderRepo =
              manager.getRepository(
                ShopOrder,
              )

            const orderNumber =
              `CQ-${randomBytes(8)
                .toString('hex')
                .toUpperCase()}`

            const order =
              await orderRepo.save(
                orderRepo.create({
                  orderNumber,

                  email: null,

                  customerName:
                    null,

                  phone: null,

                  shippingAddress:
                    null,

                  subtotalCents,

                  shippingCents,

                  totalCents,

                  currency:
                    'usd',

                  stripeCheckoutSessionId:
                    null,

                  stripePaymentIntentId:
                    null,

                  paymentStatus:
                    'PENDING',

                  fulfillmentStatus:
                    'UNFULFILLED',

                  trackingNumber:
                    null,

                  inventoryReserved:
                    true,

                  checkoutExpiresAt:
                    expiresAt,

                  /*
                   * Immutable Sales Partner
                   * attribution snapshot.
                   * Never derive historical
                   * attribution from a mutable
                   * referral code later.
                   */
                  salesPartnerId:
                    salesPartner
                      ?.id ||
                    null,

                  salesCode:
                    salesPartner
                      ? salesCode
                      : null,

                  salesDiscountCents,

                  paidAt: null,

                  shippedAt: null,
                }),
              )

            const itemRepo =
              manager.getRepository(
                ShopOrderItem,
              )

            const items =
              lineData.map(
                ({
                  product,
                  quantity,
                }) =>
                  itemRepo.create({
                    orderId:
                      order.id,

                    productId:
                      product.id,

                    productName:
                      product.name,

                    /*
                     * Historical list price
                     * snapshot before the
                     * referral discount.
                     */
                    unitPriceCents:
                      product
                        .priceCents,

                    quantity,
                  }),
              )

            await itemRepo.save(
              items,
            )

            const checkoutItems =
              lineData.map(
                ({
                  product,
                  quantity,
                  checkoutUnitPriceCents,
                }) => ({
                  productName:
                    product.name,

                  unitPriceCents:
                    checkoutUnitPriceCents,

                  quantity,
                }),
              )

            return {
              order,
              items,
              checkoutItems,
            }
          },
        )

    const metadata: {
      [key: string]:
        string
    } = {
      checkoutType:
        'hardware_store',

      shopOrderId:
        String(
          reserved.order.id,
        ),

      orderNumber:
        reserved.order
          .orderNumber,
    }

    if (
      reserved.order
        .salesPartnerId &&
      reserved.order
        .salesCode
    ) {
      metadata.salesPartnerId =
        String(
          reserved.order
            .salesPartnerId,
        )

      metadata.salesCode =
        reserved.order
          .salesCode

      metadata.salesDiscountCents =
        String(
          reserved.order
            .salesDiscountCents ||
            0,
        )
    }

    let session:
      Stripe.Checkout.Session | null =
      null

    try {
      session =
        await this.stripe
          .checkout
          .sessions
          .create(
            {
              mode: 'payment',

              payment_method_types: [
                'card',
              ],

              line_items:
                reserved
                  .checkoutItems
                  .map(
                  (item) => ({
                    price_data: {
                      currency:
                        'usd',

                      product_data: {
                        name:
                          item
                            .productName,
                      },

                      unit_amount:
                        item
                          .unitPriceCents,
                    },

                    quantity:
                      item.quantity,
                  }),
                ),

              customer_creation:
                'always',

              billing_address_collection:
                'auto',

              shipping_address_collection:
                {
                  allowed_countries: [
                    'US',
                  ],
                },

              phone_number_collection:
                {
                  enabled: true,
                },

              payment_intent_data:
                {
                  metadata,
                },

              metadata,

              expires_at:
                Math.floor(
                  expiresAt.getTime() /
                    1000,
                ),

              success_url:
                `${this.frontendUrl}/shop?success=1&order=${encodeURIComponent(
                  reserved.order
                    .orderNumber,
                )}`,

              cancel_url:
                `${this.frontendUrl}/shop?canceled=1`,
            },
            {
              idempotencyKey:
                `caviarqr-shop-${reserved.order.orderNumber}`,
            },
          )

      if (!session.url) {
        throw new Error(
          'Stripe did not return a Checkout URL.',
        )
      }

      await this.orderRepo.update(
        reserved.order.id,
        {
          stripeCheckoutSessionId:
            session.id,
        },
      )

      return {
        success: true,

        orderNumber:
          reserved.order
            .orderNumber,

        url:
          session.url,
      }
    } catch (error) {
      let safeToReleaseInventory =
        session === null

      if (session?.id) {
        try {
          const expiredSession =
            await this.stripe
              .checkout
              .sessions
              .expire(
                session.id,
              )

          safeToReleaseInventory =
            expiredSession.status ===
            'expired'
        } catch (expireError) {
          this.logger.error(
            `SHOP_CHECKOUT_EXPIRE_FAILED: ${session.id}`,
            expireError instanceof Error
              ? expireError.stack
              : String(
                  expireError,
                ),
          )
        }
      }

      if (
        safeToReleaseInventory
      ) {
        await this
          .releaseReservedInventory(
            reserved.order.id,
            'CHECKOUT_FAILED',
          )
      } else {
        this.logger.error(
          `SHOP_CHECKOUT_RESERVATION_RETAINED: order ${reserved.order.id}, Stripe session ${session?.id || 'unknown'}`,
        )
      }

      this.logger.error(
        'SHOP_CHECKOUT_CREATE_FAILED',
        error instanceof Error
          ? error.stack
          : String(error),
      )

      throw new BadRequestException(
        'Could not start shop checkout.',
      )
    }
  }

  async handleCheckoutCompleted(
    session:
      Stripe.Checkout.Session,
  ) {
    const orderId =
      Number(
        session.metadata
          ?.shopOrderId ||
          0,
      )

    if (
      !Number.isInteger(
        orderId,
      ) ||
      orderId < 1
    ) {
      throw new Error(
        'SHOP_ORDER_ID_MISSING',
      )
    }

    if (
      session.payment_status !==
      'paid'
    ) {
      this.logger.warn(
        `Shop Checkout ${session.id} completed without paid status.`,
      )

      return
    }

    await this.dataSource
      .transaction(
        async manager => {
          const orderRepo =
            manager.getRepository(
              ShopOrder,
            )

          const order =
            await orderRepo
              .findOne({
                where: {
                  id:
                    orderId,
                },

                lock: {
                  mode:
                    'pessimistic_write',
                },
              })

          if (!order) {
            throw new Error(
              'SHOP_ORDER_NOT_FOUND',
            )
          }

          /*
           * Stripe can deliver both
           * checkout.session.completed
           * and async_payment_succeeded,
           * and can retry events.
           *
           * Never re-apply payment state,
           * but still continue afterward
           * to the idempotent email sender.
           */
          if (
            order.paymentStatus ===
            'PAID'
          ) {
            return
          }

          const paymentIntentId =
            typeof session
              .payment_intent ===
            'string'
              ? session
                  .payment_intent
              : session
                  .payment_intent
                  ?.id ||
                null

          const details =
            session
              .customer_details

          const anySession =
            session as any

          const shipping =
            anySession
              .collected_information
              ?.shipping_details ||
            anySession
              .shipping_details ||
            null

          order.email =
            details?.email ||
            null

          order.customerName =
            shipping?.name ||
            details?.name ||
            null

          order.phone =
            details?.phone ||
            null

          order.shippingAddress =
            shipping?.address ||
            details?.address ||
            null

          order.stripeCheckoutSessionId =
            session.id

          order.stripePaymentIntentId =
            paymentIntentId

          order.paymentStatus =
            'PAID'

          order.inventoryReserved =
            false

          order.paidAt =
            order.paidAt ||
            new Date()

          await orderRepo
            .save(
              order,
            )
        },
      )

    /*
     * Email failure must NEVER undo
     * the successful Stripe payment
     * or make the hardware order
     * disappear.
     */
    await this
      .sendHardwareOrderConfirmation(
        orderId,
      )
  }

  private escapeHtml(
    value: unknown,
  ) {
    return String(
      value ?? '',
    )
      .replace(
        /&/g,
        '&amp;',
      )
      .replace(
        /</g,
        '&lt;',
      )
      .replace(
        />/g,
        '&gt;',
      )
      .replace(
        /"/g,
        '&quot;',
      )
      .replace(
        /'/g,
        '&#039;',
      )
  }

  private shopMoney(
    cents: number,
  ) {
    return new Intl
      .NumberFormat(
        'en-US',
        {
          style:
            'currency',

          currency:
            'USD',
        },
      )
      .format(
        Number(
          cents ||
            0,
        ) / 100,
      )
  }

  private hardwareAddressHtml(
    address:
      Record<
        string,
        unknown
      > | null,
  ) {
    if (!address) {
      return '—'
    }

    const values = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ]
      .filter(Boolean)
      .map(
        value =>
          this.escapeHtml(
            value,
          ),
      )

    return (
      values.join(
        '<br>',
      ) ||
      '—'
    )
  }

  private async sendHardwareOrderConfirmation(
    orderId: number,
  ) {
    try {
      const existing =
        await this.orderRepo
          .findOne({
            where: {
              id:
                orderId,
            },
          })

      if (
        !existing ||
        existing.paymentStatus !==
          'PAID' ||
        existing
          .confirmationEmailSentAt
      ) {
        return
      }

      if (!existing.email) {
        await this.orderRepo
          .update(
            orderId,
            {
              confirmationEmailFailureMessage:
                'Paid hardware order has no customer email.',
            },
          )

        this.logger.warn(
          `SHOP_CONFIRMATION_EMAIL_SKIPPED order=${orderId} missing_email`,
        )

        return
      }

      /*
       * Claim one sender at a time.
       *
       * A later Stripe retry may claim
       * again after two minutes if an
       * earlier email attempt failed.
       */
      const retryCutoff =
        new Date(
          Date.now() -
            2 *
              60 *
              1000,
        )

      const claim =
        await this.orderRepo
          .createQueryBuilder()
          .update(
            ShopOrder,
          )
          .set({
            confirmationEmailLastAttemptAt:
              () =>
                'CURRENT_TIMESTAMP',

            confirmationEmailAttempts:
              () =>
                '"confirmationEmailAttempts" + 1',

            confirmationEmailFailureMessage:
              null,
          })
          .where(
            '"id" = :id',
            {
              id:
                orderId,
            },
          )
          .andWhere(
            '"paymentStatus" = :paid',
            {
              paid:
                'PAID',
            },
          )
          .andWhere(
            '"confirmationEmailSentAt" IS NULL',
          )
          .andWhere(
            `(
              "confirmationEmailLastAttemptAt" IS NULL
              OR "confirmationEmailLastAttemptAt" < :retryCutoff
            )`,
            {
              retryCutoff,
            },
          )
          .execute()

      if (
        !claim.affected
      ) {
        return
      }

      const order =
        await this.orderRepo
          .findOne({
            where: {
              id:
                orderId,
            },
          })

      if (
        !order ||
        !order.email
      ) {
        return
      }

      const items =
        await this.orderItemRepo
          .find({
            where: {
              orderId,
            },

            order: {
              id:
                'ASC',
            },
          })

      if (!this.resend) {
        await this.orderRepo
          .update(
            orderId,
            {
              confirmationEmailFailureMessage:
                'RESEND_API_KEY is not configured.',
            },
          )

        this.logger.error(
          `SHOP_CONFIRMATION_EMAIL_FAILED order=${orderId}: RESEND_API_KEY missing`,
        )

        return
      }

      const customerName =
        this.escapeHtml(
          order.customerName ||
            'there',
        )

      const orderNumber =
        this.escapeHtml(
          order.orderNumber,
        )

      const rows =
        items
          .map(
            item => `
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #eeeeee;">
                  ${this.escapeHtml(item.productName)}
                  <div style="font-size:13px;color:#666666;margin-top:3px;">
                    Qty ${item.quantity}
                  </div>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #eeeeee;text-align:right;white-space:nowrap;">
                  ${this.escapeHtml(
                    this.shopMoney(
                      item.unitPriceCents *
                        item.quantity,
                    ),
                  )}
                </td>
              </tr>
            `,
          )
          .join('')

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#111111;line-height:1.5;">
          <h1 style="font-size:26px;margin:0 0 18px;">
            Order confirmed
          </h1>

          <p>
            Hi ${customerName},
          </p>

          <p>
            Thanks for your CaviarQR order. We received your payment and are preparing your QR stand order.
          </p>

          <div style="background:#f7f7f7;border-radius:12px;padding:16px 18px;margin:22px 0;">
            <strong>Order ${orderNumber}</strong>
          </div>

          <table style="border-collapse:collapse;width:100%;margin:18px 0;">
            <tbody>
              ${rows}
            </tbody>
          </table>

          <table style="border-collapse:collapse;width:100%;margin-top:18px;">
            <tbody>
              <tr>
                <td style="padding:5px 0;">
                  Subtotal
                </td>
                <td style="padding:5px 0;text-align:right;">
                  ${this.escapeHtml(
                    this.shopMoney(
                      order.subtotalCents,
                    ),
                  )}
                </td>
              </tr>

              <tr>
                <td style="padding:5px 0;">
                  Shipping
                </td>
                <td style="padding:5px 0;text-align:right;">
                  ${order.shippingCents > 0
                    ? this.escapeHtml(
                        this.shopMoney(
                          order.shippingCents,
                        ),
                      )
                    : 'Free'}
                </td>
              </tr>

              <tr>
                <td style="padding:10px 0 5px;font-weight:700;">
                  Total paid
                </td>
                <td style="padding:10px 0 5px;text-align:right;font-weight:700;">
                  ${this.escapeHtml(
                    this.shopMoney(
                      order.totalCents,
                    ),
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 style="font-size:17px;margin:28px 0 8px;">
            Shipping address
          </h2>

          <div style="color:#333333;">
            ${this.hardwareAddressHtml(
              (
                order.shippingAddress ||
                null
              ) as Record<string, unknown> | null,
            )}
          </div>

          <p style="margin-top:28px;">
            We’ll send tracking information when your order ships.
          </p>

          <p style="margin-top:30px;color:#666666;font-size:13px;">
            CaviarQR
          </p>
        </div>
      `

      const idempotencyKey =
        `hardware-order-confirmation-${order.orderNumber}`
          .slice(
            0,
            250,
          )

      let lastError:
        Error | null =
          null

      /*
       * Three immediate retries use
       * the SAME Resend idempotency
       * key. If the first request
       * succeeded but its response
       * was lost, the retry cannot
       * send another copy.
       */
      for (
        let attempt = 1;
        attempt <= 3;
        attempt++
      ) {
        try {
          const response =
            await this.resend
              .emails
              .send(
                {
                  from:
                    this.emailFrom,

                  to: [
                    order.email,
                  ],

                  subject:
                    `CaviarQR order ${order.orderNumber} confirmed`,

                  html,
                },
                {
                  idempotencyKey,
                },
              )

          if (
            response.error
          ) {
            throw new Error(
              response.error
                .message ||
                'Resend rejected the confirmation email.',
            )
          }

          await this.orderRepo
            .update(
              orderId,
              {
                confirmationEmailSentAt:
                  new Date(),

                confirmationEmailFailureMessage:
                  null,
              },
            )

          this.logger.log(
            `SHOP_CONFIRMATION_EMAIL_SENT order=${orderId}`,
          )

          return
        } catch (
          error: any
        ) {
          lastError =
            error instanceof Error
              ? error
              : new Error(
                  String(
                    error,
                  ),
                )

          if (
            attempt < 3
          ) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  attempt *
                    500,
                ),
            )
          }
        }
      }

      await this.orderRepo
        .update(
          orderId,
          {
            confirmationEmailFailureMessage:
              String(
                lastError
                  ?.message ||
                  'Confirmation email failed.',
              )
                .slice(
                  0,
                  1000,
                ),
          },
        )

      this.logger.error(
        `SHOP_CONFIRMATION_EMAIL_FAILED order=${orderId}: ${lastError?.message || 'unknown error'}`,
      )
    } catch (
      error: any
    ) {
      /*
       * Hardware payment is already
       * final. Never fail the Stripe
       * webhook solely because the
       * confirmation email subsystem
       * encountered a problem.
       */
      this.logger.error(
        `SHOP_CONFIRMATION_EMAIL_ERROR order=${orderId}`,
        error instanceof Error
          ? error.stack
          : String(
              error,
            ),
      )
    }
  }

  async handleCheckoutFailed(
    session:
      Stripe.Checkout.Session,
  ) {
    const orderId =
      Number(
        session.metadata
          ?.shopOrderId || 0,
      )

    if (
      Number.isInteger(orderId) &&
      orderId > 0
    ) {
      await this
        .releaseReservedInventory(
          orderId,
          'FAILED',
        )
    }
  }

  async handleCheckoutExpired(
    session:
      Stripe.Checkout.Session,
  ) {
    const orderId =
      Number(
        session.metadata
          ?.shopOrderId || 0,
      )

    if (
      Number.isInteger(orderId) &&
      orderId > 0
    ) {
      await this
        .releaseReservedInventory(
          orderId,
          'EXPIRED',
        )
    }
  }

  private async releaseReservedInventory(
    orderId: number,
    status: string,
  ) {
    await this.dataSource
      .transaction(
        async (manager) => {
          const orderRepo =
            manager.getRepository(
              ShopOrder,
            )

          const order =
            await orderRepo.findOne({
              where: {
                id: orderId,
              },

              lock: {
                mode:
                  'pessimistic_write',
              },
            })

          if (
            !order ||
            !order.inventoryReserved ||
            order.paymentStatus ===
              'PAID'
          ) {
            return
          }

          const itemRepo =
            manager.getRepository(
              ShopOrderItem,
            )

          const items =
            await itemRepo.find({
              where: {
                orderId,
              },
            })

          const productRepo =
            manager.getRepository(
              ShopProduct,
            )

          for (
            const item of items
          ) {
            if (!item.productId) {
              continue
            }

            await productRepo
              .increment(
                {
                  id:
                    item.productId,
                },
                'inventory',
                item.quantity,
              )
          }

          order.inventoryReserved =
            false

          order.paymentStatus =
            status

          await orderRepo.save(
            order,
          )
        },
      )
  }

  private async findProduct(
    id: number,
  ) {
    const product =
      await this.productRepo
        .findOne({
          where: {
            id:
              this.normalizeId(id),
          },
        })

    if (!product) {
      throw new NotFoundException(
        'Shop product not found.',
      )
    }

    return product
  }

  private normalizeId(
    value: unknown,
  ) {
    const id =
      Number(value)

    if (
      !Number.isInteger(id) ||
      id < 1
    ) {
      throw new BadRequestException(
        'Invalid ID.',
      )
    }

    return id
  }

  private normalizeName(
    value: unknown,
  ) {
    const name =
      String(value || '')
        .trim()

    if (
      name.length < 2 ||
      name.length > 140
    ) {
      throw new BadRequestException(
        'Product name must be 2-140 characters.',
      )
    }

    return name
  }

  private normalizeDescription(
    value: unknown,
  ) {
    const description =
      String(value || '')
        .trim()

    if (
      description.length >
      5000
    ) {
      throw new BadRequestException(
        'Product description is too long.',
      )
    }

    return description
  }

  private normalizePriceCents(
    value: unknown,
  ) {
    const cents =
      Number(value)

    if (
      !Number.isInteger(cents) ||
      cents < 50 ||
      cents > 10_000_000
    ) {
      throw new BadRequestException(
        'Product price is invalid.',
      )
    }

    return cents
  }

  private normalizeInventory(
    value: unknown,
  ) {
    const inventory =
      Number(value)

    if (
      !Number.isInteger(
        inventory,
      ) ||
      inventory < 0 ||
      inventory > 1_000_000
    ) {
      throw new BadRequestException(
        'Inventory is invalid.',
      )
    }

    return inventory
  }

  private normalizeCheckoutItems(
    value:
      CheckoutItemInput[] |
      undefined,
  ) {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > 20
    ) {
      throw new BadRequestException(
        'Cart is invalid.',
      )
    }

    const requested =
      new Map<number, number>()

    for (
      const raw of value
    ) {
      const productId =
        Number(raw?.productId)

      const quantity =
        Number(raw?.quantity)

      if (
        !Number.isInteger(
          productId,
        ) ||
        productId < 1 ||
        !Number.isInteger(
          quantity,
        ) ||
        quantity < 1 ||
        quantity > 1000
      ) {
        throw new BadRequestException(
          'Cart contains an invalid item.',
        )
      }

      const nextQuantity =
        (
          requested.get(
            productId,
          ) || 0
        ) + quantity

      if (nextQuantity > 1000) {
        throw new BadRequestException(
          'Maximum quantity per product is 1000.',
        )
      }

      requested.set(
        productId,
        nextQuantity,
      )
    }

    return requested
  }
}
