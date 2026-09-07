import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

export enum BusinessCurrency {
  USD = 'usd',
  INR = 'inr',
}

export enum BusinessCountryCode {
  UNITED_STATES = 'US',
  INDIA = 'IN',
}

@Entity()
export class Business {
  @PrimaryGeneratedColumn()
  id: number

  // =========================
  // AUTH
  // =========================

  @Column({
    type: 'varchar',
    unique: true,
  })
  email: string

  @Column({
    type: 'varchar',
  })
  password: string

  @Column({
    type: 'varchar',
    unique: true,
  })
  storeCode: string

  // =========================
  // COUNTRY AND CURRENCY
  // =========================

  @Column({
    type: 'varchar',
    length: 2,
    default:
      BusinessCountryCode
        .UNITED_STATES,
  })
  countryCode:
    BusinessCountryCode

  @Column({
    type: 'varchar',
    length: 3,
    default:
      BusinessCurrency.USD,
  })
  currency:
    BusinessCurrency

  // =========================
  // STRIPE
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  stripeAccountId:
    | string
    | null

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeChargesEnabled: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripePayoutsEnabled: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeDetailsSubmitted: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeAccountReady: boolean

  @Column({
    type: 'boolean',
    default: false,
  })
  stripeIssueActive: boolean

  @Column({
    type: 'text',
    nullable: true,
  })
  stripeIssueMessage:
    | string
    | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  stripeIssueCreatedAt:
    | Date
    | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  stripeLastCheckedAt:
    | Date
    | null

  // =========================
  // KITCHEN
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  kitchenPassword:
    | string
    | null

  // =========================
  // SERVICE FEE
  // =========================

  @Column({
    type: 'float',
    default: 0,
  })
  serviceFee: number

  // =========================
  // CAVIARQR PROCESSING FEE
  // =========================

  @Column({
    type: 'float',
    default: 1.75,
  })
  processingFeePercent: number

  // =========================
  // EMAIL MARKETING ACCESS
  // =========================

  @Column({
    type: 'boolean',
    default: true,
  })
  emailMarketingEnabled: boolean

  // =========================
  // BRANDING
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  name:
    | string
    | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  cafeName:
    | string
    | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  logo:
    | string
    | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  coverImage:
    | string
    | null

  // =========================
  // STORE STATUS
  // =========================

  @Column({
    type: 'boolean',
    default: true,
  })
  isOpen: boolean

  // =========================
  // RESET TOKEN
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  resetToken:
    | string
    | null
}