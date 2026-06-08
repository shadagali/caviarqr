import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'
import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { OrderGateway } from '../order/order.gateway'

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Business]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService, OrderGateway],
})
export class WebhookModule {}