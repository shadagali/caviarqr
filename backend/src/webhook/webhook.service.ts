import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { OrderService } from '../order/order.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });

  constructor(private orderService: OrderService) {}

  async handleStripeWebhook(sig: string, rawBody: Buffer) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      this.logger.error('Invalid signature', err);
      throw new Error('Invalid signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      await this.orderService.markOrderPaid(paymentIntent.id);
    }

    return { received: true };
  }
}