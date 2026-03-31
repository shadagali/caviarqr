import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessId: number;

  @Column()
  storeCode: string;

  @Column('json')
  items: any[];

  @Column('float')
  totalAmount: number;

  @Column('float')
  platformFee: number;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @Column({
    default: 'PENDING',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}