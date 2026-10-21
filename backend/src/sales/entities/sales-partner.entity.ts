import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum SalesPartnerStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

@Entity('sales_partner')
export class SalesPartner {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'varchar',
    length: 254,
    unique: true,
  })
  email: string

  @Column({
    type: 'varchar',
    length: 255,
  })
  passwordHash: string

  @Column({
    type: 'varchar',
    length: 180,
  })
  legalName: string

  @Column({
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  displayName: string | null

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  phone: string | null

  @Column({
    type: 'varchar',
    length: 2,
    default: 'US',
  })
  countryCode: string

  @Column({
    type: 'varchar',
    length: 32,
    unique: true,
  })
  referralCode: string

  @Column({
    type: 'integer',
    default: 1000,
  })
  commissionBps: number

  /*
   * Per-partner UTC calendar-month commission cap.
   * Stored in whole cents to avoid floating-point
   * configuration errors. $20,000 = 2,000,000 cents.
   */
  @Column({
    type: 'integer',
    default: 2000000,
  })
  monthlyCommissionCapCents: number

  @Column({
    type: 'integer',
    default: 0,
  })
  hardwareDiscountBps: number

  @Column({
    type: 'varchar',
    length: 32,
    default: SalesPartnerStatus.PENDING,
  })
  status: SalesPartnerStatus

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeAccountId: string | null

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeDetailsSubmitted: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripePayoutsEnabled: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeAccountReady: boolean

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  stripeLastCheckedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastLoginAt: Date | null

  @Column({
    type: 'integer',
    default: 0,
  })
  failedLoginAttempts: number

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lockedUntil: Date | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
