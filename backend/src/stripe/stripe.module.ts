import { Module, forwardRef } from '@nestjs/common'
import { StripeService } from './stripe.service'
import { StripeController } from './stripe.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Business } from '../business/business.entity'
import { OrderModule } from '../order/order.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),
    forwardRef(() => OrderModule),
  ],
  providers: [StripeService],
  controllers: [StripeController], // ✅ ADD THIS
  exports: [StripeService],
})
export class StripeModule {}