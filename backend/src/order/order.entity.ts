import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm'

export enum OrderStatus {
  PENDING_PAYMENT =
    'PENDING_PAYMENT',

  NEW = 'NEW',

  PREPARING =
    'PREPARING',

  READY = 'READY',

  DONE = 'DONE',

  REFUNDED =
    'REFUNDED',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number

  // =========================
  // BUSINESS
  // =========================

  @Column()
  businessId: number

  @Column({
    nullable: true,
  })
  storeCode: string

  // =========================
  // ITEMS
  // =========================

  @Column({
    type: 'json',
  })
  items: any

  // =========================
  // TOTALS
  // =========================

  @Column({
    type: 'float',
    default: 0,
  })
  total: number

  @Column({
    type: 'float',
    default: 0,
  })
  platformFee: number

  // =========================
  // TABLE
  // =========================

  @Column({
    nullable: true,
    default: 0,
  })
  tableNumber?: number

  // =========================
  // STATUS
  // =========================

  @Column({
    type: 'enum',
    enum: OrderStatus,

    default:
      OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus

  // =========================
  // STRIPE
  // =========================

  @Column({
    unique: true,
    nullable: true,
  })
  stripePaymentIntentId: string

  // =========================
  // CREATED
  // =========================

  @CreateDateColumn({
    type: 'timestamptz',

    default: () =>
      'CURRENT_TIMESTAMP',
  })
  createdAt: Date
}