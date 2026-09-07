import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('platform_payout')
@Index(
  'IDX_platform_payout_created',
  ['createdAt'],
)
export class PlatformPayout {
  @PrimaryGeneratedColumn()
  id: number

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

  @Column({
    type: 'varchar',
    length: 32,
    default: 'CREATING',
  })
  status: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripePayoutId:
    | string
    | null

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  idempotencyKey: string

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  requestedBy:
    | string
    | null

  @Column({
    type: 'text',
    nullable: true,
  })
  failureMessage:
    | string
    | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
