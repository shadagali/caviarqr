import { Controller, Post, Body } from '@nestjs/common'
import Stripe from 'stripe'

@Controller('stripe')
export class CheckoutController {

  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover'
  })

  @Post('checkout-session')
  async createSession(@Body() body: any) {

    const items = body.items || []

    const session = await this.stripe.checkout.sessions.create({

      payment_method_types: ['card'],

      mode: 'payment',

      line_items: items.map((i: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: i.name
          },
          unit_amount: Math.round(i.price * 100)
        },
        quantity: 1
      })),

      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',

      metadata: {
        businessId: body.businessId,
        tableNumber: body.tableNumber,
        items: JSON.stringify(items),
        totalAmount: body.amount
      }

    })

    return { url: session.url }

  }

}