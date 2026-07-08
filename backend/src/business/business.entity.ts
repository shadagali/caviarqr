import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

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
  // STRIPE
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  stripeAccountId:
    | string
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
  // BRANDING
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  name: string | null

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
  logo: string | null

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