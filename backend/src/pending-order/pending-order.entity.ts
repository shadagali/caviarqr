import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import type {
  ValueTransformer,
} from 'typeorm'

export enum PendingOrderStatus {
  CREATED = 'CREATED',
  CHECKOUT_CREATED = 'CHECKOUT_CREATED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export type PendingOrderItem = {
  id: number
  name: string
  qty: number

  // Customer cooking / allergy request
  note?: string

  unitPriceCents: number
  price: number
}

const decimalNumberTransformer: ValueTransformer = {
  to: (
    value: number | null | undefined,
  ) => value,

  from: (
    value: string | number | null,
  ) => {
    if (value === null) {
      return null
    }

    return Number(value)
  },
}

@Index(
  'IDX_pending_order_business_created',
  ['businessId', 'createdAt'],
)
@Index(
  'IDX_pending_order_store_created',
  ['storeCode', 'createdAt'],
)
@Index(
  'IDX_pending_order_status_created',
  ['status', 'createdAt'],
)
@Index(
  'UQ_pending_order_checkout_request',
  ['checkoutRequestId'],
  {
    unique: true,
    where: '"checkoutRequestId" IS NOT NULL',
  },
)
@Index(
  'UQ_pending_order_stripe_session',
  ['stripeSessionId'],
  {
    unique: true,
    where: '"stripeSessionId" IS NOT NULL',
  },
)
@Index(
  'UQ_pending_order_payment_intent',
  ['stripePaymentIntentId'],
  {
    unique: true,
    where: '"stripePaymentIntentId" IS NOT NULL',
  },
)
@Entity()
export class PendingOrder {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'uuid',
    nullable: true,
  })
  checkoutRequestId: string | null

  @Column({
    type: 'int',
  })
  businessId: number

  @Column({
    type: 'varchar',
    length: 100,
  })
  storeCode: string

  @Column({
    type: 'int',
    default: 0,
  })
  tableNumber: number

  @Column({
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  items: PendingOrderItem[]

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  subtotal: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  serviceFeeAmount: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  platformFee: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  total: number

  @Column({
    type: 'varchar',
    length: 3,
    default: 'usd',
  })
  currency: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeSessionId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripePaymentIntentId: string | null

  @Column({
    type: 'enum',
    enum: PendingOrderStatus,
    enumName: 'pending_order_status_enum',
    default: PendingOrderStatus.CREATED,
  })
  status: PendingOrderStatus

  @Column({
    default: false,
  })
  issueCreated: boolean

  @Column({
    type: 'text',
    nullable: true,
  })
  failureReason: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  completedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt: Date | null

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date
}