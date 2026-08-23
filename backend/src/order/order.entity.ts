import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm'

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  NEW = 'NEW',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DONE = 'DONE',
  REFUNDED = 'REFUNDED',
}

export enum OwnerIssueType {
  WEBHOOK_PARSE_FAILED = 'WEBHOOK_PARSE_FAILED',
  STORE_CODE_MISSING = 'STORE_CODE_MISSING',
  BUSINESS_NOT_FOUND = 'BUSINESS_NOT_FOUND',
  DATABASE_SAVE_FAILED = 'DATABASE_SAVE_FAILED',
  SOCKET_EMIT_FAILED = 'SOCKET_EMIT_FAILED',
  KITCHEN_OFFLINE = 'KITCHEN_OFFLINE',
  KITCHEN_ACK_TIMEOUT = 'KITCHEN_ACK_TIMEOUT',
  WEBHOOK_TIMEOUT = 'WEBHOOK_TIMEOUT',
  INVALID_ORDER_DATA = 'INVALID_ORDER_DATA',
  ORDER_STUCK_NEW = 'ORDER_STUCK_NEW',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  REFUND_FAILED = 'REFUND_FAILED',
  REFUND_RECONCILIATION_REQUIRED =
    'REFUND_RECONCILIATION_REQUIRED',
  CUSTOMER_SUPPORT_REQUEST =
    'CUSTOMER_SUPPORT_REQUEST',
  UNKNOWN = 'UNKNOWN',
}

export enum OwnerIssueSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export type OrderItem = {
  id?: string | number
  name: string
  qty: number
  price: number
  note?: string
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
  'IDX_order_business_created',
  ['businessId', 'createdAt'],
)
@Index(
  'IDX_order_store_created',
  ['storeCode', 'createdAt'],
)
@Index(
  'IDX_order_status_created',
  ['status', 'createdAt'],
)
@Index(
  'IDX_order_action_queue',
  [
    'requiresOwnerAction',
    'issueResolved',
    'ownerIssueSeverity',
    'ownerActionCreatedAt',
  ],
)
@Index(
  'IDX_order_refund_state',
  [
    'refundRequested',
    'refundProcessed',
    'stripeRefundStatus',
    'refundLastAttemptAt',
  ],
)
@Index(
  'UQ_order_payment_intent',
  ['stripePaymentIntentId'],
  {
    unique: true,
    where:
      '"stripePaymentIntentId" IS NOT NULL',
  },
)
@Index(
  'UQ_order_checkout_session',
  ['stripeSessionId'],
  {
    unique: true,
    where:
      '"stripeSessionId" IS NOT NULL',
  },
)
@Index(
  'UQ_order_refund',
  ['refundId'],
  {
    unique: true,
    where:
      '"refundId" IS NOT NULL',
  },
)
@Index(
  'UQ_order_owner_action_id',
  ['ownerActionId'],
  {
    unique: true,
    where:
      '"ownerActionId" IS NOT NULL',
  },
)
@Index(
  'UQ_order_support_thread',
  ['supportThreadId'],
  {
    unique: true,
    where:
      '"supportThreadId" IS NOT NULL',
  },
)
@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  businessId: number

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  storeCode: string | null

  @Column({
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  items: OrderItem[]

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  total: number

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalNumberTransformer,
  })
  platformFee: number

  @Column({
    type: 'varchar',
    length: 3,
    default: 'usd',
  })
  currency: string

  @Column({
    type: 'int',
    nullable: true,
  })
  tableNumber: number | null

  @Column({
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  customerEmail: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customerName: string | null

  @Column({
    type: 'uuid',
    nullable: true,
  })
  supportThreadId: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  receiptEmailSentAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  receiptEmailLastAttemptAt: Date | null

  @Column({
    type: 'int',
    default: 0,
  })
  receiptEmailAttempts: number

  @Column({
    type: 'text',
    nullable: true,
  })
  receiptEmailFailureMessage: string | null

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status_enum',
    default: OrderStatus.PENDING_PAYMENT,
  })
  status: OrderStatus

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastStatusAt: Date | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripePaymentIntentId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeSessionId: string | null

  @Index()
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeChargeId: string | null

  @Index()
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeBalanceTransactionId: string | null

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  stripeFee: number | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeTransferId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  stripeApplicationFeeId: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  paidAt: Date | null

  @Column({ default: false })
  kitchenAcknowledged: boolean

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  kitchenAcknowledgedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastKitchenAckAt: Date | null

  @Column({
    type: 'int',
    default: 0,
  })
  acknowledgementRetries: number

  @Column({
    type: 'int',
    default: 0,
  })
  kitchenAckCount: number

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  issueType: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  issueMessage: string | null

  @Column({ default: false })
  issueResolved: boolean

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  issueCreatedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  issueLastSeenAt: Date | null

  @Column({ default: false })
  requiresOwnerAction: boolean

  @Column({
    type: 'enum',
    enum: OwnerIssueType,
    enumName: 'owner_issue_type_enum',
    nullable: true,
  })
  ownerIssueType: OwnerIssueType | null

  @Column({
    type: 'enum',
    enum: OwnerIssueSeverity,
    enumName: 'owner_issue_severity_enum',
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
    length: 100,
    nullable: true,
  })
  ownerActionId: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  ownerActionNote: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  ownerActionAt: Date | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  ownerActionBy: string | null

  @Column({
    type: 'varchar',
    length: 255,
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

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  resolutionReason: string | null

  @Column({ default: false })
  refundRequested: boolean

  @Column({ default: false })
  refundProcessed: boolean

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refundId: string | null

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  stripeRefundStatus: string | null

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalNumberTransformer,
  })
  refundAmount: number | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundAt: Date | null

  @Column({
    type: 'text',
    nullable: true,
  })
  refundReason: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refundedBy: string | null

  @Column({ default: false })
  refundApplicationFee: boolean

  @Column({ default: false })
  refundTransferReversed: boolean

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  applicationFeeRefundId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transferReversalId: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  refundFailureMessage: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundRequestedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundLastAttemptAt: Date | null

  @Column({
    type: 'int',
    default: 1,
  })
  paymentProcessingVersion: number

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