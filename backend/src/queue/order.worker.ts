import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('order') // 🔥 MUST MATCH
export class OrderWorker extends WorkerHost {
  async process(job: Job<any>) {
    console.log('🔥 PROCESSING ORDER:', job.data);
  }
}