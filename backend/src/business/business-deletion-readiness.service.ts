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
        .andWhere('(p.expiresAt IS NULL OR p.expiresAt > :now)', {
          now: new Date(),
        })
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
    ])

    return {
      checked: true,
      deletionPerformed: false,
      canDeleteNow: false,
      requiresStripeAndOwnershipReview: true,
      counts: {
        unresolvedOrders,
        openCheckouts,
        pendingRefunds,
        activeSupport,
        campaignsSending,
      },
      message:
        'Readiness check only. Account deletion is not enabled.',
    }
  }
}
