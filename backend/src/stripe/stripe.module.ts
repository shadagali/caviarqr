import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StripeService } from './stripe.service'
import { StripeController } from './stripe.controller'
import { Business } from '../business/business.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),
  ],
  providers: [StripeService],
  controllers: [StripeController],
})
export class StripeModule {}