import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddStandCodes20260902100000
  implements MigrationInterface
{
  name =
    'AddStandCodes20260902100000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stand_code" (
        "id" SERIAL NOT NULL,
        "storeCode" character varying(100) NOT NULL,
        "tables" integer NOT NULL DEFAULT 1,
        "status" character varying(20) NOT NULL DEFAULT 'UNCLAIMED',
        "claimCodeHash" character varying(64) NOT NULL,
        "verifiedAt" TIMESTAMP WITH TIME ZONE,
        "claimedAt" TIMESTAMP WITH TIME ZONE,
        "claimedBusinessId" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stand_code"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_stand_code_storeCode"
          UNIQUE ("storeCode"),
        CONSTRAINT "CHK_stand_code_tables"
          CHECK ("tables" >= 1 AND "tables" <= 100),
        CONSTRAINT "CHK_stand_code_status"
          CHECK (
            "status" IN (
              'UNCLAIMED',
              'VERIFIED',
              'CLAIMED'
            )
          )
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "IDX_stand_code_status"
      ON "stand_code" ("status")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "IDX_stand_code_status"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
      "stand_code"
    `)
  }
}
