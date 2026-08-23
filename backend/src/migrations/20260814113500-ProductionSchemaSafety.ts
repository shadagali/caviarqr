import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class ProductionSchemaSafety20260814113500
  implements MigrationInterface
{
  name =
    'ProductionSchemaSafety20260814113500'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Add the Stripe/net-revenue fields used by the current Order entity.
    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "stripeBalanceTransactionId"
      varchar(255)
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "stripeFee"
      numeric(12,2)
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "paidAt"
      timestamptz
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "paymentProcessingVersion"
      integer NOT NULL DEFAULT 1
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_order_stripe_balance_transaction"
      ON "order"
      ("stripeBalanceTransactionId")
    `)

    // Move only the old/default fee values to the current default.
    // Existing custom per-cafe values (for example 3.00) are preserved.
    await queryRunner.query(`
      UPDATE "business"
      SET "processingFeePercent" = 4.75
      WHERE
        "processingFeePercent" IS NULL
        OR "processingFeePercent" = 1.75
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      ALTER COLUMN "processingFeePercent"
      SET DEFAULT 4.75
    `)
  }

  public async down(
    _queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Intentionally non-destructive.
     *
     * These columns can contain payment and accounting data.
     * We do not automatically drop them during a migration revert.
     * If a rollback is ever required in production, do it from a
     * verified database snapshot with a reviewed rollback migration.
     */
  }
}