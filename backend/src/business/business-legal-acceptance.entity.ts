import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

export type BusinessLegalDocumentType =
  | 'TERMS'
  | 'PRIVACY'

export type BusinessLegalAcceptanceAction =
  | 'AGREED'
  | 'ACKNOWLEDGED'

@Entity('business_legal_acceptance')
export class BusinessLegalAcceptance {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'integer',
  })
  businessId: number

  @Column({
    type: 'varchar',
    length: 64,
  })
  documentType:
    BusinessLegalDocumentType

  @Column({
    type: 'varchar',
    length: 64,
  })
  documentVersion: string

  @Column({
    type: 'varchar',
    length: 64,
  })
  documentHash: string

  @Column({
    type: 'varchar',
    length: 32,
  })
  acceptanceAction:
    BusinessLegalAcceptanceAction

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
