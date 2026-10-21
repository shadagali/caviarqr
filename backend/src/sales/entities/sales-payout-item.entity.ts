import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('sales_payout_item')
export class SalesPayoutItem {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'bigint',
  })
  salesPayoutId: string

  @Column({
    type: 'bigint',
  })
  salesCommissionId: string

  /*
   * Exact commission units consumed by this payout.
   *
   * 10,000 units = 1 cent.
   *
   * A single commission may therefore appear in more
   * than one payout over time until all of its units
   * have been consumed.
   */
  @Column({
    type: 'bigint',
  })
  amountUnits: string

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date
}
