import {
  Module,
} from '@nestjs/common'

import {
  TypeOrmModule,
} from '@nestjs/typeorm'

import {
  Business,
} from '../business/business.entity'

import {
  MenuItem,
} from '../menu/menu.entity'

import {
  PendingOrder,
} from '../pending-order/pending-order.entity'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import {
  StripeController,
} from './stripe.controller'

import {
  StripeService,
} from './stripe.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      MenuItem,
      PendingOrder,
    ]),
  ],

  providers: [
    StripeService,
    OwnerSessionGuard,
  ],

  controllers: [
    StripeController,
  ],

  exports: [
    StripeService,
  ],
})
export class StripeModule {}