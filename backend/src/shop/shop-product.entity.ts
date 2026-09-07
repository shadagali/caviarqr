import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity({
  name: 'shop_product',
})
export class ShopProduct {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'varchar',
    length: 140,
  })
  name: string

  @Column({
    type: 'text',
    default: '',
  })
  description: string

  @Column({
    type: 'int',
  })
  priceCents: number

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  imageUrl: string | null

  @Column({
    type: 'int',
    default: 0,
  })
  inventory: number

  @Column({
    type: 'boolean',
    default: true,
  })
  active: boolean

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
