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
  bearerTokenFromHeader,
  verifyKitchenToken,
} from './kitchen-token'

import type {
  KitchenSession,
} from './kitchen-token'

export type KitchenRequest =
  Request & {
    kitchen?: KitchenSession
  }

@Injectable()
export class KitchenSessionGuard
  implements CanActivate
{
  canActivate(
    context: ExecutionContext,
  ) {
    const request =
      context
        .switchToHttp()
        .getRequest<KitchenRequest>()

    const token =
      bearerTokenFromHeader(
        request.headers
          .authorization,
      )

    if (!token) {
      throw new UnauthorizedException(
        'Kitchen login required.',
      )
    }

    try {
      request.kitchen =
        verifyKitchenToken(token)

      return true
    } catch {
      throw new UnauthorizedException(
        'Kitchen session is invalid or expired.',
      )
    }
  }
}