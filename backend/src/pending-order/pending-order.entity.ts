import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum PendingOrderStatus {
  CREATED = 'CREATED',

  CHECKOUT_CREATED =
    'CHECKOUT_CREATED',

  COMPLETED = 'COMPLETED',

  FAILED = 'FAILED',

  EXPIRED = 'EXPIRED',
}

@Entity()
export class PendingOrder {
  @PrimaryGeneratedColumn()
  id: number

  // =========================
  // BUSINESS
  // =========================

  @Column()
  businessId: number

  @Column({
    type: 'varchar',
  })
  storeCode: string

  // =========================
  // ORDER DATA
  // =========================

  @Column({
    type: 'int',
    default: 0,
  })
  tableNumber: number

  @Column({
    type: 'json',
  })
  items: any

  @Column({
    type: 'float',
    default: 0,
  })
  subtotal: number

  @Column({
    type: 'float',
    default: 0,
  })
  serviceFeeAmount: number

  @Column({
    type: 'float',
    default: 0,
  })
  total: number

  // =========================
  // STRIPE
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  stripeSessionId: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  stripePaymentIntentId: string | null

  // =========================
  // STATUS
  // =========================

  @Column({
    type: 'enum',
    enum: PendingOrderStatus,
    default:
      PendingOrderStatus.CREATED,
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

  // =========================
  // CREATED / UPDATED
  // =========================

  @CreateDateColumn({
    type: 'timestamptz',
    default: () =>
      'CURRENT_TIMESTAMP',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  updatedAt: Date
}