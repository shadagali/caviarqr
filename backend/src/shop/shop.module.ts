import {
  Module,
} from '@nestjs/common'

import {
  TypeOrmModule,
} from '@nestjs/typeorm'

import {
  ShopProduct,
} from './shop-product.entity'

import {
  ShopOrder,
} from './shop-order.entity'

import {
  ShopOrderItem,
} from './shop-order-item.entity'

import {
  ShopController,
} from './shop.controller'

import {
  ShopService,
} from './shop.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopProduct,
      ShopOrder,
      ShopOrderItem,
    ]),
  ],

  controllers: [
    ShopController,
  ],

  providers: [
    ShopService,
  ],

  exports: [
    ShopService,
    TypeOrmModule,
  ],
})
export class ShopModule {}
