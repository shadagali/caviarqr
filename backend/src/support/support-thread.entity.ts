import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum SupportThreadStatus {
  AVAILABLE = 'AVAILABLE',
  AWAITING_RESTAURANT = 'AWAITING_RESTAURANT',
  AWAITING_CUSTOMER = 'AWAITING_CUSTOMER',
  RESOLVED = 'RESOLVED',
  REFUNDED = 'REFUNDED',
}

@Index(
  'UQ_support_thread_order',
  ['orderId'],
  { unique: true },
)
@Index(
  'IDX_support_thread_business_status',
  [
    'businessId',
    'status',
    'lastMessageAt',
  ],
)
@Entity()
export class SupportThread {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'int' })
  orderId: number

  @Column({ type: 'int' })
  businessId: number

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  storeCode: string | null

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
    type: 'enum',
    enum: SupportThreadStatus,
    enumName: 'support_thread_status_enum',
    default: SupportThreadStatus.AVAILABLE,
  })
  status: SupportThreadStatus

  @Column({
    type: 'int',
    default: 0,
  })
  restaurantUnreadCount: number

  @Column({
    type: 'int',
    default: 0,
  })
  customerUnreadCount: number

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastMessageAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  resolvedAt: Date | null

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