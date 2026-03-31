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

  @Column()
  name: string

  @Column('float')
  price: number

  // ✅ FIX: allow null
  @Column('float', { nullable: true })
  discountPrice: number | null

  @Column({ nullable: true })
  description: string

  @Column({ nullable: true })
  imageUrl: string

  @Column()
  businessId: number

  @Column({ default: true })
  available: boolean

  @Column({ nullable: true })
  category: string

  @CreateDateColumn()
  createdAt: Date
}