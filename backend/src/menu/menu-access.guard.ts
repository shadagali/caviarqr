import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

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
  canActivate(
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
