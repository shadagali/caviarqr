import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { StandModule } from '../stand/stand.module'
import { OrderModule } from '../order/order.module'
import { JwtModule } from '@nestjs/jwt'

import { Business } from './business.entity'

import {
  BusinessLegalAcceptance,
} from './business-legal-acceptance.entity'
import { BusinessService } from './business.service'
import { BusinessController } from './business.controller'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

@Module({
  imports: [
    StandModule,
    OrderModule,
    TypeOrmModule.forFeature([
      Business,
      BusinessLegalAcceptance,
    ]),

    // 🔥 JWT (GLOBAL SAFE CONFIG)
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'supersecret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    BusinessService,
    OwnerSessionGuard,
  ],
  controllers: [BusinessController],

  // 🔥 EXPORT JWT + SERVICE (IMPORTANT)
  exports: [BusinessService, JwtModule],
})
export class BusinessModule {}