import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

export enum MaintenanceAuditAction {
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  ORDER_REFUNDED = 'ORDER_REFUNDED',
  REFUND_FAILED = 'REFUND_FAILED',
  ISSUE_RESOLVED = 'ISSUE_RESOLVED',
  ISSUE_REOPENED = 'ISSUE_REOPENED',
  CUSTOMER_EMAIL_SENT = 'CUSTOMER_EMAIL_SENT',
}

@Entity('maintenance_audit_log')
@Index(['orderId', 'createdAt'])
@Index(['businessId', 'createdAt'])
export class MaintenanceAuditLog {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'enum',
    enum: MaintenanceAuditAction,
  })
  action: MaintenanceAuditAction

  @Column({
    type: 'int',
    nullable: true,
  })
  orderId: number | null

  @Column({
    type: 'int',
    nullable: true,
  })
  businessId: number | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  storeCode: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  performedBy: string | null

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata: Record<string, unknown> | null

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date
}