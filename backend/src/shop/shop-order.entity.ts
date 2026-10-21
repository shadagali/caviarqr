import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import {
  ShopOrderItem,
} from './shop-order-item.entity'

@Entity({
  name: 'shop_order',
})
export class ShopOrder {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'varchar',
    length: 40,
    unique: true,
  })
  orderNumber: string

  @Column({
    type: 'varchar',
    length: 254,
    nullable: true,
  })
  email: string | null

  @Column({
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  customerName: string | null

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  phone: string | null

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  shippingAddress: Record<
    string,
    unknown
  > | null

  @Column({
    type: 'int',
  })
  subtotalCents: number

  @Column({
    type: 'int',
    default: 0,
  })
  shippingCents: number

  @Column({
    type: 'int',
  })
  totalCents: number

  @Column({
    type: 'varchar',
    length: 8,
    default: 'usd',
  })
  currency: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeCheckoutSessionId:
    string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripePaymentIntentId:
    string | null

  @Column({
    type: 'varchar',
    length: 32,
    default: 'PENDING',
  })
  paymentStatus: string

  @Column({
    type: 'varchar',
    length: 32,
    default: 'UNFULFILLED',
  })
  fulfillmentStatus: string

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  trackingNumber: string | null

  @Column({
    type: 'boolean',
    default: false,
  })
  inventoryReserved: boolean

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  checkoutExpiresAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  paidAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  shippedAt: Date | null

  @OneToMany(
    () => ShopOrderItem,
    (item) => item.order,
  )
  items: ShopOrderItem[]

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  deliveredAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  confirmationEmailSentAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  confirmationEmailLastAttemptAt: Date | null

  @Column({
    type: 'integer',
    default: 0,
  })
  confirmationEmailAttempts: number

  @Column({
    type: 'text',
    nullable: true,
  })
  confirmationEmailFailureMessage: string | null

  @Column({
    type: 'varchar',
    length: 32,
    default: 'NONE',
  })
  refundStatus: string

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeRefundId: string | null

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  refundIdempotencyKey:
    string | null

  @Column({
    type: 'integer',
    nullable: true,
  })
  refundAmountCents:
    number | null

  @Column({
    type: 'text',
    nullable: true,
  })
  refundReason: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundRequestedAt:
    Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundedAt: Date | null

  @Column({
    type: 'text',
    nullable: true,
  })
  refundFailureMessage:
    string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundConfirmationEmailSentAt:
    Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  refundConfirmationEmailLastAttemptAt:
    Date | null

  @Column({
    type: 'integer',
    default: 0,
  })
  refundConfirmationEmailAttempts:
    number

  @Column({
    type: 'text',
    nullable: true,
  })
  refundConfirmationEmailFailureMessage:
    string | null

  // =========================
  // SALES PARTNER ATTRIBUTION
  // =========================

  @Column({
    type: 'integer',
    nullable: true,
  })
  salesPartnerId:
    number | null

  /*
   * Snapshot the actual code used during
   * checkout so attribution history does
   * not change if a partner code changes.
   */
  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  salesCode:
    string | null

  @Column({
    type: 'integer',
    default: 0,
  })
  salesDiscountCents:
    number

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
