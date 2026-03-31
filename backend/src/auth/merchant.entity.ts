import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity()
export class Merchant {

  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  email: string

  @Column()
  password: string

  @Column({ nullable: true })
  businessId: number

}