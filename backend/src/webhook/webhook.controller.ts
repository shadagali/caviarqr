import {
  Controller,
  Post,
  Req,
  Headers,
} from '@nestjs/common'

import type {
  Request,
} from 'express'

import { WebhookService } from './webhook.service'

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
  ) {}

  @Post('stripe')
  async stripeWebhook(
    @Req()
    req: Request,

    @Headers(
      'stripe-signature',
    )
    signature: string,
  ) {
    return this.webhookService.handleStripeWebhook(
      signature,
      req.body,
    )
  }
}