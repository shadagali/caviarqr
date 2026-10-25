import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { DataSource } from 'typeorm'

import { Business } from './business.entity'

/**
 * NOT a deletion endpoint. This is a deliberately isolated, rollback-only
 * integration rehearsal. It is not registered in BusinessModule and cannot
 * be called through HTTP.
 *
 * A separate, reviewed production workflow must validate Stripe balances,
 * outstanding disputes, owner authority, data retention and QR ownership.
 */
type RehearsalResult = {
  businessId: number
  eligible: boolean
  closureCommitted: false
  reason: string
  blockers?: Record<string, number | boolean>
}

class IntentionalTestRollback extends Error {
  constructor(public readonly result: RehearsalResult) {
    super('Intentional rollback of account-closure rehearsal')
  }
}

@Injectable()
export class BusinessAccountClosureRehearsalService {
  constructor(private readonly db: DataSource) {}

  async rehearse(
    businessId: number,
    input: {
      password?: unknown
      storeCode?: unknown
      confirmation?: unknown
    },
  ): Promise<RehearsalResult> {
    // NEVER loosen this guard or treat a connection to the simulation's
    // default database as an acceptable substitute.
    if (!Number.isSafeInteger(businessId) || businessId <= 0) {
      throw new ForbiddenException('Invalid test restaurant ID.')
    }

    try {
      return await this.db.transaction('SERIALIZABLE', async (manager) => {
        const [identity] = await manager.query(
          'SELECT current_database() AS dbname, current_user AS dbuser',
        )
        if (
          identity?.dbname !== 'caviarqr_deletion_test_20261025' ||
          identity?.dbuser !== 'simuser'
        ) {
          throw new ForbiddenException(
            'Account closure rehearsal is restricted to the isolated test DB.',
          )
        }

        const business = await manager
          .getRepository(Business)
          .createQueryBuilder('b')
          .setLock('pessimistic_write')
          .where('b.id = :businessId', { businessId })
          .getOne()

        if (!business || business.deletedAt) {
          throw new NotFoundException('Active test restaurant not found.')
        }
        if (
          input?.storeCode !== business.storeCode ||
          input?.confirmation !== 'DELETE' ||
          typeof input?.password !== 'string' ||
          !input.password
        ) {
          throw new ForbiddenException(
            'Exact store code, password and DELETE confirmation are required.',
          )
        }
        if (!(await bcrypt.compare(input.password, business.password))) {
          throw new UnauthorizedException('Incorrect test restaurant password.')
        }

        // Business row is locked during these checks. Before production use,
        // EVERY order/checkout writer must also lock the same row to prevent
        // time-of-check/time-of-use races; this is not true of every writer yet.
        const [counts] = await manager.query(
          `SELECT
             (SELECT count(*)::int FROM public.pending_order p
              WHERE p."businessId"=$1
                AND p.status IN ('CREATED','CHECKOUT_CREATED')) AS "openCheckouts",
             (SELECT count(*)::int FROM public."order" o
              WHERE o."businessId"=$1 AND (
                o.status NOT IN ('DONE','REFUNDED') OR
                (o."refundRequested" AND NOT o."refundProcessed") OR
                (o."requiresOwnerAction" AND NOT o."issueResolved")
              )) AS "unresolvedOrders",
             (SELECT count(*)::int FROM public.refund_attempt r
              JOIN public."order" o ON o.id=r."orderId"
              WHERE o."businessId"=$1 AND r.status IN
                ('REQUESTED','PROCESSING','PENDING','RECONCILIATION_REQUIRED'))
               AS "pendingRefunds",
             (SELECT count(*)::int FROM public.support_thread t
              WHERE t."businessId"=$1 AND t.status IN
                ('AWAITING_RESTAURANT','AWAITING_CUSTOMER')) AS "activeSupport",
             (SELECT count(*)::int FROM public.marketing_campaign m
              WHERE m."businessId"=$1 AND m.status='SENDING') AS "campaignsSending",
             (SELECT count(*)::int FROM public.sales_commission c
              WHERE c."businessId"=$1 AND c.status IN
                ('PENDING','AVAILABLE','PAYOUT_PENDING')) AS "unsettledCommissions",
             (SELECT count(*)::int FROM public.stand_code s
              WHERE s."claimedBusinessId"=$1) AS "claimedStands"`,
          [businessId],
        )

        const blockers: Record<string, number | boolean> = {
          connectedStripeAccount: Boolean(business.stripeAccountId),
          openCheckouts: Number(counts.openCheckouts),
          unresolvedOrders: Number(counts.unresolvedOrders),
          pendingRefunds: Number(counts.pendingRefunds),
          activeSupport: Number(counts.activeSupport),
          campaignsSending: Number(counts.campaignsSending),
          unsettledCommissions: Number(counts.unsettledCommissions),
          claimedStands: Number(counts.claimedStands),
        }

        if (Object.values(blockers).some((value) => Boolean(value))) {
          return {
            businessId,
            eligible: false,
            closureCommitted: false as const,
            reason: 'Closure blocked by outstanding obligations.',
            blockers,
          }
        }

        // These test writes must NEVER commit. The business row and its ID
        // remain present so historical payment and legal links are retained.
        await manager.query(
          `UPDATE public.business SET
             "deletedAt" = now(), "isOpen" = false,
             "emailMarketingEnabled" = false,
             "resetToken" = NULL, "kitchenPassword" = NULL
           WHERE id=$1 AND "deletedAt" IS NULL`,
          [businessId],
        )
        // Demonstrate tenant-scoped removal of synthetic menu data only.
        // Production privacy/retention rules are not implemented here.
        await manager.query(
          'DELETE FROM public.menu_item WHERE "businessId"=$1',
          [businessId],
        )

        const [check] = await manager.query(
          `SELECT
             (SELECT count(*)::int FROM public.business b
              WHERE b.id=$1 AND b."deletedAt" IS NOT NULL AND NOT b."isOpen")
               AS closed,
             (SELECT count(*)::int FROM public.menu_item m
              WHERE m."businessId"=$1) AS menusLeft,
             (SELECT count(*)::int FROM public.business) AS businessesLeft`,
          [businessId],
        )
        if (
          check.closed !== 1 ||
          check.menusleft !== 0 ||
          check.businessesleft !== 2
        ) {
          throw new Error('Isolated closure invariants failed.')
        }

        // Intentional exception forces TypeORM to ROLLBACK, not COMMIT.
        throw new IntentionalTestRollback({
          businessId,
          eligible: true,
          closureCommitted: false,
          reason: 'Closure transaction validated, then rolled back.',
          blockers,
        })
      })
    } catch (error) {
      if (error instanceof IntentionalTestRollback) return error.result
      throw error
    }
  }
}
