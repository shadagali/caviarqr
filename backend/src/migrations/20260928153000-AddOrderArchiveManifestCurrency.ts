import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddOrderArchiveManifestCurrency20260928153000
  implements MigrationInterface
{
  name =
    'AddOrderArchiveManifestCurrency20260928153000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE
        "order_archive_manifest"

      ADD COLUMN IF NOT EXISTS
        "currency" varchar(8)
    `)

    await queryRunner.query(`
      UPDATE
        "order_archive_manifest"

      SET
        "currency" = 'unknown'

      WHERE
        "currency" IS NULL
    `)

    await queryRunner.query(`
      ALTER TABLE
        "order_archive_manifest"

      ALTER COLUMN
        "currency"

      SET NOT NULL
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE
        "order_archive_manifest"

      DROP COLUMN IF EXISTS
        "currency"
    `)
  }
}
