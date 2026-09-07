import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { WebhookService } from './webhook.service'
import { WebhookController } from './webhook.controller'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { PendingOrder } from '../pending-order/pending-order.entity'
import { SupportThread } from '../support/support-thread.entity'

import { OrderModule } from '../order/order.module'
import { MarketingModule } from '../marketing/marketing.module'
import { ShopModule } from '../shop/shop.module'

@Module({
  imports: [
    OrderModule,
    MarketingModule,
    ShopModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
      PendingOrder,
      SupportThread,
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