import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddHardwareRefunds20260903072000
  implements MigrationInterface
{
  name =
    'AddHardwareRefunds20260903072000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundStatus"
        varchar(32)
        NOT NULL
        DEFAULT 'NONE'
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "stripeRefundId"
        varchar(255)
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundIdempotencyKey"
        varchar(255)
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundAmountCents"
        integer
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundReason"
        text
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundRequestedAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundedAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundFailureMessage"
        text
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD CONSTRAINT
        "CHK_shop_order_refund_amount"
      CHECK (
        "refundAmountCents" IS NULL
        OR "refundAmountCents" >= 0
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "UQ_shop_order_stripe_refund"
      ON "shop_order"
        ("stripeRefundId")
      WHERE
        "stripeRefundId" IS NOT NULL
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "UQ_shop_order_refund_idempotency"
      ON "shop_order"
        ("refundIdempotencyKey")
      WHERE
        "refundIdempotencyKey" IS NOT NULL
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_refund_status"
      ON "shop_order"
        ("refundStatus")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_refund_status"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "UQ_shop_order_refund_idempotency"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "UQ_shop_order_stripe_refund"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP CONSTRAINT IF EXISTS
        "CHK_shop_order_refund_amount"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundFailureMessage"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundedAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundRequestedAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundReason"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundAmountCents"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundIdempotencyKey"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "stripeRefundId"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundStatus"
    `)
  }
}
