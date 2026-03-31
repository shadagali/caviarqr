import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderWorker } from './order.worker';
import { OrderQueue } from './order.queue';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'order',
    }),
  ],
  providers: [
    OrderWorker,
    OrderQueue, // 🔥 THIS WAS MISSING
  ],
  exports: [
    OrderQueue, // 🔥 IMPORTANT (used in OrderService)
  ],
})
export class QueueModule {}