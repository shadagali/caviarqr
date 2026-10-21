import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddMenuCustomizations20261007070000
  implements MigrationInterface
{
  name =
    'AddMenuCustomizations20261007070000'

  async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_item"
      ADD COLUMN IF NOT EXISTS "customizations"
      jsonb NOT NULL DEFAULT '[]'::jsonb
    `)
  }

  async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_item"
      DROP COLUMN IF EXISTS "customizations"
    `)
  }
}
