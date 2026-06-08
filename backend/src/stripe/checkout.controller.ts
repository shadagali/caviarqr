import { Controller, Post } from '@nestjs/common'

@Controller('stripe')
export class StripeController {

  @Post('checkout')
  async checkout() {
    return {
      success: true,

      // ✅ PASTE YOUR STRIPE PAYMENT LINK HERE
      url: 'https://buy.stripe.com/test_REPLACE_THIS',
    }
  }
}