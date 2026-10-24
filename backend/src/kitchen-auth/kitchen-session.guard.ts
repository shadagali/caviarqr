import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { Request } from 'express'
import { Business } from '../business/business.entity'
import {
  bearerTokenFromHeader,
  kitchenSessionMatchesPassword,
  verifyKitchenToken,
} from './kitchen-token'
import type { KitchenSession } from './kitchen-token'

export type KitchenRequest = Request & {
  kitchen?: KitchenSession
}

@Injectable()
export class KitchenSessionGuard implements CanActivate {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp()
      .getRequest<KitchenRequest>()

    const token = bearerTokenFromHeader(
      request.headers.authorization,
    )

    if (!token) {
      throw new UnauthorizedException('Kitchen login required.')
    }

    try {
      const kitchen = verifyKitchenToken(token)

      const business = await this.businesses.findOne({
        where: {
          id: kitchen.businessId,
          storeCode: kitchen.storeCode,
        },
      })

      if (!business || business.deletedAt || !kitchenSessionMatchesPassword(
        kitchen,
        business.kitchenPassword,
      )) {
        throw new Error('Kitchen password changed.')
      }

      request.kitchen = kitchen
      return true
    } catch {
      throw new UnauthorizedException(
        'Kitchen session is invalid or expired.',
      )
    }
  }
}
