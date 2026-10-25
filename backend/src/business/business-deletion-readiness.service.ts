import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'

import { Business } from './business.entity'
import { Order, OrderStatus } from '../order/order.entity'
import {
  PendingOrder,
  PendingOrderStatus,
} from '../pending-order/pending-order.entity'
import {
  RefundAttempt,
  RefundAttemptStatus,
} from '../refund/entities/refund-attempt.entity'
import {
  SupportThread,
  SupportThreadStatus,
} from '../support/support-thread.entity'
import {
  MarketingCampaign,
  MarketingCampaignStatus,
} from '../marketing/marketing-campaign.entity'
import { StandCode } from '../stand/stand-code.entity'
import {
  SalesCommission,
  SalesCommissionStatus,
} from '../sales/entities/sales-commission.entity'

@Injectable()
export class BusinessDeletionReadinessService {
  constructor(private readonly db: DataSource) {}

  async check(
    businessId: number,
    storeCode: string,
    body: { password?: unknown; storeCode?: unknown },
  ) {
    const password =
      typeof body?.password === 'string' ? body.password : ''
    const enteredCode =
      typeof body?.storeCode === 'string'
        ? body.storeCode.trim()
        : ''

    if (!password || enteredCode !== storeCode) {
      throw new ForbiddenException(
        'Enter your password and exact store code.',
      )
    }

    const business = await this.db.getRepository(Business).findOne({
      where: { id: businessId, storeCode },
    })

    if (!business || business.deletedAt) {
      throw new NotFoundException('Restaurant account not found.')
    }

    if (!(await bcrypt.compare(password, business.password))) {
      throw new UnauthorizedException('Incorrect password.')
    }

    const [
      unresolvedOrders,
      openCheckouts,
      pendingRefunds,
      activeSupport,
      campaignsSending,
      unsettledSalesCommissions,
      claimedStandCodes,
      historicalOrders,
    ] = await Promise.all([
      this.db.getRepository(Order)
        .createQueryBuilder('o')
        .where('o.businessId = :businessId', { businessId })
        .andWhere(
          `(o.status NOT IN (:...closed)
            OR (o.refundRequested = TRUE AND o.refundProcessed = FALSE)
            OR (o.requiresOwnerAction = TRUE AND o.issueResolved = FALSE))`,
          { closed: [OrderStatus.DONE, OrderStatus.REFUNDED] },
        )
        .getCount(),

      this.db.getRepository(PendingOrder)
        .createQueryBuilder('p')
        .where('p.businessId = :businessId', { businessId })
        .andWhere('p.status IN (:...statuses)', {
          statuses: [
            PendingOrderStatus.CREATED,
            PendingOrderStatus.CHECKOUT_CREATED,
          ],
        })
        // Do not exclude expired sessions. Stripe webhooks can arrive
        // after expiry and still need reconciliation against the
        // ORIGINAL businessId before a store code can be reused.
        .getCount(),

      this.db.getRepository(RefundAttempt)
        .createQueryBuilder('r')
        .innerJoin(Order, 'o', 'o.id = r.orderId')
        .where('o.businessId = :businessId', { businessId })
        .andWhere('r.status IN (:...statuses)', {
          statuses: [
            RefundAttemptStatus.REQUESTED,
            RefundAttemptStatus.PROCESSING,
            RefundAttemptStatus.PENDING,
            RefundAttemptStatus.RECONCILIATION_REQUIRED,
          ],
        })
        .getCount(),

      this.db.getRepository(SupportThread).count({
        where: [
          {
            businessId,
            status: SupportThreadStatus.AWAITING_RESTAURANT,
          },
          {
            businessId,
            status: SupportThreadStatus.AWAITING_CUSTOMER,
          },
        ],
      }),

      this.db.getRepository(MarketingCampaign).count({
        where: {
          businessId,
          status: MarketingCampaignStatus.SENDING,
        },
      }),

      // Commissions may still be owed even if every order is DONE.
      this.db.getRepository(SalesCommission)
        .createQueryBuilder('commission')
        .where('commission.businessId = :businessId', { businessId })
        .andWhere('commission.status IN (:...statuses)', {
          statuses: [
            SalesCommissionStatus.PENDING,
            SalesCommissionStatus.AVAILABLE,
            SalesCommissionStatus.PAYOUT_PENDING,
          ],
        })
        .getCount(),

      // Hardware stands can remain claimed to the old business.
      // NEVER release them merely because a store code is known.
      this.db.getRepository(StandCode).count({
        where: { claimedBusinessId: businessId },
      }),

      // This is retained history, not itself a reason to refuse
      // account closure. It must remain linked to businessId.
      this.db.getRepository(Order).count({ where: { businessId } }),
    ])

    return {
      checked: true,
      deletionPerformed: false,
      canDeleteNow: false,
      requiresStripeAndOwnershipReview: true,
      // There is no safe automated Stripe settlement verification yet.
      // A connected account must be reviewed independently in Stripe.
      hasConnectedStripeAccount: Boolean(business.stripeAccountId),
      storeCodeReclaimAuthorized: false,
      counts: {
        unresolvedOrders,
        openCheckouts,
        pendingRefunds,
        activeSupport,
        campaignsSending,
        unsettledSalesCommissions,
        claimedStandCodes,
        historicalOrders,
      },
      message:
        'Readiness check only. Account deletion is not enabled.',
    }
  }
}
