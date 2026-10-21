import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type LegalDocumentType =
  | 'TERMS'
  | 'PRIVACY'
  | 'SALES_PARTNER_AGREEMENT'

export type LegalDocumentStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED'

@Entity('legal_document')
export class LegalDocument {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'varchar',
    length: 64,
  })
  documentType: LegalDocumentType

  @Column({
    type: 'varchar',
    length: 64,
  })
  version: string

  @Column({
    type: 'varchar',
    length: 255,
  })
  title: string

  @Column({
    type: 'date',
  })
  effectiveDate: string

  @Column({
    type: 'varchar',
    length: 16,
    default: 'DRAFT',
  })
  status: LegalDocumentStatus

  @Column({
    type: 'text',
  })
  content: string

  @Column({
    type: 'varchar',
    length: 64,
  })
  contentHash: string

  @Column({
    type: 'boolean',
    default: false,
  })
  requiresReacceptance: boolean

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  archivedAt: Date | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
