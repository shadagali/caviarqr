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

export enum OwnerIssueType {
  WEBHOOK_PARSE_FAILED =
    'WEBHOOK_PARSE_FAILED',

  STORE_CODE_MISSING =
    'STORE_CODE_MISSING',

  BUSINESS_NOT_FOUND =
    'BUSINESS_NOT_FOUND',

  DATABASE_SAVE_FAILED =
    'DATABASE_SAVE_FAILED',

  SOCKET_EMIT_FAILED =
    'SOCKET_EMIT_FAILED',

  KITCHEN_OFFLINE =
    'KITCHEN_OFFLINE',

  KITCHEN_ACK_TIMEOUT =
    'KITCHEN_ACK_TIMEOUT',

  INVALID_ORDER_DATA =
    'INVALID_ORDER_DATA',

  ORDER_STUCK_NEW =
    'ORDER_STUCK_NEW',

  DUPLICATE_PAYMENT =
    'DUPLICATE_PAYMENT',

  REFUND_FAILED =
    'REFUND_FAILED',

  UNKNOWN =
    'UNKNOWN',
}

export enum OwnerIssueSeverity {
  INFO = 'INFO',

  WARNING =
    'WARNING',

  CRITICAL =
    'CRITICAL',
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
    type: 'varchar',
    nullable: true,
  })
  storeCode: string | null

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
  // CUSTOMER
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  customerEmail: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  customerName: string | null

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
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  stripePaymentIntentId: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  stripeSessionId: string | null

  // =========================
  // ACTION CENTER
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  issueType: string | null

  @Column({
    default: false,
  })
  issueResolved: boolean

  // =========================
  // OWNER ACTION
  // =========================

  @Column({
    default: false,
  })
  requiresOwnerAction: boolean

  @Column({
    type: 'enum',
    enum: OwnerIssueType,
    nullable: true,
  })
  ownerIssueType: OwnerIssueType | null

  @Column({
    type: 'enum',
    enum: OwnerIssueSeverity,
    nullable: true,
  })
  ownerIssueSeverity: OwnerIssueSeverity | null

  @Column({
    type: 'text',
    nullable: true,
  })
  ownerActionMessage: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  ownerActionId: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  ownerActionResolvedBy: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  ownerActionResolvedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  ownerActionCreatedAt: Date | null

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