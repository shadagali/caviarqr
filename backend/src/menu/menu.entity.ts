import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm'

@Entity()
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number

  // =========================
  // BUSINESS
  // =========================

  @Column({
    type: 'int',
  })
  businessId: number

  // =========================
  // BASIC INFO
  // =========================

  @Column({
    type: 'varchar',
  })
  name: string

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null

  @Column({
    type: 'varchar',
    nullable: true,
  })
  category: string | null

  // =========================
  // PRICING
  // =========================

  @Column({
    type: 'float',
    default: 0,
  })
  price: number

  @Column({
    type: 'float',
    default: 0,
  })
  discount: number

  // =========================
  // IMAGE
  // =========================

  @Column({
    type: 'varchar',
    nullable: true,
  })
  imageUrl: string | null

  // =========================
  // STATUS
  // =========================

  @Column({
    default: false,
  })
  isHidden: boolean

  @Column({
    default: false,
  })
  isOutOfStock: boolean

  // =========================
  // CREATED
  // =========================

  @CreateDateColumn()
  createdAt: Date
}