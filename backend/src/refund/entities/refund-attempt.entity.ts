import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum RefundAttemptStatus {
  REQUESTED = 'REQUESTED',
  PROCESSING = 'PROCESSING',
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  RECONCILIATION_REQUIRED =
    'RECONCILIATION_REQUIRED',
}

@Entity('refund_attempt')
@Index(
  'IDX_refund_attempt_order_status',
  [
    'orderId',
    'status',
  ],
)
@Index(
  'UQ_refund_attempt_idempotency_key',
  [
    'idempotencyKey',
  ],
  {
    unique: true,
  },
)
@Index(
  'UQ_refund_attempt_stripe_refund_id',
  [
    'stripeRefundId',
  ],
  {
    unique: true,
    where:
      '"stripeRefundId" IS NOT NULL',
  },
)
export class RefundAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({
    type: 'integer',
  })
  orderId: number

  @Column({
    type: 'varchar',
    length: 255,
  })
  stripePaymentIntentId: string

  @Column({
    type: 'varchar',
    length: 255,
  })
  idempotencyKey: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeRefundId: string | null

  @Column({
    type: 'integer',
  })
  amountCents: number

  @Column({
    type: 'varchar',
    length: 3,
    default: 'usd',
  })
  currency: string

  @Column({
    type: 'varchar',
    length: 64,
  })
  reason: string

  @Column({
    type: 'text',
    nullable: true,
  })
  note: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  requestedBy: string | null

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  requestIp: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  userAgent: string | null

  @Column({
    type: 'enum',
    enum:
      RefundAttemptStatus,
    enumName:
      'refund_attempt_status_enum',
    default:
      RefundAttemptStatus.REQUESTED,
  })
  status: RefundAttemptStatus

  @Column({
    type: 'boolean',
    default: false,
  })
  reverseTransfer: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  refundApplicationFee: boolean

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  failureCode: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  failureMessage: string | null

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  stripeResponse:
    Record<string, unknown> | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  processedAt: Date | null

  @CreateDateColumn({
    type: 'timestamptz',
    default:
      () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
    default:
      () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date
}