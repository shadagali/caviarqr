import { SalesCommissionService } from '../sales/sales-commission.service'
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

import { Resend } from 'resend'

import {
  Order,
  OrderStatus,
  OwnerIssueSeverity,
  OwnerIssueType,
} from '../order/order.entity'
import { OrderGateway } from '../order/order.gateway'

import { Business } from '../business/business.entity'

import {
  PendingOrder,
  PendingOrderStatus,
} from '../pending-order/pending-order.entity'

import { StripeService } from '../stripe/stripe.service'

import {
  MaintenanceAuditAction,
  MaintenanceAuditLog,
} from './maintenance-audit-log.entity'

@Injectable()
export class MaintenanceService {
  private readonly logger =
    new Logger(
      MaintenanceService.name,
    )

  private stripe: Stripe

  private resend: Resend | null = null

  private reconciliationRunning = false

  private salesCommissionSweepRunning =
    false

  private kitchenAckWatchdogRunning =
    false

  constructor(
    private readonly salesCommissionService:
      SalesCommissionService,

    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,

    @InjectRepository(MaintenanceAuditLog)
    private auditRepo: Repository<MaintenanceAuditLog>,

    private stripeService: StripeService,

    private orderGateway: OrderGateway,
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

    const resendKey =
      process.env.RESEND_API_KEY

    if (resendKey) {
      this.resend = new Resend(
        resendKey,
      )
    }
  }

  private isPostgresUniqueViolation(
    error: unknown,
  ) {
    const candidate =
      error as {
        code?: string
        driverError?: {
          code?: string
        }
      }

    return (
      candidate?.code === '23505' ||
      candidate?.driverError?.code ===
        '23505'
    )
  }

  private isStripeResourceMissing(
    error: unknown,
  ) {
    const candidate =
      error as {
        code?: string
        raw?: {
          code?: string
        }
      }

    return (
      candidate?.code ===
        'resource_missing' ||
      candidate?.raw?.code ===
        'resource_missing'
    )
  }

  /*
   * Return the authoritative Stripe successful
   * payment time for a restaurant PaymentIntent.
   *
   * New restaurant payments may live on the
   * connected cafe account. Legacy payments may
   * live on the CaviarQR platform account.
   */
  private async getRestaurantPaymentPaidAt(
    paymentIntentId: string,
    connectedAccountId?: string | null,
  ): Promise<Date | null> {
    if (!paymentIntentId) {
      return null
    }

    const retrieve = async (
      stripeAccount?: string | null,
    ): Promise<Date | null> => {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(
          paymentIntentId,
          {
            expand: [
              'latest_charge',
            ],
          },
          stripeAccount
            ? {
                stripeAccount,
              }
            : undefined,
        )

      let charge:
        | Stripe.Charge
        | null = null

      if (
        typeof paymentIntent.latest_charge ===
        'string'
      ) {
        charge =
          await this.stripe.charges.retrieve(
            paymentIntent.latest_charge,
            {},
            stripeAccount
              ? {
                  stripeAccount,
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
        return null
      }

      const createdSeconds =
        Number(
          charge.created,
        )

      if (
        !Number.isInteger(
          createdSeconds,
        ) ||
        createdSeconds <= 0
      ) {
        return null
      }

      return new Date(
        createdSeconds * 1000,
      )
    }

    if (connectedAccountId) {
      try {
        return await retrieve(
          connectedAccountId,
        )
      } catch (error: unknown) {
        if (
          !this.isStripeResourceMissing(
            error,
          )
        ) {
          throw error
        }

        /*
         * Legacy destination-charge payment:
         * fall back to the platform account.
         */
        return retrieve()
      }
    }

    return retrieve()
  }

  /*
   * Durable Sales payment-time repair.
   *
   * Paid restaurant orders must not depend on one
   * webhook/process lifetime for Order.paidAt.
   *
   * We recover Stripe Charge.created and persist it
   * conditionally. After repair, recordPaidOrderSafely()
   * either creates the durable commission ledger row
   * or fills an ACTIVE PENDING commission's exact
   * 30-day availableAt timestamp.
   */
  private async repairMissingSalesPaidAt(
    limit = 25,
  ): Promise<{
    checked: number
    repaired: number
  }> {
    const safeLimit =
      Number.isInteger(limit) &&
      limit > 0 &&
      limit <= 100
        ? limit
        : 25

    const candidates =
      await this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .innerJoin(
          Business,
          'business',
          'business.id = order.businessId',
        )
        .select(
          'order.id',
          'orderId',
        )
        .addSelect(
          'order.stripePaymentIntentId',
          'paymentIntentId',
        )
        .addSelect(
          'business.stripeAccountId',
          'stripeAccountId',
        )
        .where(
          'order.paidAt IS NULL',
        )
        .andWhere(
          'business.salesPartnerId IS NOT NULL',
        )
        .andWhere(
          'business.salesAttributedAt IS NOT NULL',
        )
        .andWhere(
          'order.createdAt >= business.salesAttributedAt',
        )
        .andWhere(
          'order.status != :pendingPayment',
          {
            pendingPayment:
              OrderStatus.PENDING_PAYMENT,
          },
        )
        .andWhere(
          'order.stripePaymentIntentId IS NOT NULL',
        )
        .andWhere(
          'LOWER(order.currency) = :currency',
          {
            currency:
              'usd',
          },
        )
        .andWhere(
          'order.refundApplicationFee = false',
        )
        .orderBy(
          'order.id',
          'ASC',
        )
        .take(
          safeLimit,
        )
        .getRawMany<{
          orderId:
            string | number
          paymentIntentId:
            string | null
          stripeAccountId:
            string | null
        }>()

    let repaired =
      0

    for (const candidate of candidates) {
      const orderId =
        Number(
          candidate.orderId,
        )

      const paymentIntentId =
        String(
          candidate.paymentIntentId ||
            '',
        ).trim()

      const connectedAccountId =
        String(
          candidate.stripeAccountId ||
            '',
        ).trim() ||
        null

      if (
        !Number.isInteger(
          orderId,
        ) ||
        orderId < 1 ||
        !paymentIntentId
      ) {
        continue
      }

      try {
        const paidAt =
          await this
            .getRestaurantPaymentPaidAt(
              paymentIntentId,
              connectedAccountId,
            )

        if (!paidAt) {
          continue
        }

        const update =
          await this.orderRepo
            .createQueryBuilder()
            .update(Order)
            .set({
              paidAt,
            })
            .where(
              'id = :orderId',
              {
                orderId,
              },
            )
            .andWhere(
              '"paidAt" IS NULL',
            )
            .execute()

        if (
          Number(
            update.affected || 0,
          ) > 0
        ) {
          repaired +=
            1

          this.logger.log(
            `SALES_PAID_AT_REPAIRED order=${orderId} paidAt=${paidAt.toISOString()}`,
          )
        }

        /*
         * Safe whether the commission row already
         * exists or not:
         *
         * - existing ACTIVE/PENDING + NULL availableAt
         *   gets its 30-day timestamp;
         * - missing ACTIVE commission is created;
         * - missing non-ACTIVE commission becomes
         *   permanently INELIGIBLE;
         * - existing terminal rows are untouched.
         */
        await this
          .salesCommissionService
          .recordPaidOrderSafely(
            orderId,
            'PAID_AT_REPAIR',
          )
      } catch (error: any) {
        this.logger.error(
          `SALES_PAID_AT_REPAIR_FAILED order=${orderId} error=${String(
            error?.message ||
              error,
          )}`,
        )
      }
    }

    return {
      checked:
        candidates.length,

      repaired,
    }
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
    order.issueType = issue

    order.ownerIssueType = issue
    order.ownerIssueSeverity = severity
    order.ownerActionMessage = message

    order.ownerActionCreatedAt =
      new Date()

    order.ownerActionResolvedAt =
      null

    order.ownerActionResolvedBy =
      null

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
        customer:
          order.customerName,
        email:
          order.customerEmail,
        paymentIntent:
          order.stripePaymentIntentId,
        message,
        createdAt:
          order.ownerActionCreatedAt,
      }),
    )

    return this.orderRepo.save(
      order,
    )
  }

  private escapeEmailHtml(
    value: string,
  ) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // =========================
  // 🧾 AUDIT LOG HELPER
  // =========================

  private async createAuditLog(data: {
    action: MaintenanceAuditAction
    order?: Order | null
    performedBy?: string | null
    reason?: string | null
    metadata?: Record<string, unknown> | null
  }) {
    const order =
      data.order || null

    const audit =
      this.auditRepo.create({
        action: data.action,

        orderId:
          order?.id || null,

        businessId:
          order?.businessId || null,

        storeCode:
          order?.storeCode || null,

        performedBy:
          data.performedBy || null,

        reason:
          data.reason || null,

        metadata:
          data.metadata || null,
      })

    return this.auditRepo.save(
      audit,
    )
  }

  // =========================
  // 🍳 DURABLE KITCHEN ACK WATCHDOG
  // Survives process/container restarts.
  // The existing 30-second timer remains the fast path;
  // this database scan is the recovery path.
  // =========================

  @Cron(CronExpression.EVERY_MINUTE)
  async runKitchenAckWatchdog() {
    if (this.kitchenAckWatchdogRunning) {
      return
    }

    this.kitchenAckWatchdogRunning =
      true

    try {
      const cutoff =
        new Date(
          Date.now() -
            60 * 1000,
        )

      const candidates =
        await this.orderRepo
          .createQueryBuilder('order')
          .where(
            'order.kitchenAcknowledged = :acknowledged',
            {
              acknowledged:
                false,
            },
          )
          .andWhere(
            'order.createdAt <= :cutoff',
            {
              cutoff,
            },
          )
          .andWhere(
            'order.status IN (:...statuses)',
            {
              statuses: [
                OrderStatus.NEW,
                OrderStatus.PREPARING,
                OrderStatus.READY,
              ],
            },
          )
          .andWhere(
            'order.stripePaymentIntentId IS NOT NULL',
          )
          .andWhere(
            '(order.requiresOwnerAction = :noAction OR order.issueResolved = :resolved)',
            {
              noAction: false,
              resolved: true,
            },
          )
          .orderBy(
            'order.id',
            'ASC',
          )
          .take(100)
          .getMany()

      for (const candidate of candidates) {
        const now =
          new Date()

        /*
         * This UPDATE is deliberately conditional.
         *
         * If an ACK wins the race first,
         * kitchenAcknowledged is already true and this
         * update affects zero rows.
         *
         * This also refuses to overwrite any other
         * unresolved Action Center issue.
         */
        const result =
          await this.orderRepo
            .createQueryBuilder()
            .update(Order)
            .set({
              acknowledgementRetries:
                () =>
                  'COALESCE("acknowledgementRetries", 0) + 1',

              requiresOwnerAction:
                true,

              issueResolved:
                false,

              issueType:
                OwnerIssueType.KITCHEN_ACK_TIMEOUT,

              ownerIssueType:
                OwnerIssueType.KITCHEN_ACK_TIMEOUT,

              ownerIssueSeverity:
                OwnerIssueSeverity.CRITICAL,

              ownerActionMessage:
                'Kitchen did not confirm receiving this paid order. Check the kitchen tablet/internet and refund the customer if the order was not prepared.',

              ownerActionCreatedAt:
                now,

              ownerActionResolvedAt:
                null,

              ownerActionResolvedBy:
                null,

              ownerActionId:
                `ACT-${String(
                  candidate.id,
                ).padStart(6, '0')}`,
            })
            .where(
              'id = :id',
              {
                id: candidate.id,
              },
            )
            .andWhere(
              '"kitchenAcknowledged" = :acknowledged',
              {
                acknowledged:
                  false,
              },
            )
            .andWhere(
              'status IN (:...statuses)',
              {
                statuses: [
                  OrderStatus.NEW,
                  OrderStatus.PREPARING,
                  OrderStatus.READY,
                ],
              },
            )
            .andWhere(
              '"stripePaymentIntentId" IS NOT NULL',
            )
            .andWhere(
              '("requiresOwnerAction" = :noAction OR "issueResolved" = :resolved)',
              {
                noAction:
                  false,
                resolved:
                  true,
              },
            )
            .execute()

        if (
          Number(
            result.affected || 0,
          ) !== 1
        ) {
          continue
        }

        this.logger.error(
          `DURABLE_KITCHEN_ACK_TIMEOUT: Order ${candidate.id}`,
        )
      }

      if (candidates.length > 0) {
        this.logger.log(
          `Kitchen ACK watchdog checked ${candidates.length} unacknowledged active orders.`,
        )
      }
    } catch (err: any) {
      this.logger.error(
        'KITCHEN_ACK_WATCHDOG_FAILED',
        err,
      )
    } finally {
      this.kitchenAckWatchdogRunning =
        false
    }
  }

  // =========================
  // 💰 SALES LEDGER REPAIR
  // Runs every 1 minute independently
  // from Stripe pending-order recovery.
  // =========================

  @Cron(CronExpression.EVERY_MINUTE)
  async runSalesCommissionSweep() {
    if (
      this
        .salesCommissionSweepRunning
    ) {
      return
    }

    this.salesCommissionSweepRunning =
      true

    try {
      /*
       * Ordering matters:
       *
       * 1. recover authoritative Stripe payment time;
       * 2. repair/create durable commission ledger;
       * 3. release commissions whose 30-day time
       *    has actually arrived.
       */
      const paidAtResult =
        await this
          .repairMissingSalesPaidAt(
            25,
          )

      const repairResult =
        await this
          .salesCommissionService
          .reconcileMissingCommissions(
            100,
          )

      const releaseResult =
        await this
          .salesCommissionService
          .releaseMatureCommissions(
            100,
          )

      if (
        paidAtResult.checked > 0 ||
        repairResult.checked > 0 ||
        releaseResult.checked > 0
      ) {
        this.logger.log(
          `Sales commission sweep checked ${paidAtResult.checked} missing paidAt orders, repaired ${paidAtResult.repaired}, checked ${repairResult.checked} missing ledger candidates, recorded ${repairResult.recorded}, checked ${releaseResult.checked} mature commissions, and released ${releaseResult.released}.`,
        )
      }
    } catch (err: any) {
      this.logger.error(
        'SALES_COMMISSION_SWEEP_FAILED',
        err,
      )
    } finally {
      this.salesCommissionSweepRunning =
        false
    }
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

        const connectedAccountId =
          String(
            business.stripeAccountId ||
              '',
          ).trim()

        let session:
          Stripe.Checkout.Session

        if (connectedAccountId) {
          try {
            /*
             * New restaurant payments are direct
             * charges, so their Checkout Session
             * belongs to the connected café account.
             */
            session =
              await this.stripe.checkout.sessions.retrieve(
                pending.stripeSessionId,
                {},
                {
                  stripeAccount:
                    connectedAccountId,
                },
              )
          } catch (error: unknown) {
            if (
              !this.isStripeResourceMissing(
                error,
              )
            ) {
              throw error
            }

            /*
             * Legacy destination-charge orders were
             * created on the CaviarQR platform account.
             */
            session =
              await this.stripe.checkout.sessions.retrieve(
                pending.stripeSessionId,
              )
          }
        } else {
          session =
            await this.stripe.checkout.sessions.retrieve(
              pending.stripeSessionId,
            )
        }

        const paymentIntentId =
          typeof session.payment_intent ===
          'string'
            ? session.payment_intent
            : session.payment_intent
                ?.id || ''

        pending.stripePaymentIntentId =
          paymentIntentId || null

        if (
          session.payment_status ===
            'paid'
        ) {
          let paidAt:
            Date | null = null

          try {
            paidAt =
              await this
                .getRestaurantPaymentPaidAt(
                  paymentIntentId,
                  connectedAccountId,
                )
          } catch (error: unknown) {
            this.logger.error(
              `RECONCILIATION_PAID_AT_LOOKUP_FAILED: ${paymentIntentId}`,
              error,
            )
          }

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
            if (
              !existingOrder.paidAt &&
              paidAt
            ) {
              existingOrder.paidAt =
                paidAt

              await this.orderRepo.save(
                existingOrder,
              )
            }

            pending.status =
              PendingOrderStatus.COMPLETED

            pending.issueCreated =
              true

            pending.failureReason =
              null

            pending.completedAt =
              new Date()

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

            await this
              .salesCommissionService
              .recordPaidOrderSafely(
                existingOrder.id,
                'RECONCILIATION_EXISTING_ORDER',
              )

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

          const platformFee =
            Number(
              Number(
                pending.platformFee ||
                  0,
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

          order.paidAt =
            paidAt

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

          let saved: Order

          try {
            saved =
              await this.orderRepo.save(
                order,
              )
          } catch (error: unknown) {
            if (
              !this.isPostgresUniqueViolation(
                error,
              )
            ) {
              throw error
            }

            /*
             * Another webhook/reconciliation worker
             * may have created the same order between
             * our duplicate check and INSERT.
             */
            const concurrentByPaymentIntent =
              paymentIntentId
                ? await this.orderRepo.findOne({
                    where: {
                      stripePaymentIntentId:
                        paymentIntentId,
                    },
                  })
                : null

            const concurrentBySession =
              await this.orderRepo.findOne({
                where: {
                  stripeSessionId:
                    pending.stripeSessionId,
                },
              })

            const concurrentOrder =
              concurrentByPaymentIntent ||
              concurrentBySession

            if (!concurrentOrder) {
              throw error
            }

            if (
              !concurrentOrder.paidAt &&
              paidAt
            ) {
              concurrentOrder.paidAt =
                paidAt

              await this.orderRepo.save(
                concurrentOrder,
              )
            }

            pending.status =
              PendingOrderStatus.COMPLETED

            pending.issueCreated =
              true

            pending.failureReason =
              null

            pending.completedAt =
              new Date()

            await this.pendingOrderRepo.save(
              pending,
            )

            results.push({
              pendingOrderId:
                pending.id,
              orderId:
                concurrentOrder.id,
              status:
                'ORDER_RECOVERED_CONCURRENTLY',
            })

            await this
              .salesCommissionService
              .recordPaidOrderSafely(
                concurrentOrder.id,
                'RECONCILIATION_CONCURRENT_ORDER',
              )

            continue
          }

          /*
           * A recovered paid order was delayed, so keep
           * a genuine Action Center issue for restaurant
           * review even if realtime delivery succeeds.
           */
          saved =
            await this.createOwnerIssue(
              saved,
              OwnerIssueType.WEBHOOK_TIMEOUT,
              OwnerIssueSeverity.CRITICAL,
              'Stripe shows this customer paid, but the normal webhook flow did not finish. This order was recovered by reconciliation. Check the kitchen and refund the customer if the order was not prepared.',
            )

          /*
           * The old reconciliation path only saved the
           * recovered order. It never sent it to kitchen.
           */
          try {
            this.orderGateway.emitNewOrder(
              business.id,
              saved,
            )

            this.logger.log(
              `Recovered Order ${saved.id} sent to kitchen.`,
            )
          } catch (error: unknown) {
            saved =
              await this.createOwnerIssue(
                saved,
                OwnerIssueType.SOCKET_EMIT_FAILED,
                OwnerIssueSeverity.CRITICAL,
                'Recovered paid order could not be delivered to the kitchen. Check this order immediately.',
              )

            this.logger.error(
              `RECOVERED_ORDER_SOCKET_EMIT_FAILED: ${saved.id}`,
              error,
            )
          }

          pending.status =
            PendingOrderStatus.COMPLETED

          pending.issueCreated =
            true

          pending.failureReason =
            'Paid order recovered by reconciliation.'

          pending.completedAt =
            new Date()

          await this.pendingOrderRepo.save(
            pending,
          )


          await this
            .salesCommissionService
            .recordPaidOrderSafely(
              saved.id,
              'RECONCILIATION_RECOVERED_ORDER',
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

        if (
          session.status ===
            'expired'
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
    return this.orderRepo
      .createQueryBuilder('order')
      .where(
        'order.requiresOwnerAction = :required',
        {
          required: true,
        },
      )
      .andWhere(
        'order.issueResolved = :resolved',
        {
          resolved: false,
        },
      )
      .andWhere(
        `(
          order.ownerIssueType IS NOT NULL
          OR order.issueType IS NOT NULL
        )`,
      )
      .orderBy(
        'order.ownerActionCreatedAt',
        'DESC',
        'NULLS LAST',
      )
      .addOrderBy(
        'order.id',
        'DESC',
      )
      .getMany()
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  async resolveIssue(id: number) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const order =
      await this.orderRepo.findOne({
        where: {
          id: orderId,
        },
      })

    if (!order) {
      throw new BadRequestException(
        'Order not found.',
      )
    }

    order.issueResolved = true
    order.requiresOwnerAction = false
    order.issueType = 'RESOLVED'

    order.ownerIssueType = null
    order.ownerIssueSeverity = null
    order.ownerActionMessage =
      'Resolved by CaviarQR maintenance.'

    order.ownerActionResolvedAt =
      new Date()

    order.ownerActionResolvedBy =
      'MAINTENANCE_ADMIN'

    await this.orderRepo.save(order)

    return {
      success: true,
      message: 'Issue resolved.',
      orderId: order.id,
    }
  }

  // =========================
  // 💳 REFUND ORDER
  // =========================

  async refundOrder(
    id: number,
    body?: {
      reason?: string
      performedBy?: string
    },
  ) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const order =
      await this.orderRepo.findOne({
        where: {
          id: orderId,
        },
      })

    if (!order) {
      throw new BadRequestException(
        'Order not found.',
      )
    }

    if (
      order.status ===
        OrderStatus.REFUNDED ||
      order.refundProcessed ||
      order.refundId
    ) {
      throw new BadRequestException(
        'A refund already exists for this order. Check Stripe before attempting another refund.',
      )
    }

    if (
      !order.stripePaymentIntentId
    ) {
      throw new BadRequestException(
        'This order does not have a Stripe payment intent.',
      )
    }

    const reason =
      String(
        body?.reason ||
          'Refunded by CaviarQR maintenance.',
      ).trim()

    const performedBy =
      String(
        body?.performedBy ||
          'MAINTENANCE_ADMIN',
      ).trim()

    const previousStatus =
      order.status

    order.refundRequested =
      true

    order.refundRequestedAt =
      new Date()

    order.refundLastAttemptAt =
      new Date()

    order.refundReason =
      reason

    order.refundedBy =
      performedBy

    order.refundFailureMessage =
      null

    await this.orderRepo.save(
      order,
    )

    await this.createAuditLog({
      action:
        MaintenanceAuditAction.REFUND_REQUESTED,

      order,

      performedBy,

      reason,

      metadata: {
        paymentIntentId:
          order.stripePaymentIntentId,

        orderTotal:
          order.total,

        previousStatus,
      },
    })

    let refund: Stripe.Refund

    // Only errors from the Stripe refund request
    // are handled in this catch block.
    try {
      let connectedAccountId:
        string | null = null

      let paymentIntent:
        Stripe.PaymentIntent

      try {
        paymentIntent =
          await this.stripe.paymentIntents.retrieve(
            order.stripePaymentIntentId,
          )
      } catch (platformError: any) {
        if (
          platformError?.code !==
          'resource_missing'
        ) {
          throw platformError
        }

        const business =
          await this.businessRepo.findOne({
            where: {
              id: order.businessId,
            },
          })

        connectedAccountId =
          String(
            business?.stripeAccountId ||
              '',
          ).trim() || null

        if (!connectedAccountId) {
          throw new BadRequestException(
            'Connected Stripe account is missing for this order.',
          )
        }

        paymentIntent =
          await this.stripe.paymentIntents.retrieve(
            order.stripePaymentIntentId,
            {},
            {
              stripeAccount:
                connectedAccountId,
            },
          )
      }

      const params:
        Stripe.RefundCreateParams = {
          payment_intent:
            order.stripePaymentIntentId,

          metadata: {
            orderId:
              String(order.id),

            businessId:
              String(
                order.businessId,
              ),

            storeCode:
              order.storeCode || '',

            performedBy,
          },
        }

      if (
        !connectedAccountId &&
        paymentIntent.transfer_data
          ?.destination
      ) {
        params.reverse_transfer =
          true

        if (
          Number(
            paymentIntent
              .application_fee_amount ||
              0,
          ) > 0
        ) {
          params.refund_application_fee =
            true
        }
      }

      refund =
        await this.stripe.refunds.create(
          params,
          {
            idempotencyKey:
              `maintenance-refund-order-${order.id}`,
            ...(connectedAccountId
              ? {
                  stripeAccount:
                    connectedAccountId,
                }
              : {}),
          },
        )
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        'Stripe rejected the refund request.'

      const outcomeUnknown =
        err?.type ===
          'StripeConnectionError' ||
        err?.type ===
          'StripeAPIError'

      order.refundProcessed =
        false

      order.stripeRefundStatus =
        outcomeUnknown
          ? 'unknown'
          : 'failed'

      order.refundFailureMessage =
        errorMessage

      order.refundLastAttemptAt =
        new Date()

      order.requiresOwnerAction =
        true

      order.issueResolved =
        false

      order.issueType =
        outcomeUnknown
          ? OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
          : OwnerIssueType.REFUND_FAILED

      order.ownerIssueType =
        outcomeUnknown
          ? OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
          : OwnerIssueType.REFUND_FAILED

      order.ownerIssueSeverity =
        OwnerIssueSeverity.CRITICAL

      order.ownerActionMessage =
        outcomeUnknown
          ? `Stripe refund outcome is unknown: ${errorMessage}. Check Stripe before retrying.`
          : `Stripe refund request failed: ${errorMessage}`

      order.ownerActionCreatedAt =
        order.ownerActionCreatedAt ||
        new Date()

      await this.orderRepo.save(
        order,
      )

      try {
        await this.createAuditLog({
          action:
            MaintenanceAuditAction.REFUND_FAILED,

          order,

          performedBy,

          reason,

          metadata: {
            paymentIntentId:
              order.stripePaymentIntentId,

            error:
              errorMessage,

            outcomeUnknown,

            stage:
              'STRIPE_REFUND_CREATE',
          },
        })
      } catch (auditError: any) {
        this.logger.error(
          `REFUND_FAILURE_AUDIT_LOG_FAILED: ${order.id}`,
          auditError,
        )
      }

      this.logger.error(
        `STRIPE_REFUND_CREATE_FAILED: ${order.id}`,
        err,
      )

      throw new BadRequestException(
        outcomeUnknown
          ? 'The Stripe refund outcome is unknown. Check Stripe before trying again.'
          : errorMessage,
      )
    }

    const refundedAmount =
      Number(
        (
          refund.amount /
          100
        ).toFixed(2),
      )

    const refundDate =
      new Date(
        refund.created * 1000,
      )

    const refundStatus =
      refund.status ||
      'pending'

    const transferReversal =
      refund.transfer_reversal ||
      refund.source_transfer_reversal

    const transferReversalId =
      typeof transferReversal ===
      'string'
        ? transferReversal
        : transferReversal?.id ||
          null

    order.refundId =
      refund.id

    order.stripeRefundStatus =
      refundStatus

    order.refundAmount =
      refundedAmount

    order.refundAt =
      refundDate

    order.refundLastAttemptAt =
      new Date()

    order.transferReversalId =
      transferReversalId

    order.refundTransferReversed =
      Boolean(
        transferReversalId,
      )

    // =========================
    // REFUND PENDING OR FAILED
    // =========================

    if (
      refundStatus !==
      'succeeded'
    ) {
      const terminalFailure =
        refundStatus ===
          'failed' ||
        refundStatus ===
          'canceled'

      const statusMessage =
        terminalFailure
          ? refund.failure_reason ||
            `Stripe refund ${refundStatus}.`
          : `Stripe refund is currently ${refundStatus}.`

      order.refundProcessed =
        false

      order.refundApplicationFee =
        false

      order.refundFailureMessage =
        terminalFailure
          ? statusMessage
          : null

      order.requiresOwnerAction =
        true

      order.issueResolved =
        false

      order.issueType =
        terminalFailure
          ? OwnerIssueType.REFUND_FAILED
          : OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueType =
        terminalFailure
          ? OwnerIssueType.REFUND_FAILED
          : OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueSeverity =
        terminalFailure
          ? OwnerIssueSeverity.CRITICAL
          : OwnerIssueSeverity.WARNING

      order.ownerActionMessage =
        `${statusMessage} Check Stripe before attempting another refund.`

      order.ownerActionCreatedAt =
        order.ownerActionCreatedAt ||
        new Date()

      await this.orderRepo.save(
        order,
      )

      if (terminalFailure) {
        try {
          await this.createAuditLog({
            action:
              MaintenanceAuditAction.REFUND_FAILED,

            order,

            performedBy,

            reason,

            metadata: {
              refundId:
                refund.id,

              paymentIntentId:
                order.stripePaymentIntentId,

              refundAmount:
                refundedAmount,

              stripeRefundStatus:
                refundStatus,

              failureReason:
                refund.failure_reason,

              stage:
                'STRIPE_REFUND_STATUS',
            },
          })
        } catch (auditError: any) {
          this.logger.error(
            `REFUND_STATUS_AUDIT_LOG_FAILED: ${order.id}`,
            auditError,
          )
        }

        throw new BadRequestException(
          statusMessage,
        )
      }

      return {
        success: false,
        pending: true,
        message:
          statusMessage,
        orderId:
          order.id,
        refundId:
          refund.id,
        refundAmount:
          refundedAmount,
        refundDate:
          order.refundAt,
        stripeRefundStatus:
          refundStatus,
        applicationFeeRefunded:
          false,
        transferReversed:
          order.refundTransferReversed,
        transferReversalId:
          order.transferReversalId,
      }
    }

    // =========================
    // SUCCESSFUL REFUND
    // =========================

    order.status =
      OrderStatus.REFUNDED

    order.lastStatusAt =
      refundDate

    order.refundProcessed =
      true

    order.refundApplicationFee =
      true

    order.refundFailureMessage =
      null

    const reversalRecorded =
      Boolean(
        order.transferReversalId,
      )

    if (reversalRecorded) {
      order.issueResolved =
        true

      order.requiresOwnerAction =
        false

      order.issueType =
        'REFUNDED'

      order.ownerIssueType =
        null

      order.ownerIssueSeverity =
        null

      order.ownerActionMessage =
        `Customer refunded ${refundedAmount.toFixed(
          2,
        )}. Application fee refunded and cafe transfer reversed.`

      order.ownerActionResolvedAt =
        new Date()

      order.ownerActionResolvedBy =
        performedBy

      order.ownerActionAt =
        new Date()

      order.ownerActionBy =
        performedBy

      order.resolutionReason =
        'CUSTOMER_REFUNDED'
    } else {
      order.issueResolved =
        false

      order.requiresOwnerAction =
        true

      order.issueType =
        OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueType =
        OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueSeverity =
        OwnerIssueSeverity.CRITICAL

      order.ownerActionMessage =
        `Stripe refund ${refund.id} succeeded, but no transfer-reversal ID was returned. Verify the cafe transfer in Stripe.`

      order.ownerActionCreatedAt =
        new Date()

      order.ownerActionResolvedAt =
        null

      order.ownerActionResolvedBy =
        null

      order.ownerActionAt =
        new Date()

      order.ownerActionBy =
        performedBy

      order.resolutionReason =
        'REFUND_RECONCILIATION_REQUIRED'
    }

    try {
      await this.orderRepo.save(
        order,
      )
    } catch (databaseError: any) {
      this.logger.error(
        `REFUND_SUCCEEDED_DATABASE_UPDATE_FAILED: ${order.id} REFUND: ${refund.id}`,
        databaseError,
      )

      throw new BadRequestException(
        `Stripe refund ${refund.id} succeeded, but the database update failed. Do not create another refund. Reconcile the order using the Stripe refund ID.`,
      )
    }

    let auditLogged =
      true

    try {
      await this.createAuditLog({
        action:
          MaintenanceAuditAction.ORDER_REFUNDED,

        order,

        performedBy,

        reason,

        metadata: {
          refundId:
            refund.id,

          paymentIntentId:
            order.stripePaymentIntentId,

          refundAmount:
            refundedAmount,

          refundDate:
            refundDate.toISOString(),

          stripeRefundStatus:
            refundStatus,

          applicationFeeRefunded:
            order.refundApplicationFee,

          transferReversed:
            order.refundTransferReversed,

          transferReversalId:
            order.transferReversalId,

          previousStatus,

          newStatus:
            OrderStatus.REFUNDED,
        },
      })
    } catch (auditError: any) {
      auditLogged =
        false

      this.logger.error(
        `REFUND_SUCCEEDED_AUDIT_LOG_FAILED: ${order.id} REFUND: ${refund.id}`,
        auditError,
      )

      order.requiresOwnerAction =
        true

      order.issueResolved =
        false

      order.issueType =
        OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueType =
        OwnerIssueType.REFUND_RECONCILIATION_REQUIRED

      order.ownerIssueSeverity =
        OwnerIssueSeverity.CRITICAL

      order.ownerActionMessage =
        `Stripe refund ${refund.id} succeeded, but its audit log could not be saved.`

      order.ownerActionCreatedAt =
        new Date()

      try {
        await this.orderRepo.save(
          order,
        )
      } catch (
        reconciliationSaveError: any
      ) {
        this.logger.error(
          `REFUND_AUDIT_RECONCILIATION_SAVE_FAILED: ${order.id}`,
          reconciliationSaveError,
        )
      }
    }

    return {
      success: true,

      message:
        auditLogged &&
        reversalRecorded
          ? 'Order refunded successfully.'
          : 'Order refunded, but maintenance reconciliation is required.',

      orderId:
        order.id,

      refundId:
        refund.id,

      refundAmount:
        refundedAmount,

      refundDate:
        order.refundAt,

      stripeRefundStatus:
        refundStatus,

      applicationFeeRefunded:
        order.refundApplicationFee,

      transferReversed:
        order.refundTransferReversed,

      transferReversalId:
        order.transferReversalId,

      auditLogged,

      reconciliationRequired:
        !auditLogged ||
        !reversalRecorded,

      status:
        order.status,
    }
  }

  // =========================
  // 🔥 EMAIL CUSTOMER
  // =========================

  async emailCustomer(body: {
    orderId: number
    email: string
    name?: string
    note: string
  }) {
    const orderId =
      Number(body.orderId)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid orderId is required.',
      )
    }

    const order =
      await this.orderRepo.findOne({
        where: {
          id: orderId,
        },
      })

    if (!order) {
      throw new BadRequestException(
        'Order not found.',
      )
    }

    const email =
      String(
        body.email ||
          order.customerEmail ||
          '',
      )
        .trim()
        .toLowerCase()

    if (!email) {
      throw new BadRequestException(
        'This order has no customer email.',
      )
    }

    const note =
      String(body.note || '').trim()

    if (!note) {
      throw new BadRequestException(
        'Email note is required.',
      )
    }

    if (!this.resend) {
      throw new BadRequestException(
        'Email service is not configured. Add RESEND_API_KEY to backend .env and restart backend.',
      )
    }

    const customerName =
      String(
        body.name ||
          order.customerName ||
          'there',
      ).trim()

    const from =
      process.env.MAINTENANCE_EMAIL_FROM ||
      'CaviarQR <onboarding@resend.dev>'

    const subject =
      `Update on your CaviarQR order #${order.id}`

    const safeName =
      this.escapeEmailHtml(
        customerName,
      )

    const safeNote =
      this.escapeEmailHtml(note).replace(
        /\n/g,
        '<br />',
      )

    const safeCafe =
      this.escapeEmailHtml(
        order.storeCode || 'CaviarQR',
      )

    const total =
      Number(order.total || 0).toFixed(2)

    const text =
      `Hi ${customerName},

${note}

Order: #${order.id}
Cafe: ${order.storeCode || 'CaviarQR'}
Total: $${total}

CaviarQR Support`

    const html =
      `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">CaviarQR Order Update</h2>

          <p>Hi ${safeName},</p>

          <p>${safeNote}</p>

          <div style="margin-top: 18px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb;">
            <p style="margin: 0;"><strong>Order:</strong> #${order.id}</p>
            <p style="margin: 4px 0 0;"><strong>Cafe:</strong> ${safeCafe}</p>
            <p style="margin: 4px 0 0;"><strong>Total:</strong> $${total}</p>
          </div>

          <p style="margin-top: 18px;">CaviarQR Support</p>
        </div>
      `

    const result =
      await this.resend.emails.send({
        from,
        to: email,
        subject,
        text,
        html,
      })

    if (result.error) {
      throw new BadRequestException(
        result.error.message ||
          'Email failed to send.',
      )
    }

    order.ownerActionMessage =
      `Customer emailed by maintenance: ${note.slice(
        0,
        250,
      )}`

    await this.orderRepo.save(order)

    return {
      success: true,
      message: 'Email sent successfully.',
      emailId:
        result.data?.id || null,
      orderId:
        order.id,
      to: email,
    }
  }

  // =========================
  // 🔥 GET ALL ORDERS
  // =========================

  private async getHistoricalMaintenanceByBusiness() {
    const rows:
      Array<{
        businessId: string
        orderCount: string
        grossRevenueCents: string
        netRevenueCents: string
        dashboardRevenueCents: string
        rawPlatformFeeCents: string
        netPlatformFeeCents: string
        statusRefundedOrderCount: string
        refundedOrderCount: string
        lastOrderAt:
          | Date
          | string
          | null
        currentMonthGrossRevenueCents: string
        currentMonthRawPlatformFeeCents: string
        currentMonthNetPlatformFeeCents: string
      }> =
      await this.orderRepo.manager.query(
        `
          SELECT
            "businessId"::text
              AS "businessId",

            COALESCE(
              SUM("orderCount"),
              0
            )::text
              AS "orderCount",

            COALESCE(
              SUM("grossRevenueCents"),
              0
            )::text
              AS "grossRevenueCents",

            COALESCE(
              SUM("netRevenueCents"),
              0
            )::text
              AS "netRevenueCents",

            COALESCE(
              SUM("dashboardRevenueCents"),
              0
            )::text
              AS "dashboardRevenueCents",

            COALESCE(
              SUM("rawPlatformFeeCents"),
              0
            )::text
              AS "rawPlatformFeeCents",

            COALESCE(
              SUM("netPlatformFeeCents"),
              0
            )::text
              AS "netPlatformFeeCents",

            COALESCE(
              SUM("statusRefundedOrderCount"),
              0
            )::text
              AS "statusRefundedOrderCount",

            COALESCE(
              SUM("refundedOrderCount"),
              0
            )::text
              AS "refundedOrderCount",

            MAX("lastOrderAt")
              AS "lastOrderAt",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    "year" =
                      EXTRACT(
                        YEAR FROM CURRENT_TIMESTAMP
                      )::int
                    AND
                    "month" =
                      EXTRACT(
                        MONTH FROM CURRENT_TIMESTAMP
                      )::int
                  THEN "grossRevenueCents"
                  ELSE 0
                END
              ),
              0
            )::text
              AS "currentMonthGrossRevenueCents",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    "year" =
                      EXTRACT(
                        YEAR FROM CURRENT_TIMESTAMP
                      )::int
                    AND
                    "month" =
                      EXTRACT(
                        MONTH FROM CURRENT_TIMESTAMP
                      )::int
                  THEN "rawPlatformFeeCents"
                  ELSE 0
                END
              ),
              0
            )::text
              AS "currentMonthRawPlatformFeeCents",

            COALESCE(
              SUM(
                CASE
                  WHEN
                    "year" =
                      EXTRACT(
                        YEAR FROM CURRENT_TIMESTAMP
                      )::int
                    AND
                    "month" =
                      EXTRACT(
                        MONTH FROM CURRENT_TIMESTAMP
                      )::int
                  THEN "netPlatformFeeCents"
                  ELSE 0
                END
              ),
              0
            )::text
              AS "currentMonthNetPlatformFeeCents"

          FROM
            "business_order_history_monthly"

          GROUP BY
            "businessId"
        `,
      )

    const result =
      new Map<
        number,
        {
          orderCount: number
          grossRevenue: number
          processedNetRevenue: number
          dashboardRevenue: number
          rawPlatformFees: number
          netPlatformFees: number
          statusRefundedOrderCount: number
          refundedOrderCount: number
          lastOrderAt: Date | null
          currentMonthGrossRevenue: number
          currentMonthRawPlatformFees: number
          currentMonthNetPlatformFees: number
        }
      >()

    for (const row of rows) {
      const businessId =
        Number(
          row.businessId,
        )

      if (
        !Number.isInteger(
          businessId,
        ) ||
        businessId < 1
      ) {
        continue
      }

      result.set(
        businessId,
        {
          orderCount:
            Number(
              row.orderCount ||
                0,
            ),

          grossRevenue:
            Number(
              row.grossRevenueCents ||
                0,
            ) / 100,

          processedNetRevenue:
            Number(
              row.netRevenueCents ||
                0,
            ) / 100,

          dashboardRevenue:
            Number(
              row.dashboardRevenueCents ||
                0,
            ) / 100,

          rawPlatformFees:
            Number(
              row.rawPlatformFeeCents ||
                0,
            ) / 100,

          netPlatformFees:
            Number(
              row.netPlatformFeeCents ||
                0,
            ) / 100,

          statusRefundedOrderCount:
            Number(
              row.statusRefundedOrderCount ||
                0,
            ),

          refundedOrderCount:
            Number(
              row.refundedOrderCount ||
                0,
            ),

          lastOrderAt:
            row.lastOrderAt
              ? new Date(
                  row.lastOrderAt,
                )
              : null,

          currentMonthGrossRevenue:
            Number(
              row.currentMonthGrossRevenueCents ||
                0,
            ) / 100,

          currentMonthRawPlatformFees:
            Number(
              row.currentMonthRawPlatformFeeCents ||
                0,
            ) / 100,

          currentMonthNetPlatformFees:
            Number(
              row.currentMonthNetPlatformFeeCents ||
                0,
            ) / 100,
        },
      )
    }

    return result
  }

  async getAllOrders() {
    return this.orderRepo
      .createQueryBuilder('order')
      .where(
        '"order"."archivedAt" IS NULL',
      )
      .orderBy(
        '"order"."id"',
        'DESC',
      )
      .getMany()
  }

  // =========================
  // ☕ SCALABLE CAFE SUMMARIES
  // =========================

  async getCafeSummaries() {
    const historical =
      await this
        .getHistoricalMaintenanceByBusiness()

    const rows =
      await this.businessRepo
        .createQueryBuilder('business')
        .leftJoin(
          Order,
          'order',
          `
            "order"."businessId" =
              business.id
            AND
            "order"."archivedAt"
              IS NULL
          `,
        )
        .select(
          'business.id',
          'businessId',
        )
        .addSelect(
          'business.storeCode',
          'storeCode',
        )
        .addSelect(
          'COUNT("order"."id")',
          'orders',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN "order"."id" IS NULL
                  THEN 0
                WHEN "order"."refundProcessed" = true
                  THEN GREATEST(
                    "order"."total" -
                    COALESCE(
                      "order"."refundAmount",
                      0
                    ),
                    0
                  )
                ELSE "order"."total"
              END
            ),
            0
          )`,
          'revenue',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN
                  "order"."createdAt" >=
                    date_trunc(
                      'month',
                      CURRENT_TIMESTAMP
                    )
                  AND NOT (
                    (
                      "order"."status" = 'REFUNDED'
                      OR
                      "order"."refundProcessed" = true
                    )
                    AND
                    "order"."refundApplicationFee" = true
                  )
                THEN
                  COALESCE(
                    "order"."platformFee",
                    0
                  )
                ELSE 0
              END
            ),
            0
          )`,
          'monthPlatformFees',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN
                  (
                    "order"."status" = 'REFUNDED'
                    OR
                    "order"."refundProcessed" = true
                  )
                  AND
                  "order"."refundApplicationFee" = true
                THEN 0
                ELSE
                  COALESCE(
                    "order"."platformFee",
                    0
                  )
              END
            ),
            0
          )`,
          'allTimePlatformFees',
        )
        .addSelect(
          `COUNT("order"."id") FILTER (
            WHERE
              "order"."requiresOwnerAction" = true
              AND
              "order"."issueResolved" = false
              AND (
                "order"."ownerIssueType" IS NOT NULL
                OR
                "order"."issueType" IS NOT NULL
              )
          )`,
          'openIssues',
        )
        .addSelect(
          `COUNT("order"."id") FILTER (
            WHERE
              "order"."requiresOwnerAction" = true
              AND
              "order"."issueResolved" = false
              AND
              "order"."ownerIssueSeverity" = 'CRITICAL'
              AND (
                "order"."ownerIssueType" IS NOT NULL
                OR
                "order"."issueType" IS NOT NULL
              )
          )`,
          'criticalIssues',
        )
        .addSelect(
          'MAX("order"."createdAt")',
          'lastOrderAt',
        )
        .groupBy(
          'business.id',
        )
        .addGroupBy(
          'business.storeCode',
        )
        .getRawMany()

    return rows
      .map((row: any) => {
        const businessId =
          Number(
            row.businessId,
          )

        const history =
          historical.get(
            businessId,
          )

        const liveLast =
          row.lastOrderAt
            ? new Date(
                row.lastOrderAt,
              )
            : null

        const historicalLast =
          history?.lastOrderAt ||
          null

        const lastOrderAt =
          historicalLast &&
          (
            !liveLast ||
            historicalLast.getTime() >
              liveLast.getTime()
          )
            ? historicalLast
            : liveLast

        return {
          businessId,

          storeCode:
            String(
              row.storeCode ||
                '',
            ),

          cafeName:
            String(
              row.storeCode ||
                '',
            ),

          orders:
            Number(
              row.orders ||
                0,
            ) +
            (
              history?.orderCount ||
              0
            ),

          revenue:
            Number(
              row.revenue ||
                0,
            ) +
            (
              history
                ?.processedNetRevenue ||
              0
            ),

          monthPlatformFees:
            Number(
              row.monthPlatformFees ||
                0,
            ) +
            (
              history
                ?.currentMonthNetPlatformFees ||
              0
            ),

          allTimePlatformFees:
            Number(
              row.allTimePlatformFees ||
                0,
            ) +
            (
              history
                ?.netPlatformFees ||
              0
            ),

          openIssues:
            Number(
              row.openIssues ||
                0,
            ),

          criticalIssues:
            Number(
              row.criticalIssues ||
                0,
            ),

          lastOrderAt,
        }
      })
      .sort(
        (a, b) =>
          b.openIssues -
            a.openIssues ||
          b.criticalIssues -
            a.criticalIssues ||
          a.storeCode.localeCompare(
            b.storeCode,
          ),
      )
  }

  // =========================
  // ☕ PAGINATED CAFE ORDERS
  // =========================

  async getCafeOrders(
    storeCode: string,
    options?: {
      limit?: string
      cursor?: string
      search?: string
    },
  ) {
    const cleanStoreCode =
      String(
        storeCode || '',
      )
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode:
            cleanStoreCode,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Cafe not found',
      )
    }

    const requestedLimit =
      Number(
        options?.limit ||
          50,
      )

    const limit =
      Number.isFinite(
        requestedLimit,
      )
        ? Math.min(
            Math.max(
              Math.trunc(
                requestedLimit,
              ),
              1,
            ),
            100,
          )
        : 50

    const cursor =
      Number(
        options?.cursor ||
          0,
      )

    const search =
      String(
        options?.search ||
          '',
      )
        .trim()
        .slice(
          0,
          200,
        )

    const base =
      this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .where(
          '"order"."storeCode" = :storeCode',
          {
            storeCode:
              cleanStoreCode,
          },
        )
          .andWhere(
            '"order"."archivedAt" IS NULL',
          )

    const totalOrders =
      await base
        .clone()
        .getCount()

    if (
      search
    ) {
      base.andWhere(
        `(
          CAST("order"."id" AS TEXT) ILIKE :search
          OR COALESCE("order"."customerName", '') ILIKE :search
          OR COALESCE("order"."customerEmail", '') ILIKE :search
          OR COALESCE("order"."stripePaymentIntentId", '') ILIKE :search
          OR CAST("order"."status" AS TEXT) ILIKE :search
        )`,
        {
          search:
            `%${search}%`,
        },
      )
    }

    const filteredTotal =
      await base
        .clone()
        .getCount()

    if (
      Number.isInteger(
        cursor,
      ) &&
      cursor > 0
    ) {
      base.andWhere(
        '"order"."id" < :cursor',
        {
          cursor,
        },
      )
    }

    const rows =
      await base
        .orderBy(
          '"order"."id"',
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

    const last =
      orders[
        orders.length - 1
      ]

    return {
      business,

      orders,

      page: {
        limit,

        totalOrders,

        filteredTotal,

        hasMore,

        nextCursor:
          hasMore &&
          last
            ? String(
                last.id,
              )
            : null,
      },
    }
  }

  // =========================
  // 🔥 DASHBOARD STATS
  // =========================

  async getDashboardStats() {
    const historical =
      await this
        .getHistoricalMaintenanceByBusiness()

    const row =
      await this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .select(
          'COUNT("order"."id")',
          'totalOrders',
        )
        .addSelect(
          `COALESCE(
            SUM(
              GREATEST(
                "order"."total" -
                CASE
                  WHEN
                    "order"."refundProcessed" = true
                    OR
                    "order"."status" = 'REFUNDED'
                  THEN
                    COALESCE(
                      "order"."refundAmount",
                      "order"."total",
                      0
                    )
                  ELSE 0
                END,
                0
              )
            ),
            0
          )`,
          'totalRevenue',
        )
        .addSelect(
          `COUNT("order"."id") FILTER (
            WHERE
              "order"."requiresOwnerAction" = true
              AND
              "order"."issueResolved" = false
              AND (
                "order"."ownerIssueType" IS NOT NULL
                OR
                "order"."issueType" IS NOT NULL
              )
          )`,
          'unresolvedIssues',
        )
        .addSelect(
          `COUNT("order"."id") FILTER (
            WHERE
              "order"."status" = 'REFUNDED'
              OR
              "order"."refundProcessed" = true
          )`,
          'refundedOrders',
        )
        .addSelect(
          `COALESCE(
            SUM(
              COALESCE(
                "order"."platformFee",
                0
              )
            ),
            0
          )`,
          'grossPlatformFees',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN
                  (
                    "order"."status" = 'REFUNDED'
                    OR
                    "order"."refundProcessed" = true
                  )
                  AND
                  "order"."refundApplicationFee" = true
                THEN
                  COALESCE(
                    "order"."platformFee",
                    0
                  )
                ELSE 0
              END
            ),
            0
          )`,
          'refundedPlatformFees',
        )
        .where(
          '"order"."archivedAt" IS NULL',
        )
        .getRawOne()

    let historicalOrders = 0
    let historicalRevenue = 0
    let historicalRefunded = 0
    let historicalGrossFees = 0
    let historicalNetFees = 0

    for (
      const history
      of historical.values()
    ) {
      historicalOrders +=
        history.orderCount

      historicalRevenue +=
        history.dashboardRevenue

      historicalRefunded +=
        history.refundedOrderCount

      historicalGrossFees +=
        history.rawPlatformFees

      historicalNetFees +=
        history.netPlatformFees
    }

    const grossPlatformFees =
      historicalGrossFees +
      Number(
        row?.grossPlatformFees ||
          0,
      )

    const refundedPlatformFees =
      (
        historicalGrossFees -
        historicalNetFees
      ) +
      Number(
        row?.refundedPlatformFees ||
          0,
      )

    return {
      totalOrders:
        historicalOrders +
        Number(
          row?.totalOrders ||
            0,
        ),

      totalRevenue:
        historicalRevenue +
        Number(
          row?.totalRevenue ||
            0,
        ),

      unresolvedIssues:
        Number(
          row?.unresolvedIssues ||
            0,
        ),

      refundedOrders:
        historicalRefunded +
        Number(
          row?.refundedOrders ||
            0,
        ),

      grossPlatformFees,

      refundedPlatformFees,

      netPlatformFees:
        grossPlatformFees -
        refundedPlatformFees,
    }
  }

  // =========================
  // 🔥 ADMIN DASHBOARD
  // =========================

  async getAdminDashboard() {
    const historical =
      await this
        .getHistoricalMaintenanceByBusiness()

    const [
      stats,
      recentOrders,
    ] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select(
          'COUNT(o.id)',
          'totalOrders',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN
                  o."refundProcessed" = true
                THEN
                  GREATEST(
                    o.total -
                    COALESCE(
                      o."refundAmount",
                      0
                    ),
                    0
                  )
                ELSE o.total
              END
            ),
            0
          )`,
          'totalRevenue',
        )
        .addSelect(
          `COUNT(o.id) FILTER (
            WHERE
              o."requiresOwnerAction" = true
              AND
              o."issueResolved" = false
              AND (
                o."ownerIssueType" IS NOT NULL
                OR
                o."issueType" IS NOT NULL
              )
          )`,
          'unresolvedIssues',
        )
        .addSelect(
          `COUNT(o.id) FILTER (
            WHERE
              o.status = 'REFUNDED'
              OR
              o."refundProcessed" = true
          )`,
          'refundedOrders',
        )
        .addSelect(
          `COALESCE(
            SUM(
              CASE
                WHEN
                  (
                    o.status = 'REFUNDED'
                    OR
                    o."refundProcessed" = true
                  )
                  AND
                  o."refundApplicationFee" = true
                THEN 0
                ELSE
                  COALESCE(
                    o."platformFee",
                    0
                  )
              END
            ),
            0
          )`,
          'platformFees',
        )
        .where(
          'o."archivedAt" IS NULL',
        )
        .getRawOne(),

      this.orderRepo
        .createQueryBuilder('o')
        .where(
          'o."archivedAt" IS NULL',
        )
        .orderBy(
          'o.id',
          'DESC',
        )
        .take(
          10,
        )
        .getMany(),
    ])

    let historicalOrders = 0
    let historicalRevenue = 0
    let historicalRefunded = 0
    let historicalPlatformFees = 0

    for (
      const history
      of historical.values()
    ) {
      historicalOrders +=
        history.orderCount

      historicalRevenue +=
        history.processedNetRevenue

      historicalRefunded +=
        history.refundedOrderCount

      historicalPlatformFees +=
        history.netPlatformFees
    }

    const totalOrders =
      historicalOrders +
      Number(
        stats?.totalOrders ||
          0,
      )

    const totalRevenue =
      historicalRevenue +
      Number(
        stats?.totalRevenue ||
          0,
      )

    const unresolvedIssues =
      Number(
        stats?.unresolvedIssues ||
          0,
      )

    const refundedOrders =
      historicalRefunded +
      Number(
        stats?.refundedOrders ||
          0,
      )

    const platformFees =
      historicalPlatformFees +
      Number(
        stats?.platformFees ||
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
      recentOrders,
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

    const historical =
      (
        await this
          .getHistoricalMaintenanceByBusiness()
      ).get(
        business.id,
      )

    const orders =
      await this.orderRepo
        .createQueryBuilder(
          'order',
        )
        .where(
          '"order"."businessId" = :businessId',
          {
            businessId:
              business.id,
          },
        )
        .andWhere(
          '"order"."archivedAt" IS NULL',
        )
        .orderBy(
          '"order"."id"',
          'DESC',
        )
        .getMany()

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

    const liveGross =
      orders.reduce(
        (s, o) =>
          s +
          Number(
            o.total ||
              0,
          ),
        0,
      )

    const livePlatformFees =
      orders.reduce(
        (s, o) =>
          s +
          Number(
            o.platformFee ||
              0,
          ),
        0,
      )

    const allTimeOrderCount =
      (
        historical
          ?.orderCount ||
        0
      ) +
      orders.length

    const allTimeRevenue =
      (
        historical
          ?.grossRevenue ||
        0
      ) +
      liveGross

    const allTimePlatformFees =
      (
        historical
          ?.rawPlatformFees ||
        0
      ) +
      livePlatformFees

    return {
      business,

      todayRevenue:
        todayOrders.reduce(
          (s, o) =>
            s +
            Number(
              o.total ||
                0,
            ),
          0,
        ),

      monthRevenue:
        (
          historical
            ?.currentMonthGrossRevenue ||
          0
        ) +
        monthOrders.reduce(
          (s, o) =>
            s +
            Number(
              o.total ||
                0,
            ),
          0,
        ),

      allTimeRevenue,

      todayPlatformFees:
        todayOrders.reduce(
          (s, o) =>
            s +
            Number(
              o.platformFee ||
                0,
            ),
          0,
        ),

      monthPlatformFees:
        (
          historical
            ?.currentMonthRawPlatformFees ||
          0
        ) +
        monthOrders.reduce(
          (s, o) =>
            s +
            Number(
              o.platformFee ||
                0,
            ),
          0,
        ),

      allTimePlatformFees,

      averageOrder:
        allTimeOrderCount
          ? allTimeRevenue /
            allTimeOrderCount
          : 0,

      refunds:
        (
          historical
            ?.statusRefundedOrderCount ||
          0
        ) +
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

  // =========================
  // 📧 EMAIL MARKETING ACCESS
  // =========================

  async updateEmailMarketingEnabled(
    storeCode: string,
    enabled: boolean,
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

    business.emailMarketingEnabled =
      enabled === true

    await this.businessRepo.save(
      business,
    )

    return {
      success: true,

      emailMarketingEnabled:
        business.emailMarketingEnabled,
    }
  }

  // =========================
  // 🔥 CAVIARQR COMMISSION BALANCE
  // =========================

  async getPlatformBalance() {
    return this.stripeService.getPlatformBalance()
  }

  // =========================
  // 🔥 WITHDRAW CAVIARQR COMMISSION
  // =========================

  async withdrawPlatformBalance(
    amount?: number,
  ) {
    return this.stripeService.withdrawPlatformBalance(
      amount,
    )
  }
}
