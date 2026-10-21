import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common'

import {
  ShopService,
} from './shop.service'

@Controller('shop')
export class ShopController {
  constructor(
    private readonly shopService:
      ShopService,
  ) {}

  @Get('products')
  async products() {
    return this.shopService
      .getPublicProducts()
  }

  @Post('checkout')
  async checkout(
    @Body()
    body: {
      items?: {
        productId: number
        quantity: number
      }[]

      salesCode?: string
    },
  ) {
    return this.shopService
      .createCheckout(body)
  }
}
