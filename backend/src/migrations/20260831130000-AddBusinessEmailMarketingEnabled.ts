import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddBusinessEmailMarketingEnabled20260831130000
  implements MigrationInterface
{
  name =
    'AddBusinessEmailMarketingEnabled20260831130000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business"
      ADD COLUMN IF NOT EXISTS
      "emailMarketingEnabled"
      boolean NOT NULL DEFAULT true
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business"
      DROP COLUMN IF EXISTS
      "emailMarketingEnabled"
    `)
  }
}
