import { SalesCommissionService } from '../sales/sales-commission.service'
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

import { Resend } from 'resend'

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

import {
  SupportThread,
  SupportThreadStatus,
} from '../support/support-thread.entity'

import {
  createSupportAccessToken,
} from '../support/support-token'

import {
  MarketingService,
} from '../marketing/marketing.service'

import { ShopService } from '../shop/shop.service'
import { RefundService } from '../refund/refund.service'

@Injectable()
export class WebhookService {
  private readonly logger =
    new Logger(WebhookService.name)

  private stripe: Stripe

  private resend: Resend | null = null

  private readonly webhookSecret: string

  private readonly connectWebhookSecret:
    string | null

  constructor(
    private readonly salesCommissionService:
      SalesCommissionService,

    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,

    @InjectRepository(SupportThread)
    private supportThreadRepo: Repository<SupportThread>,

    private gateway: OrderGateway,

    private marketingService:
      MarketingService,

    private shopService:
      ShopService,

    private refundService:
      RefundService,
  ) {
    const key =
      process.env.STRIPE_SECRET_KEY

    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET

    const connectWebhookSecret =
      String(
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET ||
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

    if (
      !isProduction &&
      !key.startsWith('sk_')
    ) {
      throw new Error(
        'Invalid STRIPE_SECRET_KEY.',
      )
    }

    if (
      !webhookSecret ||
      !webhookSecret.startsWith('whsec_')
    ) {
      throw new Error(
        'Missing or invalid STRIPE_WEBHOOK_SECRET.',
      )
    }

    this.webhookSecret =
      webhookSecret

    if (
      connectWebhookSecret &&
      !connectWebhookSecret.startsWith('whsec_')
    ) {
      throw new Error(
        'Invalid STRIPE_CONNECT_WEBHOOK_SECRET.',
      )
    }

    this.connectWebhookSecret =
      connectWebhookSecret || null

    this.stripe = new Stripe(
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

    if (resendKey) {
      this.resend =
        new Resend(resendKey)
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not configured. Paid orders will still reach the kitchen, but CaviarQR receipt emails will not be sent.',
      )
    }

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
  // 💳 STRIPE FEE HELPERS
  // =========================

  private async getStripePaymentFinancials(
    paymentIntentId: string,
    connectedAccountId?: string | null,
  ): Promise<{
    stripeChargeId: string | null
    stripeBalanceTransactionId: string | null
    stripeFee: number | null
    paidAt: Date | null
  }> {
    if (!paymentIntentId) {
      return {
        stripeChargeId: null,
        stripeBalanceTransactionId: null,
        stripeFee: null,
        paidAt: null,
      }
    }

    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(
          paymentIntentId,
          {
            expand: [
              'latest_charge.balance_transaction',
            ],
          },
          connectedAccountId
            ? {
                stripeAccount:
                  connectedAccountId,
              }
            : undefined,
        )

      let charge: Stripe.Charge | null =
        null

      if (
        typeof paymentIntent.latest_charge ===
        'string'
      ) {
        charge =
          await this.stripe.charges.retrieve(
            paymentIntent.latest_charge,
            {
              expand: [
                'balance_transaction',
              ],
            },
            connectedAccountId
              ? {
                  stripeAccount:
                    connectedAccountId,
                }
              : undefined,
          )
      } else if (
        paymentIntent.latest_charge &&
        typeof paymentIntent.latest_charge ===
          'object'
      ) {
        charge =
          paymentIntent.latest_charge as Stripe.Charge
      }

      if (!charge) {
        this.logger.warn(
          `STRIPE_CHARGE_NOT_AVAILABLE: ${paymentIntentId}`,
        )

        return {
          stripeChargeId: null,
          stripeBalanceTransactionId: null,
          stripeFee: null,
          paidAt: null,
        }
      }

      /*
       * Stripe Charge.created is the authoritative
       * successful-payment timestamp used for the
       * Sales Partner 30-day availability clock.
       */
      const chargeCreatedSeconds =
        Number(
          charge.created,
        )

      const paidAt =
        Number.isInteger(
          chargeCreatedSeconds,
        ) &&
        chargeCreatedSeconds > 0
          ? new Date(
              chargeCreatedSeconds *
                1000,
            )
          : null

      if (!paidAt) {
        this.logger.warn(
          `STRIPE_CHARGE_CREATED_INVALID: ${charge.id}`,
        )
      }

      let balanceTransaction:
        | Stripe.BalanceTransaction
        | null = null

      if (
        typeof charge.balance_transaction ===
        'string'
      ) {
        balanceTransaction =
          await this.stripe.balanceTransactions.retrieve(
            charge.balance_transaction,
            connectedAccountId
              ? {
                  stripeAccount:
                    connectedAccountId,
                }
              : undefined,
          )
      } else if (
        charge.balance_transaction &&
        typeof charge.balance_transaction ===
          'object'
      ) {
        balanceTransaction =
          charge.balance_transaction as Stripe.BalanceTransaction
      }

      if (!balanceTransaction) {
        this.logger.warn(
          `STRIPE_BALANCE_TRANSACTION_NOT_AVAILABLE: ${charge.id}`,
        )

        return {
          stripeChargeId:
            charge.id,
          stripeBalanceTransactionId:
            null,
          stripeFee:
            null,
          paidAt,
        }
      }

      const feeCents =
        Number(
          balanceTransaction.fee,
        )

      if (
        !Number.isInteger(
          feeCents,
        ) ||
        feeCents < 0
      ) {
        this.logger.warn(
          `INVALID_STRIPE_FEE: ${balanceTransaction.id}`,
        )

        return {
          stripeChargeId:
            charge.id,
          stripeBalanceTransactionId:
            balanceTransaction.id,
          stripeFee:
            null,
          paidAt,
        }
      }

      return {
        stripeChargeId:
          charge.id,
        stripeBalanceTransactionId:
          balanceTransaction.id,
        stripeFee:
          Number(
            (
              feeCents / 100
            ).toFixed(2),
          ),
        paidAt,
      }
    } catch (err: any) {
      this.logger.error(
        `STRIPE_FEE_LOOKUP_FAILED: ${paymentIntentId}`,
        err?.message || err,
      )

      /*
       * Never block a paid order from reaching
       * the kitchen because Stripe reporting
       * enrichment failed.
       */
      return {
        stripeChargeId: null,
        stripeBalanceTransactionId: null,
        stripeFee: null,
        paidAt: null,
      }
    }
  }

  // =========================
  // 🧾 RECEIPT + SUPPORT
  // =========================

  private escapeHtml(
    value: unknown,
  ) {
    return String(
      value ?? '',
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private formatReceiptMoney(
    amount: number,
    currency: string,
  ) {
    const normalized =
      String(
        currency || 'usd',
      ).toLowerCase() === 'inr'
        ? 'INR'
        : 'USD'

    return new Intl.NumberFormat(
      normalized === 'INR'
        ? 'en-IN'
        : 'en-US',
      {
        style: 'currency',
        currency: normalized,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    ).format(
      Number.isFinite(
        Number(amount),
      )
        ? Number(amount)
        : 0,
    )
  }

  private getFrontendUrl() {
    return String(
      process.env.FRONTEND_URL ||
        process.env.WEB_URL ||
        'http://localhost:3000',
    ).replace(
      /\/+$/,
      '',
    )
  }

  private async ensureSupportThread(
    order: Order,
  ): Promise<SupportThread | null> {
    try {
      let thread =
        await this.supportThreadRepo
          .findOne({
            where: {
              orderId:
                order.id,
            },
          })

      if (!thread) {
        const created =
          this.supportThreadRepo
            .create({
              orderId:
                order.id,

              businessId:
                order.businessId,

              storeCode:
                order.storeCode,

              customerEmail:
                order.customerEmail,

              customerName:
                order.customerName,

              status:
                SupportThreadStatus
                  .AVAILABLE,

              restaurantUnreadCount:
                0,

              customerUnreadCount:
                0,

              lastMessageAt:
                null,

              resolvedAt:
                null,
            })

        try {
          thread =
            await this
              .supportThreadRepo
              .save(created)
        } catch (error: any) {
          /*
           * Duplicate webhook deliveries can race here.
           * The unique orderId index makes creation safe;
           * if another request created it first, just load it.
           */
          thread =
            await this
              .supportThreadRepo
              .findOne({
                where: {
                  orderId:
                    order.id,
                },
              })

          if (!thread) {
            throw error
          }
        }
      }

      if (
        order.supportThreadId !==
        thread.id
      ) {
        order.supportThreadId =
          thread.id

        await this.orderRepo.save(
          order,
        )
      }

      return thread
    } catch (error: any) {
      this.logger.error(
        `SUPPORT_THREAD_CREATE_FAILED: Order ${order.id}`,
        error?.message ||
          error,
      )

      return null
    }
  }

  private async claimReceiptEmailAttempt(
    orderId: number,
  ) {
    const now =
      new Date()

    const retryCutoff =
      new Date(
        Date.now() -
          2 * 60 * 1000,
      )

    const result =
      await this.orderRepo
        .createQueryBuilder()
        .update(Order)
        .set({
          receiptEmailLastAttemptAt:
            now,

          receiptEmailAttempts:
            () =>
              '"receiptEmailAttempts" + 1',
        })
        .where(
          'id = :orderId',
          {
            orderId,
          },
        )
        .andWhere(
          '"receiptEmailSentAt" IS NULL',
        )
        .andWhere(
          `(
            "receiptEmailLastAttemptAt" IS NULL
            OR "receiptEmailLastAttemptAt" < :retryCutoff
          )`,
          {
            retryCutoff,
          },
        )
        .execute()

    return Number(
      result.affected || 0,
    ) === 1
  }

  private async sendReceiptEmail(
    order: Order,
    business: Business,
    supportThread: SupportThread,
  ) {
    if (
      order.receiptEmailSentAt
    ) {
      return
    }

    const email =
      String(
        order.customerEmail ||
          '',
      )
        .trim()
        .toLowerCase()

    if (!email) {
      this.logger.warn(
        `RECEIPT_EMAIL_SKIPPED_NO_EMAIL: Order ${order.id}`,
      )

      return
    }

    if (!this.resend) {
      await this.orderRepo.update(
        order.id,
        {
          receiptEmailFailureMessage:
            'RESEND_API_KEY is not configured.',
        },
      )

      return
    }

    const claimed =
      await this
        .claimReceiptEmailAttempt(
          order.id,
        )

    if (!claimed) {
      return
    }

    try {
      const token =
        createSupportAccessToken(
          supportThread.id,
        )

      const helpUrl =
        `${this.getFrontendUrl()}/help/${encodeURIComponent(
          token,
        )}`

      const cafeName =
        String(
          (business as any)
            ?.cafeName ||
            (business as any)
              ?.name ||
            order.storeCode ||
            'Restaurant',
        ).trim()

      const currency =
        String(
          order.currency ||
            'usd',
        ).toLowerCase()

      const safeItems =
        Array.isArray(order.items)
          ? order.items
          : []

      const itemSubtotal =
        safeItems.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            Number(
              item.price || 0,
            ) *
              Number(
                item.qty || 1,
              ),
          0,
        )

      const customerFee =
        Math.max(
          0,
          Number(
            (
              Number(
                order.total ||
                  0,
              ) -
              itemSubtotal
            ).toFixed(2),
          ),
        )

      const itemText =
        safeItems
          .map(
            (item) =>
              `${item.name} × ${Number(
                item.qty || 1,
              )} — ${this.formatReceiptMoney(
                Number(
                  item.price || 0,
                ) *
                  Number(
                    item.qty || 1,
                  ),
                currency,
              )}`,
          )
          .join('\n')

      const itemHtml =
        safeItems
          .map((item) => {
            const quantity =
              Number(
                item.qty || 1,
              )

            const lineTotal =
              Number(
                item.price || 0,
              ) *
              quantity

            const note =
              String(
                item.note || '',
              ).trim()

            return `
              <tr>
                <td style="padding: 10px 0; vertical-align: top;">
                  <div style="font-weight: 700; color: #191919;">
                    ${this.escapeHtml(
                      item.name,
                    )}
                  </div>
                  <div style="margin-top: 3px; font-size: 12px; color: #767676;">
                    Qty ${quantity}
                  </div>
                  ${
                    note
                      ? `
                        <div style="margin-top: 4px; font-size: 12px; color: #767676;">
                          Note: ${this.escapeHtml(
                            note,
                          )}
                        </div>
                      `
                      : ''
                  }
                </td>
                <td style="padding: 10px 0; text-align: right; vertical-align: top; font-weight: 700; color: #191919;">
                  ${this.escapeHtml(
                    this.formatReceiptMoney(
                      lineTotal,
                      currency,
                    ),
                  )}
                </td>
              </tr>
            `
          })
          .join('')

      const from =
        process.env
          .RECEIPT_EMAIL_FROM ||
        process.env
          .MAINTENANCE_EMAIL_FROM ||
        'CaviarQR <onboarding@resend.dev>'

      const subject =
        `${cafeName} receipt · Order #${order.id}`

      const text =
        `${cafeName}
CaviarQR receipt

Order #${order.id}
Table ${order.tableNumber ?? '-'}

${itemText}

Subtotal: ${this.formatReceiptMoney(
          itemSubtotal,
          currency,
        )}${
          customerFee > 0
            ? `\nService fee: ${this.formatReceiptMoney(
                customerFee,
                currency,
              )}`
            : ''
        }
Total: ${this.formatReceiptMoney(
          Number(
            order.total || 0,
          ),
          currency,
        )}

Payment successful.

Need help with this order?
${helpUrl}

Powered by CaviarQR`

      const html =
        `
          <div style="margin: 0; padding: 24px; background: #f6f6f6; font-family: Arial, Helvetica, sans-serif; color: #191919;">
            <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #ebebeb; border-radius: 18px; overflow: hidden;">
              <div style="padding: 24px 24px 18px; border-bottom: 1px solid #ebebeb;">
                <div style="font-size: 12px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: #ff3008;">
                  CaviarQR
                </div>

                <h1 style="margin: 8px 0 4px; font-size: 25px; line-height: 1.15;">
                  ${this.escapeHtml(
                    cafeName,
                  )}
                </h1>

                <div style="font-size: 13px; color: #767676;">
                  Payment successful · Order #${order.id}
                  ${
                    order.tableNumber !==
                    null
                      ? ` · Table ${order.tableNumber}`
                      : ''
                  }
                </div>
              </div>

              <div style="padding: 14px 24px 4px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${itemHtml}
                </table>
              </div>

              <div style="padding: 14px 24px 24px; border-top: 1px solid #ebebeb;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #767676;">
                      Subtotal
                    </td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700;">
                      ${this.escapeHtml(
                        this.formatReceiptMoney(
                          itemSubtotal,
                          currency,
                        ),
                      )}
                    </td>
                  </tr>

                  ${
                    customerFee > 0
                      ? `
                        <tr>
                          <td style="padding: 6px 0; color: #767676;">
                            Service fee
                          </td>
                          <td style="padding: 6px 0; text-align: right; font-weight: 700;">
                            ${this.escapeHtml(
                              this.formatReceiptMoney(
                                customerFee,
                                currency,
                              ),
                            )}
                          </td>
                        </tr>
                      `
                      : ''
                  }

                  <tr>
                    <td style="padding: 12px 0 0; font-size: 18px; font-weight: 800;">
                      Total
                    </td>
                    <td style="padding: 12px 0 0; text-align: right; font-size: 18px; font-weight: 800;">
                      ${this.escapeHtml(
                        this.formatReceiptMoney(
                          Number(
                            order.total ||
                              0,
                          ),
                          currency,
                        ),
                      )}
                    </td>
                  </tr>
                </table>
              </div>

              <div style="padding: 22px 24px 26px; background: #fff7f5; border-top: 1px solid #ffe0d8; text-align: center;">
                <div style="font-size: 16px; font-weight: 800;">
                  Need help with this order?
                </div>

                <div style="margin-top: 6px; font-size: 13px; line-height: 1.5; color: #767676;">
                  Message the restaurant through CaviarQR about a missing item, incorrect order, refund request, or another problem.
                </div>

                <a
                  href="${this.escapeHtml(
                    helpUrl,
                  )}"
                  style="display: inline-block; margin-top: 16px; padding: 12px 20px; border-radius: 10px; background: #ff3008; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800;"
                >
                  Get Help With This Order
                </a>
              </div>

              <div style="padding: 16px 24px; text-align: center; font-size: 11px; color: #999999;">
                Powered by CaviarQR
              </div>
            </div>
          </div>
        `

      const result =
        await this.resend
          .emails.send({
            from,
            to: email,
            subject,
            text,
            html,
          })

      if (
        result.error
      ) {
        throw new Error(
          result.error.message ||
            'Resend receipt email failed.',
        )
      }

      const sentAt =
        new Date()

      await this.orderRepo.update(
        order.id,
        {
          receiptEmailSentAt:
            sentAt,

          receiptEmailFailureMessage:
            null,
        },
      )

      order.receiptEmailSentAt =
        sentAt

      order.receiptEmailFailureMessage =
        null

      this.logger.log(
        `RECEIPT_EMAIL_SENT: Order ${order.id} -> ${email}`,
      )
    } catch (error: any) {
      const message =
        String(
          error?.message ||
            error ||
            'Unknown receipt email error',
        ).slice(
          0,
          2_000,
        )

      await this.orderRepo.update(
        order.id,
        {
          receiptEmailFailureMessage:
            message,
        },
      )

      this.logger.error(
        `RECEIPT_EMAIL_FAILED: Order ${order.id}`,
        message,
      )
    }
  }

  private async prepareSupportAndReceipt(
    order: Order,
    business: Business,
  ) {
    const supportThread =
      await this
        .ensureSupportThread(
          order,
        )

    if (!supportThread) {
      return
    }

    await this.sendReceiptEmail(
      order,
      business,
      supportThread,
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

  // =========================
  // 📧 EXPLICIT MARKETING OPT-IN
  // =========================

  private async subscribeMarketingIfOptedIn(
    order: Order,
    pendingOrder: PendingOrder,
    business: Business,
  ) {
    /*
     * Receipt delivery NEVER implies promotional
     * email consent. We require both the explicit
     * opt-in and its recorded timestamp.
     */
    if (
      pendingOrder.marketingOptIn !==
        true ||
      !pendingOrder.marketingConsentAt
    ) {
      return
    }

    const email =
      String(
        order.customerEmail || '',
      )
        .trim()
        .toLowerCase()

    if (!email) {
      this.logger.warn(
        `MARKETING_OPT_IN_SKIPPED_NO_EMAIL: Order ${order.id}`,
      )

      return
    }

    try {
      const result =
        await this.marketingService
          .subscribe(
            business.id,
            email,
            order.id,
            'CHECKOUT',
            pendingOrder
              .marketingConsentAt,
          )

      if (
        'subscribed' in result &&
        result.subscribed === false
      ) {
        this.logger.log(
          `MARKETING_OPT_IN_NOT_APPLIED: Order ${order.id}`,
        )

        return
      }

      this.logger.log(
        `MARKETING_OPT_IN_SAVED: Order ${order.id}`,
      )
    } catch (error: any) {
      /*
       * Marketing is non-transactional.
       * Failure here must never block:
       * - paid order creation
       * - kitchen delivery
       * - receipt
       * - customer support
       */
      this.logger.error(
        `MARKETING_OPT_IN_FAILED: Order ${order.id}`,
        error?.message || error,
      )
    }
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

      pendingOrder.completedAt =
        new Date()

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
    } catch (primaryErr: any) {
      if (!this.connectWebhookSecret) {
        this.logger.error(
          'WEBHOOK_SIGNATURE_VERIFY_FAILED',
          primaryErr?.message ||
            primaryErr,
        )

        throw new BadRequestException(
          'Webhook signature verification failed',
        )
      }

      try {
        event =
          this.stripe.webhooks.constructEvent(
            rawBody,
            sig,
            this.connectWebhookSecret,
          )
      } catch (connectErr: any) {
        this.logger.error(
          'WEBHOOK_SIGNATURE_VERIFY_FAILED',
          connectErr?.message ||
            connectErr,
        )

        throw new BadRequestException(
          'Webhook signature verification failed',
        )
      }
    }

    console.log(
      '🔥 WEBHOOK:',
      event.type,
      event.account
        ? 'CONNECTED'
        : 'ACCOUNT',
    )

    // =========================
    // 🔥 CHECKOUT COMPLETE
    // =========================

    if (
      event.type ===
        'checkout.session.completed' ||
      event.type ===
        'checkout.session.async_payment_succeeded'
    ) {
      const session =
        event.data
          .object as Stripe.Checkout.Session

      if (
        session.metadata
          ?.checkoutType ===
        'hardware_store'
      ) {
        await this.shopService
          .handleCheckoutCompleted(
            session,
          )
      } else {
        await this.handleCheckoutCompleted(
          session,
          event.account || null,
        )
      }
    }

    if (
      event.type ===
      'checkout.session.async_payment_failed'
    ) {
      const session =
        event.data
          .object as Stripe.Checkout.Session

      if (
        session.metadata
          ?.checkoutType ===
        'hardware_store'
      ) {
        await this.shopService
          .handleCheckoutFailed(
            session,
          )
      } else {
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

        await this.markPendingFailed(
          pendingOrderId,
          session.id || '',
          paymentIntentId,
          'STRIPE_ASYNC_PAYMENT_FAILED',
        )
      }
    }

    if (
      event.type ===
      'checkout.session.expired'
    ) {
      const session =
        event.data
          .object as Stripe.Checkout.Session

      if (
        session.metadata
          ?.checkoutType ===
        'hardware_store'
      ) {
        await this.shopService
          .handleCheckoutExpired(
            session,
          )
      }
    }

    // =========================
    // 💸 REFUND RECOVERY
    // =========================
    //
    // Refund API calls already persist the Stripe result directly.
    // These webhook events are the recovery path when Stripe accepted
    // a refund but the API request timed out, the process restarted,
    // or the response was otherwise lost.
    //
    // syncStripeRefund() matches the refund to the existing audited
    // RefundAttempt using stripeRefundId or refundAttemptId metadata.
    //
    if (
      event.type === 'refund.created' ||
      event.type === 'refund.updated' ||
      event.type === 'refund.failed'
    ) {
      const refund =
        event.data.object as Stripe.Refund

      await this.refundService
        .syncStripeRefund(
          refund,
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
    connectedAccountId?: string | null,
  ) {
    const stripeSessionId =
      session.id || ''

    const metadataPendingOrderId =
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

      if (!paymentIntentId) {
        throw new Error(
          'PAYMENT_INTENT_ID_MISSING',
        )
      }

      console.log(
        '🔥 SESSION:',
        stripeSessionId,
      )

      console.log(
        '🔥 METADATA:',
        session.metadata,
      )

      // =========================
      // 🔥 PAYMENT STATUS
      // =========================

      if (
        session.payment_status !==
        'paid'
      ) {
        this.logger.warn(
          `CHECKOUT_NOT_PAID: Session ${stripeSessionId} has payment status ${session.payment_status}.`,
        )

        return
      }

      // =========================
      // 🔥 PENDING ORDER
      // Trusted source of items, totals,
      // table number, fees and currency.
      // =========================

      const pendingOrder =
        await this.findPendingOrder(
          metadataPendingOrderId,
          stripeSessionId,
        )

      if (!pendingOrder) {
        this.logger.error(
          `PENDING_ORDER_NOT_FOUND: ${
            metadataPendingOrderId ||
            stripeSessionId
          }`,
        )

        return
      }

      const pendingOrderId =
        pendingOrder.id

      const metadataBusinessId =
        Number(
          session.metadata
            ?.businessId || 0,
        )

      if (
        metadataBusinessId &&
        metadataBusinessId !==
          pendingOrder.businessId
      ) {
        throw new Error(
          `METADATA_BUSINESS_MISMATCH: PendingOrder belongs to ${pendingOrder.businessId}, Stripe metadata uses ${metadataBusinessId}.`,
        )
      }

      const clientReferenceId =
        String(
          session.client_reference_id ||
          '',
        ).trim()

      if (
        clientReferenceId &&
        clientReferenceId !==
          String(pendingOrderId)
      ) {
        throw new Error(
          `CLIENT_REFERENCE_MISMATCH: PendingOrder is ${pendingOrderId}, Stripe client_reference_id is ${clientReferenceId}.`,
        )
      }

      const storeCode =
        String(
          pendingOrder.storeCode ||
          '',
        ).trim()

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

      const metadataStoreCode =
        String(
          session.metadata
            ?.storeCode || '',
        ).trim()

      if (
        metadataStoreCode &&
        metadataStoreCode !==
          storeCode
      ) {
        throw new Error(
          `STORE_CODE_MISMATCH: PendingOrder uses ${storeCode}, Stripe metadata uses ${metadataStoreCode}.`,
        )
      }

      // =========================
      // 🔥 CURRENCY
      // =========================

      const currency =
        String(
          pendingOrder.currency ||
          '',
        ).toLowerCase()

      const sessionCurrency =
        String(
          session.currency ||
          '',
        ).toLowerCase()

      const metadataCurrency =
        String(
          session.metadata
            ?.currency || '',
        ).toLowerCase()

      if (
        currency !== 'usd'
      ) {
        throw new Error(
          `INVALID_PENDING_ORDER_CURRENCY: ${currency || 'MISSING'}. CaviarQR US launch accepts USD only.`,
        )
      }

      if (
        !sessionCurrency ||
        sessionCurrency !== currency
      ) {
        throw new Error(
          `CHECKOUT_CURRENCY_MISMATCH: Expected ${currency}, received ${sessionCurrency || 'MISSING'}.`,
        )
      }

      if (
        metadataCurrency &&
        metadataCurrency !== currency
      ) {
        throw new Error(
          `METADATA_CURRENCY_MISMATCH: Expected ${currency}, received ${metadataCurrency}.`,
        )
      }

      // =========================
      // 🔥 BUSINESS
      // =========================

      // Resolve a paid checkout by its immutable restaurant ID,
      // never by the reusable public store code. Late Stripe
      // webhooks must remain attached to the original restaurant
      // after that code is reclaimed by a different restaurant.
      const business =
        await this.businessRepo.findOne({
          where: {
            id: pendingOrder.businessId,
          },
        })

      if (!business) {
        this.logger.error(
          `BUSINESS_ID_NOT_FOUND: ${pendingOrder.businessId}`,
        )

        await this.markPendingFailed(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
          `BUSINESS_ID_NOT_FOUND: ${pendingOrder.businessId}`,
        )

        return
      }

      // Active businesses must retain the store code used when
      // the checkout started. Closed businesses may have a
      // tombstoned storeCode, but are still the same business ID.
      if (
        !business.deletedAt &&
        business.storeCode !== storeCode
      ) {
        throw new Error(
          `STORE_CODE_BUSINESS_MISMATCH: PendingOrder ${pendingOrderId} does not belong to active business ${business.id}.`,
        )
      }

      if (connectedAccountId) {
        const expectedStripeAccountId =
          String(
            business.stripeAccountId ||
              '',
          ).trim()

        if (
          !expectedStripeAccountId ||
          connectedAccountId !==
            expectedStripeAccountId
        ) {
          throw new Error(
            'CONNECTED_ACCOUNT_MISMATCH',
          )
        }
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

          /*
           * A duplicate webhook must not create another
           * Order, but it can safely retry setup for a
           * receipt that was not successfully delivered.
           */
          void this
            .prepareSupportAndReceipt(
              existingOrder,
              business,
            )

          await this
            .salesCommissionService
            .recordPaidOrderSafely(
              existingOrder.id,
              'WEBHOOK_EXISTING_ORDER',
            )

          return
        }
      }

      // =========================
      // 🔥 AMOUNT VERIFICATION
      // =========================

      const stripeTotalCents =
        Number(
          session.amount_total,
        )

      const pendingTotalCents =
        Math.round(
          Number(
            pendingOrder.total ||
            0,
          ) * 100,
        )

      if (
        !Number.isInteger(
          stripeTotalCents,
        ) ||
        stripeTotalCents < 1
      ) {
        throw new Error(
          'INVALID_STRIPE_TOTAL',
        )
      }

      if (
        !Number.isInteger(
          pendingTotalCents,
        ) ||
        pendingTotalCents < 1
      ) {
        throw new Error(
          'INVALID_PENDING_ORDER_TOTAL',
        )
      }

      if (
        stripeTotalCents !==
        pendingTotalCents
      ) {
        throw new Error(
          `CHECKOUT_TOTAL_MISMATCH: Expected ${pendingTotalCents}, received ${stripeTotalCents}.`,
        )
      }

      const items =
        Array.isArray(
          pendingOrder.items,
        )
          ? pendingOrder.items
          : []

      if (items.length === 0) {
        throw new Error(
          'INVALID_ORDER_DATA: PendingOrder has no items.',
        )
      }

      const total =
        pendingTotalCents / 100

      const platformFee =
        Number(
          Number(
            pendingOrder.platformFee ||
            0,
          ).toFixed(2),
        )

      const stripeFinancials =
        await this.getStripePaymentFinancials(
          paymentIntentId,
          connectedAccountId,
        )

      const tableNumber =
        Number(
          pendingOrder.tableNumber ||
          0,
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
      // 🔥 CREATE ORDER
      // =========================

      const order =
        new Order()

      order.businessId =
        business.id

      order.storeCode =
        business.storeCode

      order.items =
        items

      order.total =
        total

      order.currency =
        currency

      order.tableNumber =
        Number.isInteger(
          tableNumber,
        )
          ? tableNumber
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

      order.supportThreadId =
        null

      order.receiptEmailSentAt =
        null

      order.receiptEmailLastAttemptAt =
        null

      order.receiptEmailAttempts =
        0

      order.receiptEmailFailureMessage =
        null

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

      order.stripeChargeId =
        stripeFinancials.stripeChargeId

      order.stripeBalanceTransactionId =
        stripeFinancials.stripeBalanceTransactionId

      order.stripeFee =
        stripeFinancials.stripeFee

      order.paidAt =
        stripeFinancials.paidAt

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

          currency:
            order.currency,

          platformFee:
            order.platformFee,

          tableNumber:
            order.tableNumber,

          stripePaymentIntentId:
            order.stripePaymentIntentId,

          stripeChargeId:
            order.stripeChargeId,

          stripeBalanceTransactionId:
            order.stripeBalanceTransactionId,

          stripeFee:
            order.stripeFee,
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

        void this
          .subscribeMarketingIfOptedIn(
            saved,
            pendingOrder,
            business,
          )

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

        const concurrentOrder =
          await this.orderRepo.findOne({
            where: {
              stripePaymentIntentId:
                paymentIntentId,
            },
          })

        if (concurrentOrder) {
          this.logger.warn(
            `CONCURRENT_DUPLICATE_WEBHOOK_IGNORED: PaymentIntent ${paymentIntentId} already created Order ${concurrentOrder.id}`,
          )

          await this.markPendingCompleted(
            pendingOrderId,
            stripeSessionId,
            paymentIntentId,
          )

          void this
            .prepareSupportAndReceipt(
              concurrentOrder,
              business,
            )

          await this
            .salesCommissionService
            .recordPaidOrderSafely(
              concurrentOrder.id,
              'WEBHOOK_CONCURRENT_DUPLICATE',
            )

          return
        }

        await this.markPendingFailed(
          pendingOrderId,
          stripeSessionId,
          paymentIntentId,
          `DATABASE_SAVE_FAILED: ${
            err?.message ||
            'Unknown database error'
          }`,
        )

        throw err
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

        // Kitchen ACK timeout is handled by the durable
        // database watchdog in MaintenanceService.
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

      /*
       * Receipt delivery is deliberately outside the
       * order-save and kitchen-delivery critical path.
       * Email/support failures must never make a paid
       * kitchen order look failed to Stripe.
       */
      void this
        .prepareSupportAndReceipt(
          saved,
          business,
        )

      await this
        .salesCommissionService
        .recordPaidOrderSafely(
          saved.id,
          'WEBHOOK_NEW_ORDER',
        )
    } catch (err: any) {
      this.logger.error(
        'WEBHOOK_PROCESSING_FAILED',
        err,
      )

      await this.markPendingFailed(
        metadataPendingOrderId,
        stripeSessionId,
        paymentIntentId,
        `WEBHOOK_PROCESSING_FAILED: ${
          err?.message ||
          'Unknown webhook error'
        }`,
      )

      /*
       * A paid order that failed during critical processing
       * must not return a successful webhook response.
       * Re-throw so Stripe retries the event.
       */
      throw err
    }
  }
}