import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Index(
  'UQ_marketing_subscriber_business_email',
  ['businessId', 'email'],
  {
    unique: true,
  },
)
@Index(
  'UQ_marketing_subscriber_unsubscribe_token',
  ['unsubscribeToken'],
  {
    unique: true,
  },
)
@Index(
  'IDX_marketing_subscriber_business_active',
  ['businessId', 'isSubscribed'],
)
@Entity('marketing_subscriber')
export class MarketingSubscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({
    type: 'int',
  })
  businessId: number

  /*
   * Always store this lowercase + trimmed.
   */
  @Column({
    type: 'varchar',
    length: 320,
  })
  email: string

  @Column({
    type: 'boolean',
    default: true,
  })
  isSubscribed: boolean

  @Column({
    type: 'varchar',
    length: 50,
    default: 'CHECKOUT',
  })
  consentSource: string

  /*
   * Order that produced the opt-in.
   * Useful as an audit trail.
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  consentOrderId: number | null

  @Column({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  consentedAt: Date

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  unsubscribedAt: Date | null

  /*
   * Public unsubscribe URLs use this
   * random token instead of exposing
   * the subscriber ID or email.
   */
  @Column({
    type: 'uuid',
  })
  unsubscribeToken: string

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
