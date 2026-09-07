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
  canActivate(
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
      request.owner =
        verifyOwnerToken(
          token,
        )

      return true
    } catch {
      throw new UnauthorizedException(
        'Owner session is invalid or expired.',
      )
    }
  }
}
