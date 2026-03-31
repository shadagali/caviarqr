import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { OrderModule } from '../order/order.module'; // ✅ ADD THIS

@Module({
  imports: [
    OrderModule, // ✅ CRITICAL FIX
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}