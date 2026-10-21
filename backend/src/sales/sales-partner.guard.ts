import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import type {
  Request,
} from 'express'

import {
  Repository,
} from 'typeorm'

import {
  SalesPartner,
  SalesPartnerStatus,
} from './entities/sales-partner.entity'

import {
  salesPartnerBearerToken,
  verifySalesPartnerToken,
} from './sales-partner-token'

import type {
  SalesPartnerSession,
} from './sales-partner-token'

export type SalesPartnerRequest =
  Request & {
    salesPartnerSession?:
      SalesPartnerSession

    salesPartner?:
      SalesPartner
  }

@Injectable()
export class SalesPartnerGuard
  implements CanActivate
{
  constructor(
    @InjectRepository(
      SalesPartner,
    )
    private readonly partnerRepo:
      Repository<SalesPartner>,
  ) {}

  async canActivate(
    context:
      ExecutionContext,
  ) {
    const request =
      context
        .switchToHttp()
        .getRequest<
          SalesPartnerRequest
        >()

    const token =
      salesPartnerBearerToken(
        request.headers
          .authorization,
      )

    if (!token) {
      throw new UnauthorizedException(
        'Sales partner login required.',
      )
    }

    try {
      const session =
        verifySalesPartnerToken(
          token,
        )

      const partner =
        await this.partnerRepo
          .findOne({
            where: {
              id:
                session
                  .salesPartnerId,
            },
          })

      if (!partner) {
        throw new Error(
          'Sales partner not found.',
        )
      }

      /*
       * PENDING partners may access their
       * dashboard/onboarding.
       *
       * PAUSED partners may still log in
       * and see account/payout information.
       *
       * DISABLED partners lose access
       * immediately.
       */
      if (
        partner.status ===
        SalesPartnerStatus.DISABLED
      ) {
        throw new Error(
          'Sales partner disabled.',
        )
      }

      /*
       * Changing a referral code also
       * invalidates older sessions.
       */
      if (
        String(
          partner.referralCode ||
          '',
        )
          .trim()
          .toUpperCase() !==
        session.referralCode
      ) {
        throw new Error(
          'Sales partner session is stale.',
        )
      }

      request.salesPartnerSession =
        session

      request.salesPartner =
        partner

      return true
    } catch {
      throw new UnauthorizedException(
        'Sales partner session is invalid or expired.',
      )
    }
  }
}
