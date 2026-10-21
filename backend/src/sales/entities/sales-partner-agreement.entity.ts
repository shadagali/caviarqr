import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('sales_partner_agreement')
export class SalesPartnerAgreement {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'integer',
  })
  salesPartnerId: number

  @Column({
    type: 'varchar',
    length: 64,
  })
  agreementVersion: string

  @Column({
    type: 'varchar',
    length: 64,
  })
  agreementHash: string

  @Column({
    type: 'timestamptz',
  })
  acceptedAt: Date

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  ipAddress: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  userAgent: string | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date
}
