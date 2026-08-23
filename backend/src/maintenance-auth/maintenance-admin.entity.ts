import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity()
export class MaintenanceAdmin {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email: string

  @Column({
    type: 'text',
  })
  passwordHash: string

  @Column({
    type: 'boolean',
    default: true,
  })
  isActive: boolean

  @Column({
    type: 'text',
    nullable: true,
  })
  resetOtpHash: string | null

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  resetOtpExpiresAt: Date | null

  @Column({
    type: 'int',
    default: 0,
  })
  failedLoginAttempts: number

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lockedUntil: Date | null

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  lastLoginAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}