import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common'

import type {
  RawBodyRequest,
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
    req: RawBodyRequest<Request>,

    @Headers('stripe-signature')
    signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException(
        'Missing Stripe signature',
      )
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Missing Stripe raw request body',
      )
    }

    return this.webhookService.handleStripeWebhook(
      signature,
      req.rawBody,
    )
  }
}