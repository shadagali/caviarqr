import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderQueue {
  constructor(
    @InjectQueue('order')
    private readonly orderQueue: Queue,
  ) {}

  async addOrderJob(data: any) {
    await this.orderQueue.add('new-order', data);
  }
}