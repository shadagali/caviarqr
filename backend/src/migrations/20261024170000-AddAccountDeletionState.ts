import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAccountDeletionState20261024170000
  implements MigrationInterface {

  name = 'AddAccountDeletionState20261024170000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business"
      ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_business_deletedAt"
      ON "business" ("deletedAt")
    `)
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Preserve account closure markers during rollbacks.
  }
}
