import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddRestaurantRefundEmail20260911122000
  implements MigrationInterface
{
  name =
    'AddRestaurantRefundEmail20260911122000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "refundConfirmationEmailSentAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "refundConfirmationEmailLastAttemptAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "refundConfirmationEmailAttempts"
        integer
        NOT NULL
        DEFAULT 0
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "refundConfirmationEmailFailureMessage"
        text
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailFailureMessage"
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailAttempts"
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailLastAttemptAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "refundConfirmationEmailSentAt"
    `)
  }
}
