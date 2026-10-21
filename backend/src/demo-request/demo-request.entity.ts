import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type DemoRequestStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'CLOSED'

@Index(
  'IDX_demo_request_status_created',
  ['status', 'createdAt'],
)
@Entity('demo_request')
export class DemoRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({
    type: 'varchar',
    length: 320,
  })
  email: string

  @Column({
    type: 'varchar',
    length: 40,
  })
  phone: string

  @Column({
    type: 'text',
  })
  message: string

  @Column({
    type: 'varchar',
    length: 20,
    default: 'NEW',
  })
  status: DemoRequestStatus

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  contactedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  closedAt: Date | null

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
