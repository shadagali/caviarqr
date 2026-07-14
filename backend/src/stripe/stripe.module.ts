import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { StripeService } from './stripe.service'
import { StripeController } from './stripe.controller'

import { Business } from '../business/business.entity'
import { PendingOrder } from '../pending-order/pending-order.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      PendingOrder,
    ]),
  ],

  providers: [
    StripeService,
  ],

  controllers: [
    StripeController,
  ],

  exports: [
    StripeService,
  ],
})
export class StripeModule {}