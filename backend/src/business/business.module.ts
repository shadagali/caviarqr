import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Business } from './business.entity'
import { Order } from '../order/order.entity'

import { BusinessService } from './business.service'
import { BusinessController } from './business.controller'

import { StripeModule } from '../stripe/stripe.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Order]),

    forwardRef(() => StripeModule), // ✅ FIX (CRITICAL)
  ],
  providers: [BusinessService],
  controllers: [BusinessController],
  exports: [BusinessService],
})
export class BusinessModule {}