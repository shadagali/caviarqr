import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddHardwareOrderHistoryAndEmail20260903063000
  implements MigrationInterface
{
  name =
    'AddHardwareOrderHistoryAndEmail20260903063000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "deliveredAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "confirmationEmailSentAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "confirmationEmailLastAttemptAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "confirmationEmailAttempts"
        integer NOT NULL DEFAULT 0
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "confirmationEmailFailureMessage"
        text
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_fulfillment_created"
      ON
        "shop_order"
        (
          "fulfillmentStatus",
          "createdAt" DESC
        )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_payment_fulfillment_created"
      ON
        "shop_order"
        (
          "paymentStatus",
          "fulfillmentStatus",
          "createdAt" DESC
        )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_email"
      ON
        "shop_order"
        ("email")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_tracking"
      ON
        "shop_order"
        ("trackingNumber")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_tracking"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_email"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_payment_fulfillment_created"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_fulfillment_created"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "confirmationEmailFailureMessage"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "confirmationEmailAttempts"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "confirmationEmailLastAttemptAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "confirmationEmailSentAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "deliveredAt"
    `)
  }
}
