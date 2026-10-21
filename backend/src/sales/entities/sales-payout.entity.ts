import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum SalesPayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

@Entity('sales_payout')
export class SalesPayout {
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
  amountCents: number

  @Column({
    type: 'varchar',
    length: 8,
    default: 'usd',
  })
  currency: string

  /*
   * Stripe destination snapshot for this payout.
   *
   * It is set exactly when a PENDING payout first
   * enters PROCESSING. Retries must continue using
   * this same connected account even if the Sales
   * Partner account record later changes.
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeDestinationAccountId: string | null

  @Column({
    type: 'varchar',
    length: 32,
    default: SalesPayoutStatus.PENDING,
  })
  status: SalesPayoutStatus

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeTransferId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  idempotencyKey: string

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  requestedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  paidAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  failedAt: Date | null

  @Column({
    type: 'text',
    nullable: true,
  })
  failureMessage: string | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
