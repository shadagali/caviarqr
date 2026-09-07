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

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(PendingOrder)
    private pendingOrderRepo: Repository<PendingOrder>,

    @InjectRepository(MaintenanceAuditLog)
    private auditRepo: Repository<MaintenanceAuditLog>,

    private stripeService: StripeService,
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
      refund =
        await this.stripe.refunds.create(
          {
            payment_intent:
              order.stripePaymentIntentId,

            reverse_transfer:
              true,

            refund_application_fee:
              true,

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
          },
          {
            idempotencyKey:
              `maintenance-refund-order-${order.id}`,
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
        (sum, o) =>
          sum + o.total,
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
        (sum, o) =>
          sum + o.total,
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
            (o.platformFee || 0),
          0,
        ),

      monthPlatformFees:
        monthOrders.reduce(
          (s, o) =>
            s +
            (o.platformFee || 0),
          0,
        ),

      allTimePlatformFees:
        orders.reduce(
          (s, o) =>
            s +
            (o.platformFee || 0),
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