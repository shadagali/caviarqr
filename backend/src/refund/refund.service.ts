import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import {
  DataSource,
  In,
  Repository,
} from 'typeorm'
import Stripe from 'stripe'

import {
  Order,
  OrderStatus,
  OwnerIssueSeverity,
  OwnerIssueType,
} from '../order/order.entity'
import {
  CreateRefundDto,
  RefundReason,
} from './dto/create-refund.dto'
import {
  RefundAttempt,
  RefundAttemptStatus,
} from './entities/refund-attempt.entity'

type RefundRequestContext = {
  requestedBy: string
  requestIp: string | null
  userAgent: string | null
}

type ReservedRefund = {
  orderId: number
  paymentIntentId: string
  attemptId: string
  idempotencyKey: string
  amountCents: number
  currency: string
}

const ACTIVE_ATTEMPT_STATUSES = [
  RefundAttemptStatus.REQUESTED,
  RefundAttemptStatus.PROCESSING,
  RefundAttemptStatus.PENDING,
  RefundAttemptStatus.RECONCILIATION_REQUIRED,
]

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name)
  private readonly stripe: Stripe

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(RefundAttempt)
    private readonly attemptRepo: Repository<RefundAttempt>,

    private readonly dataSource: DataSource,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY

    if (!secretKey || !secretKey.startsWith('sk_')) {
      throw new Error(
        'Missing or invalid STRIPE_SECRET_KEY. Never hardcode Stripe secret keys.',
      )
    }

    this.stripe = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 20_000,
    })
  }

  async createRefund(
    orderId: number,
    dto: CreateRefundDto,
    context: RefundRequestContext,
  ) {
    const note = String(dto.note || '').trim()

    if (dto.reason === RefundReason.OTHER && !note) {
      throw new BadRequestException(
        'A note is required when the refund reason is OTHER.',
      )
    }

    const reservation = await this.reserveRefund(
      orderId,
      dto,
      note,
      context,
    )

    if ('completed' in reservation) {
      return reservation.completed
    }

    if ('active' in reservation) {
      return reservation.active
    }

    const reserved = reservation.reserved

    let reverseTransfer = false
    let refundApplicationFee = false

    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(
          reserved.paymentIntentId,
        )

      reverseTransfer = Boolean(
        paymentIntent.transfer_data?.destination,
      )

      refundApplicationFee =
        reverseTransfer &&
        Number(paymentIntent.application_fee_amount || 0) > 0

      await this.attemptRepo.update(
        reserved.attemptId,
        {
          status: RefundAttemptStatus.PROCESSING,
          reverseTransfer,
          refundApplicationFee,
        },
      )

      const params: Stripe.RefundCreateParams = {
        payment_intent: reserved.paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          orderId: String(reserved.orderId),
          refundAttemptId: reserved.attemptId,
          internalReason: dto.reason,
        },
      }

      if (reverseTransfer) {
        params.reverse_transfer = true
      }

      if (refundApplicationFee) {
        params.refund_application_fee = true
      }

      const refund = await this.stripe.refunds.create(
        params,
        {
          idempotencyKey: reserved.idempotencyKey,
        },
      )

      const result = await this.persistStripeRefund(
        refund,
        reserved.attemptId,
        reverseTransfer,
        refundApplicationFee,
        context.requestedBy,
      )

      if (!result.success && !result.pending) {
        throw new BadRequestException(result.message)
      }

      return result
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error
      }

      await this.persistStripeCreateError(
        reserved,
        error,
        context.requestedBy,
      )

      const uncertain = this.isUncertainStripeError(error)

      if (uncertain) {
        throw new ConflictException(
          'Stripe did not return a conclusive refund result. Do not create another refund. The attempt is marked for reconciliation.',
        )
      }

      throw new BadRequestException(
        error?.message || 'Stripe rejected the refund request.',
      )
    }
  }

  async getAttemptsForOrder(orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
    })

    if (!order) {
      throw new NotFoundException('Order not found.')
    }

    return this.attemptRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
      take: 50,
    })
  }

  async syncStripeRefund(refund: Stripe.Refund) {
    const metadataAttemptId = String(
      refund.metadata?.refundAttemptId || '',
    ).trim()

    let attempt = refund.id
      ? await this.attemptRepo.findOne({
          where: { stripeRefundId: refund.id },
        })
      : null

    if (!attempt && metadataAttemptId) {
      attempt = await this.attemptRepo.findOne({
        where: { id: metadataAttemptId },
      })
    }

    if (!attempt) {
      this.logger.warn(
        `Refund webhook could not be matched: ${refund.id}`,
      )
      return
    }

    return this.persistStripeRefund(
      refund,
      attempt.id,
      attempt.reverseTransfer,
      attempt.refundApplicationFee,
      attempt.requestedBy || 'stripe-webhook',
    )
  }

  private async reserveRefund(
    orderId: number,
    dto: CreateRefundDto,
    note: string,
    context: RefundRequestContext,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order)
      const attemptRepo = manager.getRepository(RefundAttempt)

      const order = await orderRepo
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne()

      if (!order) {
        throw new NotFoundException('Order not found.')
      }

      const successfulAttempt = await attemptRepo.findOne({
        where: {
          orderId,
          status: RefundAttemptStatus.SUCCEEDED,
        },
        order: { createdAt: 'DESC' },
      })

      if (
        order.status === OrderStatus.REFUNDED ||
        order.refundProcessed ||
        order.stripeRefundStatus === 'succeeded' ||
        successfulAttempt
      ) {
        return {
          completed: {
            success: true,
            duplicateRequest: true,
            message: 'This order is already refunded.',
            orderId: order.id,
            refundId:
              order.refundId ||
              successfulAttempt?.stripeRefundId ||
              null,
            refundAmount: Number(
              order.refundAmount ?? order.total ?? 0,
            ),
            stripeRefundStatus: 'succeeded',
            pending: false,
            reconciliationRequired: false,
          },
        }
      }

      if (!order.stripePaymentIntentId) {
        throw new BadRequestException(
          'This order does not have a Stripe PaymentIntent.',
        )
      }

      const activeAttempt = await attemptRepo.findOne({
        where: {
          orderId,
          status: In(ACTIVE_ATTEMPT_STATUSES),
        },
        order: { createdAt: 'DESC' },
      })

      if (activeAttempt) {
        return {
          active: {
            success: false,
            duplicateRequest: true,
            pending: true,
            reconciliationRequired:
              activeAttempt.status ===
              RefundAttemptStatus.RECONCILIATION_REQUIRED,
            message:
              activeAttempt.status ===
              RefundAttemptStatus.RECONCILIATION_REQUIRED
                ? 'A previous refund attempt requires reconciliation. Check Stripe before retrying.'
                : 'A refund is already being processed for this order.',
            orderId: order.id,
            refundId: activeAttempt.stripeRefundId,
            refundAmount: activeAttempt.amountCents / 100,
            stripeRefundStatus: activeAttempt.status,
          },
        }
      }

      const amountCents = Math.round(Number(order.total || 0) * 100)

      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new BadRequestException('Order total is invalid.')
      }

      const previousAttempts = await attemptRepo.count({
        where: { orderId },
      })

      const version = previousAttempts + 1
      const idempotencyKey =
        `caviarqr-order-${order.id}-full-refund-v${version}`

      const attempt = attemptRepo.create({
        orderId: order.id,
        stripePaymentIntentId: order.stripePaymentIntentId,
        idempotencyKey,
        stripeRefundId: null,
        amountCents,
        currency: 'usd',
        reason: dto.reason,
        note: note || null,
        requestedBy: context.requestedBy,
        requestIp: context.requestIp,
        userAgent: context.userAgent,
        status: RefundAttemptStatus.REQUESTED,
        reverseTransfer: false,
        refundApplicationFee: false,
        failureCode: null,
        failureMessage: null,
        stripeResponse: null,
        processedAt: null,
      })

      await attemptRepo.save(attempt)

      order.refundRequested = true
      order.refundRequestedAt = new Date()
      order.refundLastAttemptAt = new Date()
      order.refundReason = note
        ? `${dto.reason}: ${note}`
        : dto.reason
      order.refundedBy = context.requestedBy
      order.stripeRefundStatus = 'pending'
      order.refundFailureMessage = null

      await orderRepo.save(order)

      return {
        reserved: {
          orderId: order.id,
          paymentIntentId: order.stripePaymentIntentId,
          attemptId: attempt.id,
          idempotencyKey,
          amountCents,
          currency: attempt.currency,
        } satisfies ReservedRefund,
      }
    })
  }

  private async persistStripeRefund(
    refund: Stripe.Refund,
    attemptId: string,
    reverseTransfer: boolean,
    refundApplicationFee: boolean,
    performedBy: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(RefundAttempt)
      const orderRepo = manager.getRepository(Order)

      const attempt = await attemptRepo.findOne({
        where: { id: attemptId },
      })

      if (!attempt) {
        throw new NotFoundException('Refund attempt not found.')
      }

      const order = await orderRepo
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', {
          orderId: attempt.orderId,
        })
        .getOne()

      if (!order) {
        throw new NotFoundException('Order not found.')
      }

      const status = String(refund.status || 'pending')
      const refundAmount = Number((refund.amount / 100).toFixed(2))
      const refundDate = new Date(refund.created * 1000)

      const refundWithReversal = refund as Stripe.Refund & {
        transfer_reversal?: string | { id?: string } | null
        source_transfer_reversal?: string | { id?: string } | null
      }

      const reversal =
        refundWithReversal.transfer_reversal ||
        refundWithReversal.source_transfer_reversal

      const transferReversalId =
        typeof reversal === 'string'
          ? reversal
          : reversal?.id || null

      attempt.stripeRefundId = refund.id
      attempt.reverseTransfer = reverseTransfer
      attempt.refundApplicationFee = refundApplicationFee
      attempt.failureCode = refund.failure_reason || null
      attempt.failureMessage = refund.failure_reason || null
      attempt.processedAt = new Date()
      attempt.stripeResponse = {
        id: refund.id,
        status,
        amount: refund.amount,
        currency: refund.currency,
        created: refund.created,
        paymentIntent:
          typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : refund.payment_intent?.id || null,
        charge:
          typeof refund.charge === 'string'
            ? refund.charge
            : refund.charge?.id || null,
        failureReason: refund.failure_reason || null,
        transferReversalId,
      }

      order.refundId = refund.id
      order.stripeRefundStatus = status
      order.refundAmount = refundAmount
      order.refundAt = refundDate
      order.refundLastAttemptAt = new Date()
      order.refundTransferReversed = reverseTransfer
      order.refundApplicationFee = refundApplicationFee
      order.transferReversalId = transferReversalId

      if (status === 'succeeded') {
        attempt.status = RefundAttemptStatus.SUCCEEDED
        attempt.failureCode = null
        attempt.failureMessage = null

        order.status = OrderStatus.REFUNDED
        order.lastStatusAt = refundDate
        order.refundProcessed = true
        order.refundRequested = true
        order.refundFailureMessage = null
        order.requiresOwnerAction = false
        order.issueResolved = true
        order.issueType = 'REFUNDED'
        order.ownerIssueType = null
        order.ownerIssueSeverity = null
        order.ownerActionMessage =
          `Customer refunded $${refundAmount.toFixed(2)} through Stripe.`
        order.ownerActionResolvedAt = new Date()
        order.ownerActionResolvedBy = performedBy
        order.ownerActionAt = new Date()
        order.ownerActionBy = performedBy
        order.resolutionReason = 'CUSTOMER_REFUNDED'

        await attemptRepo.save(attempt)
        await orderRepo.save(order)

        return {
          success: true,
          pending: false,
          reconciliationRequired: false,
          message: 'Order refunded successfully.',
          orderId: order.id,
          refundId: refund.id,
          refundAmount,
          refundDate,
          stripeRefundStatus: status,
          applicationFeeRefunded: refundApplicationFee,
          transferReversed: reverseTransfer,
          transferReversalId,
          auditLogged: true,
          status: order.status,
        }
      }

      const terminalFailure =
        status === 'failed' || status === 'canceled'

      attempt.status = terminalFailure
        ? status === 'canceled'
          ? RefundAttemptStatus.CANCELED
          : RefundAttemptStatus.FAILED
        : RefundAttemptStatus.PENDING

      order.refundProcessed = false
      order.refundRequested = !terminalFailure
      order.refundFailureMessage = terminalFailure
        ? refund.failure_reason || `Stripe refund ${status}.`
        : null
      order.requiresOwnerAction = true
      order.issueResolved = false
      order.issueType = terminalFailure
        ? OwnerIssueType.REFUND_FAILED
        : OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
      order.ownerIssueType = terminalFailure
        ? OwnerIssueType.REFUND_FAILED
        : OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
      order.ownerIssueSeverity = terminalFailure
        ? OwnerIssueSeverity.CRITICAL
        : OwnerIssueSeverity.WARNING
      order.ownerActionMessage = terminalFailure
        ? `Stripe refund failed: ${
            refund.failure_reason || status
          }`
        : `Stripe refund ${refund.id} is ${status}. Do not create another refund while it is pending.`
      order.ownerActionCreatedAt =
        order.ownerActionCreatedAt || new Date()

      await attemptRepo.save(attempt)
      await orderRepo.save(order)

      return {
        success: false,
        pending: !terminalFailure,
        reconciliationRequired: !terminalFailure,
        message: order.ownerActionMessage,
        orderId: order.id,
        refundId: refund.id,
        refundAmount,
        refundDate,
        stripeRefundStatus: status,
        applicationFeeRefunded: refundApplicationFee,
        transferReversed: reverseTransfer,
        transferReversalId,
        auditLogged: true,
        status: order.status,
      }
    })
  }

  private async persistStripeCreateError(
    reserved: ReservedRefund,
    error: any,
    performedBy: string,
  ) {
    const uncertain = this.isUncertainStripeError(error)
    const errorMessage = String(
      error?.message || 'Stripe refund request failed.',
    ).slice(0, 2000)
    const errorCode = String(
      error?.code || error?.type || 'STRIPE_ERROR',
    ).slice(0, 255)

    await this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(RefundAttempt)
      const orderRepo = manager.getRepository(Order)

      const attempt = await attemptRepo.findOne({
        where: { id: reserved.attemptId },
      })

      const order = await orderRepo
        .createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', {
          orderId: reserved.orderId,
        })
        .getOne()

      if (attempt) {
        attempt.status = uncertain
          ? RefundAttemptStatus.RECONCILIATION_REQUIRED
          : RefundAttemptStatus.FAILED
        attempt.failureCode = errorCode
        attempt.failureMessage = errorMessage
        attempt.processedAt = new Date()
        attempt.stripeResponse = {
          type: error?.type || null,
          code: error?.code || null,
          requestId: error?.requestId || null,
          statusCode: error?.statusCode || null,
        }

        await attemptRepo.save(attempt)
      }

      if (order) {
        order.refundProcessed = false
        order.refundRequested = uncertain
        order.stripeRefundStatus = uncertain ? 'unknown' : 'failed'
        order.refundFailureMessage = errorMessage
        order.refundLastAttemptAt = new Date()
        order.requiresOwnerAction = true
        order.issueResolved = false
        order.issueType = uncertain
          ? OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
          : OwnerIssueType.REFUND_FAILED
        order.ownerIssueType = uncertain
          ? OwnerIssueType.REFUND_RECONCILIATION_REQUIRED
          : OwnerIssueType.REFUND_FAILED
        order.ownerIssueSeverity = OwnerIssueSeverity.CRITICAL
        order.ownerActionMessage = uncertain
          ? 'Stripe did not return a conclusive result. Check Stripe before retrying this refund.'
          : `Stripe refund failed: ${errorMessage}`
        order.ownerActionCreatedAt =
          order.ownerActionCreatedAt || new Date()
        order.ownerActionBy = performedBy
        order.ownerActionAt = new Date()

        await orderRepo.save(order)
      }
    })

    this.logger.error(
      `REFUND_CREATE_FAILED order=${reserved.orderId} attempt=${reserved.attemptId}`,
      error?.stack || errorMessage,
    )
  }

  private isUncertainStripeError(error: any) {
    return [
      'StripeAPIError',
      'StripeConnectionError',
      'StripeRateLimitError',
    ].includes(String(error?.type || ''))
  }
}