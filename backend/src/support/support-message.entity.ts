import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

export enum SupportSenderType {
  CUSTOMER = 'CUSTOMER',
  RESTAURANT = 'RESTAURANT',
  CAVIARQR = 'CAVIARQR',
  SYSTEM = 'SYSTEM',
}

@Index(
  'IDX_support_message_thread_created',
  ['threadId', 'createdAt'],
)
@Entity()
export class SupportMessage {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'uuid',
  })
  threadId: string

  @Column({
    type: 'enum',
    enum: SupportSenderType,
    enumName: 'support_sender_type_enum',
  })
  senderType: SupportSenderType

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  senderName: string | null

  @Column({
    type: 'text',
  })
  message: string

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata:
    | Record<string, unknown>
    | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  emailNotificationSentAt: Date | null

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date
}