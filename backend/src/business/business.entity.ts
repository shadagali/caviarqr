import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Business {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  storeCode: string;

  // ✅ FIX — MAKE SAFE FOR SYNC
  @Column({ nullable: true })
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  stripeAccountId: string;
}