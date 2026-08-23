import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum StripeWebhookEventStatus {
  RECEIVED = 'RECEIVED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

@Entity('stripe_webhook_event')
export class StripeWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index({ unique: true })
  @Column()
  stripeEventId: string

  @Index()
  @Column()
  eventType: string

  @Index()
  @Column({
    type: 'enum',
    enum: StripeWebhookEventStatus,
    default: StripeWebhookEventStatus.RECEIVED,
  })
  status: StripeWebhookEventStatus

  @Column({
    type: 'jsonb',
  })
  payload: Record<string, unknown>

  @Column({
    type: 'integer',
    default: 0,
  })
  attempts: number

  @Column({
    type: 'text',
    nullable: true,
  })
  lastError: string | null

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  processedAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}