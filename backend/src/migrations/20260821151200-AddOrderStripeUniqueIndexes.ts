import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddOrderStripeUniqueIndexes20260821151200
  implements MigrationInterface
{
  name =
    'AddOrderStripeUniqueIndexes20260821151200'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_order_payment_intent"
      ON "order" ("stripePaymentIntentId")
      WHERE "stripePaymentIntentId" IS NOT NULL
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_order_checkout_session"
      ON "order" ("stripeSessionId")
      WHERE "stripeSessionId" IS NOT NULL
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "UQ_order_checkout_session"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
      "UQ_order_payment_intent"
    `)
  }
}