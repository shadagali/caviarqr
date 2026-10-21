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
  Order,
} from '../order/order.entity'

import {
  OrderModule,
} from '../order/order.module'

import {
  RefundModule,
} from '../refund/refund.module'

import {
  KitchenAuthController,
} from './kitchen-auth.controller'

import {
  KitchenSessionGuard,
} from './kitchen-session.guard'

@Module({
  imports: [
    OrderModule,
    RefundModule,

    TypeOrmModule.forFeature([
      Business,
      Order,
    ]),
  ],

  controllers: [
    KitchenAuthController,
  ],

  providers: [
    KitchenSessionGuard,
  ],

  exports: [
    KitchenSessionGuard,
  ],
})
export class KitchenAuthModule {}
