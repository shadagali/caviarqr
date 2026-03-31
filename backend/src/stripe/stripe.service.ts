import { Injectable } from '@nestjs/common'
import Stripe from 'stripe'

@Injectable()
export class StripeService {
  private stripe: Stripe

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }

  async createCheckoutSession(
    amount: number,
    storeCode: string,
    connectedAccountId: string,
    items: any[],
  ) {
    const platformFee = Math.round(amount * 0.0075 * 100)

    return this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',

      line_items: items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(Number(item.price) * 100),
        },
        quantity: item.qty,
      })),

      success_url: `http://localhost:3000/success`,
      cancel_url: `http://localhost:3000/store/${storeCode}`,

      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: connectedAccountId,
        },
      },
    })
  }

  // ✅ FIX 1 (for business.service)
  async createConnectedAccountPayout(accountId: string, amount: number) {
    return this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: accountId,
    })
  }

  // ✅ FIX 2 (for connect controller)
  async createConnectAccount(email: string) {
    return this.stripe.accounts.create({
      type: 'express',
      email,
    })
  }

  // ✅ FIX 3 (for onboarding)
  async generateOnboardingLink(accountId: string) {
    return this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'http://localhost:3000/owner',
      return_url: 'http://localhost:3000/owner',
      type: 'account_onboarding',
    })
  }
}