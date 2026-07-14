import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { PendingOrder } from '../pending-order/pending-order.entity'

import { OrderModule } from '../order/order.module'

@Module({
  imports: [
    OrderModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
      PendingOrder,
    ]),
  ],

  controllers: [
    WebhookController,
  ],

  providers: [
    WebhookService,
  ],
})
export class WebhookModule {}