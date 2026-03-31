import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column()
  password: string

  @Column()
  businessId: string
}