import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Business } from '../business/business.entity'

import type {
  Request,
} from 'express'

import {
  verifyOwnerToken,
} from '../owner-auth/owner-token'

import {
  verifyKitchenToken,
} from '../kitchen-auth/kitchen-token'

export type MenuAccessSession = {
  role: 'owner' | 'kitchen'
  businessId: number
  storeCode: string
}

export type MenuAccessRequest =
  Request & {
    menuAccess?: MenuAccessSession
  }

@Injectable()
export class MenuAccessGuard
  implements CanActivate
{
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ) {
    const request =
      context
        .switchToHttp()
        .getRequest<MenuAccessRequest>()

    const authorization =
      String(
        request.headers
          .authorization || '',
      ).trim()

    const match =
      /^Bearer\s+(.+)$/i.exec(
        authorization,
      )

    const token =
      match?.[1]?.trim() || ''

    if (!token) {
      throw new UnauthorizedException(
        'Cafe login required.',
      )
    }

    try {
      const owner =
        verifyOwnerToken(token)

      const business = await this.businesses.findOne({
        where: {
          id: owner.businessId,
          storeCode: owner.storeCode,
        },
      })

      if (!business || business.deletedAt) {
        throw new Error('Account closed')
      }

      request.menuAccess = {
        role: 'owner',
        businessId:
          owner.businessId,
        storeCode:
          owner.storeCode,
      }

      return true
    } catch {}

    try {
      const kitchen =
        verifyKitchenToken(token)

      const business = await this.businesses.findOne({
        where: {
          id: kitchen.businessId,
          storeCode: kitchen.storeCode,
        },
      })

      if (!business || business.deletedAt) {
        throw new Error('Account closed')
      }

      request.menuAccess = {
        role: 'kitchen',
        businessId:
          kitchen.businessId,
        storeCode:
          kitchen.storeCode,
      }

      return true
    } catch {}

    throw new UnauthorizedException(
      'Cafe session is invalid or expired.',
    )
  }
}
