import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity()
export class Kit {

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  kitCode: string

  @Column()
  tableCount: number

  @Column({ nullable: true })
  businessId: number

  @Column({ default: false })
  activated: boolean

}