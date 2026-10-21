import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { RefundAttempt } from './entities/refund-attempt.entity'
import { RefundController } from './refund.controller'
import { RefundService } from './refund.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Business,
      RefundAttempt,
    ]),
  ],
  controllers: [RefundController],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}