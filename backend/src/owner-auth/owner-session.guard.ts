import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import type {
  Request,
} from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Business } from '../business/business.entity'

import {
  ownerBearerToken,
  verifyOwnerToken,
} from './owner-token'

import type {
  OwnerSession,
} from './owner-token'

export type OwnerRequest =
  Request & {
    owner?: OwnerSession
  }

@Injectable()
export class OwnerSessionGuard
  implements CanActivate
{
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  async canActivate(
    context:
      ExecutionContext,
  ) {
    const request =
      context
        .switchToHttp()
        .getRequest<OwnerRequest>()

    const token =
      ownerBearerToken(
        request.headers
          .authorization,
      )

    if (!token) {
      throw new UnauthorizedException(
        'Owner login required.',
      )
    }

    try {
      const owner = verifyOwnerToken(token)
      const business = await this.businesses.findOne({
        where: {
          id: owner.businessId,
          storeCode: owner.storeCode,
        },
      })

      if (!business || business.deletedAt) {
        throw new Error('Account closed or session revoked')
      }

      request.owner = owner
      return true
    } catch {
      throw new UnauthorizedException(
        'Owner session is invalid or expired.',
      )
    }
  }
}
