import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddHardwareRefundEmail20260903080000
  implements MigrationInterface
{
  name =
    'AddHardwareRefundEmail20260903080000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundConfirmationEmailSentAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundConfirmationEmailLastAttemptAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundConfirmationEmailAttempts"
        integer
        NOT NULL
        DEFAULT 0
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN
        "refundConfirmationEmailFailureMessage"
        text
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailFailureMessage"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailAttempts"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailLastAttemptAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailSentAt"
    `)
  }
}
