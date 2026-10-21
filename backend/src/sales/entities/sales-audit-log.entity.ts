import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('sales_audit_log')
export class SalesAuditLog {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string

  @Column({
    type: 'integer',
    nullable: true,
  })
  salesPartnerId: number | null

  @Column({
    type: 'varchar',
    length: 32,
  })
  actorType: string

  @Column({
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  actorIdentifier: string | null

  @Column({
    type: 'varchar',
    length: 120,
  })
  action: string

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata: Record<string, unknown> | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date
}
