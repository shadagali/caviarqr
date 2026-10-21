import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddOngoingSalesCommissionControls20260915095000
  implements MigrationInterface
{
  name =
    'AddOngoingSalesCommissionControls20260915095000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_partner"
      ADD COLUMN "monthlyCommissionCapCents"
        integer NOT NULL DEFAULT 2000000
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_partner"
      ADD CONSTRAINT "CHK_sales_partner_monthly_commission_cap"
      CHECK (
        "monthlyCommissionCapCents" >= 0
        AND "monthlyCommissionCapCents" <= 2000000000
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      ADD COLUMN "salesCommissionTerminatedAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      ADD COLUMN "earnedAt" TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      ADD COLUMN "capApplied"
        boolean NOT NULL DEFAULT false
    `)

    /*
     * Preserve a stable accounting month for all
     * existing commission rows without changing any
     * amount already earned.
     */
    await queryRunner.query(`
      UPDATE "sales_commission" AS commission
      SET "earnedAt" = COALESCE(
        source_order."paidAt",
        source_order."createdAt",
        commission."createdAt"
      )
      FROM "order" AS source_order
      WHERE source_order."id" = commission."orderId"
        AND commission."earnedAt" IS NULL
    `)

    await queryRunner.query(`
      UPDATE "sales_commission"
      SET "earnedAt" = "createdAt"
      WHERE "earnedAt" IS NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      ALTER COLUMN "earnedAt" SET NOT NULL
    `)

    /*
     * Normal rows still equal platformFeeCents * bps.
     * A cap-limited row may be lower, but never higher.
     */
    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      DROP CONSTRAINT IF EXISTS
        "CHK_sales_commission_exact_amount"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      ADD CONSTRAINT "CHK_sales_commission_capped_amount"
      CHECK (
        (
          "capApplied" = false
          AND "commissionUnits" =
            (
              "platformFeeCents"::bigint *
              "commissionBps"::bigint
            )
        )
        OR
        (
          "capApplied" = true
          AND "commissionUnits" >= 0
          AND "commissionUnits" <=
            (
              "platformFeeCents"::bigint *
              "commissionBps"::bigint
            )
        )
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_commission_partner_earned_at"
      ON "sales_commission" (
        "salesPartnerId",
        "earnedAt"
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_business_sales_partner_commission_status"
      ON "business" (
        "salesPartnerId",
        "salesCommissionTerminatedAt"
      )
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_sales_partner_commission_status"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_sales_commission_partner_earned_at"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      DROP CONSTRAINT IF EXISTS
        "CHK_sales_commission_capped_amount"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      DROP COLUMN IF EXISTS "capApplied"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_commission"
      DROP COLUMN IF EXISTS "earnedAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      DROP COLUMN IF EXISTS
        "salesCommissionTerminatedAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_partner"
      DROP CONSTRAINT IF EXISTS
        "CHK_sales_partner_monthly_commission_cap"
    `)

    await queryRunner.query(`
      ALTER TABLE "sales_partner"
      DROP COLUMN IF EXISTS
        "monthlyCommissionCapCents"
    `)
  }
}
