import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum SalesCommissionStatus {
  PENDING = 'PENDING',
  AVAILABLE = 'AVAILABLE',
  PAYOUT_PENDING = 'PAYOUT_PENDING',
  PAID = 'PAID',
  REVERSED = 'REVERSED',

  /*
   * The underlying transaction existed, but
   * the Sales Partner was not ACTIVE when the
   * commission eligibility decision was made.
   *
   * This row permanently prevents a later
   * account-status change from retroactively
   * creating commission for the old order.
   */
  INELIGIBLE = 'INELIGIBLE',
}

@Entity('sales_commission')
export class SalesCommission {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'integer',
  })
  salesPartnerId: number

  @Column({
    type: 'integer',
  })
  businessId: number

  @Column({
    type: 'integer',
    unique: true,
  })
  orderId: number

  @Column({
    type: 'integer',
  })
  platformFeeCents: number

  @Column({
    type: 'integer',
  })
  commissionBps: number

  /*
   * Exact commission accounting.
   *
   * commissionUnits =
   *   platformFeeCents * commissionBps
   *
   * 10,000 units = 1 cent.
   *
   * Stored as bigint/string so commission is never
   * rounded at the individual-order level.
   */
  @Column({
    type: 'bigint',
  })
  commissionUnits: string

  /*
   * Stable UTC month bucket for commission-cap
   * accounting. Prefer Stripe paidAt when known; the
   * order creation time is the durable fallback.
   */
  @Column({
    type: 'timestamptz',
  })
  earnedAt: Date

  /*
   * True only when the monthly cap reduced this
   * order's commission below the normal exact amount.
   */
  @Column({
    type: 'boolean',
    default: false,
  })
  capApplied: boolean

  @Column({
    type: 'varchar',
    length: 8,
    default: 'usd',
  })
  currency: string

  @Column({
    type: 'varchar',
    length: 32,
    default: SalesCommissionStatus.PENDING,
  })
  status: SalesCommissionStatus

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  availableAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  reversedAt: Date | null

  @Column({
    type: 'text',
    nullable: true,
  })
  reversalReason: string | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
