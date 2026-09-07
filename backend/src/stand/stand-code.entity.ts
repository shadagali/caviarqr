import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export enum StandCodeStatus {
  UNCLAIMED = 'UNCLAIMED',
  VERIFIED = 'VERIFIED',
  CLAIMED = 'CLAIMED',
}

@Entity('stand_code')
export class StandCode {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  storeCode: string

  @Column({
    type: 'int',
    default: 1,
  })
  tables: number

  @Column({
    type: 'varchar',
    length: 20,
    default: StandCodeStatus.UNCLAIMED,
  })
  status: StandCodeStatus

  /*
   * SHA-256 of the private activation code.
   * The activation code itself is never stored.
   */
  @Column({
    type: 'varchar',
    length: 64,
  })
  claimCodeHash: string

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  verifiedAt: Date | null

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  claimedAt: Date | null

  @Column({
    type: 'int',
    nullable: true,
  })
  claimedBusinessId: number | null

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date
}
