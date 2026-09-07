import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum MarketingCampaignStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Index(
  'IDX_marketing_campaign_business_created',
  ['businessId', 'createdAt'],
)
@Entity('marketing_campaign')
export class MarketingCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({
    type: 'int',
  })
  businessId: number

  /*
   * UTC calendar month:
   * 2026-08, 2026-09, etc.
   *
   * The database migration creates a
   * unique partial index using this field.
   */
  @Column({
    type: 'varchar',
    length: 7,
  })
  monthKey: string

  @Column({
    type: 'varchar',
    length: 200,
  })
  subject: string

  @Column({
    type: 'text',
  })
  message: string

  @Column({
    type: 'varchar',
    length: 20,
    default:
      MarketingCampaignStatus
        .SENDING,
  })
  status: MarketingCampaignStatus

  @Column({
    type: 'int',
    default: 0,
  })
  recipientCount: number

  @Column({
    type: 'int',
    default: 0,
  })
  sentCount: number

  @Column({
    type: 'int',
    default: 0,
  })
  failedCount: number

  @Column({
    type: 'text',
    nullable: true,
  })
  failureMessage: string | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  sentAt: Date | null

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
