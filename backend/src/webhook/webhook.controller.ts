import {
  Controller,
  Post,
  Req,
  Headers,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhook/stripe')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post()
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const rawBody = (req as any).rawBody;

      const result = await this.webhookService.handleStripeWebhook(
        signature,
        rawBody,
      );

      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
}