import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddPlatformPayoutAudit20260902170000
  implements MigrationInterface
{
  name =
    'AddPlatformPayoutAudit20260902170000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE
        "platform_payout" (
          "id" SERIAL NOT NULL,
          "amountCents" integer NOT NULL,
          "currency" varchar(8) NOT NULL DEFAULT 'usd',
          "status" varchar(32) NOT NULL DEFAULT 'CREATING',
          "stripePayoutId" varchar(255),
          "idempotencyKey" varchar(255) NOT NULL,
          "requestedBy" varchar(120),
          "failureMessage" text,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

          CONSTRAINT
            "PK_platform_payout"
            PRIMARY KEY ("id"),

          CONSTRAINT
            "UQ_platform_payout_stripe"
            UNIQUE ("stripePayoutId"),

          CONSTRAINT
            "UQ_platform_payout_idempotency"
            UNIQUE ("idempotencyKey"),

          CONSTRAINT
            "CHK_platform_payout_amount"
            CHECK ("amountCents" >= 100)
        )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_platform_payout_created"
      ON
        "platform_payout"
        ("createdAt")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "platform_payout"
    `)
  }
}
