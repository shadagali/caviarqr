import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from './order.entity'
import { Business } from '../business/business.entity'
import { OrderService } from './order.service'
import { OrderController } from './order.controller'
import { OrderGateway } from './order.gateway'
import { OwnerSessionGuard } from '../owner-auth/owner-session.guard'
import { RefundModule } from '../refund/refund.module'

@Module({
  imports: [
    RefundModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
    ]),
  ],

  providers: [
    OrderService,
    OrderGateway,
    OwnerSessionGuard,
  ],

  controllers: [
    OrderController,
  ],

  exports: [
    OrderService,
    OrderGateway,
  ],
})
export class OrderModule {}