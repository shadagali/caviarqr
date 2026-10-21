import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddOrderArchiveRetention20260928140000
  implements MigrationInterface
{
  name =
    'AddOrderArchiveRetention20260928140000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "archivedAt" timestamptz
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
        "archiveBatchId" varchar(64)
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_order_archive_eligibility"
      ON "order" (
        "createdAt",
        "id"
      )
      WHERE "archivedAt" IS NULL
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
        "order_archive_manifest" (
          "id" BIGSERIAL PRIMARY KEY,
          "batchId" varchar(64)
            NOT NULL UNIQUE,
          "s3Bucket" varchar(255)
            NOT NULL,
          "s3Key" text
            NOT NULL UNIQUE,
          "storageClass" varchar(32)
            NOT NULL,
          "sha256" varchar(64)
            NOT NULL,
          "uncompressedSha256" varchar(64)
            NOT NULL,
          "sourceRowCount" integer
            NOT NULL,
          "firstOrderId" integer
            NOT NULL,
          "lastOrderId" integer
            NOT NULL,
          "cutoffAt" timestamptz
            NOT NULL,
          "oldestOrderAt" timestamptz
            NOT NULL,
          "newestOrderAt" timestamptz
            NOT NULL,
          "grossCents" bigint
            NOT NULL,
          "platformFeeCents" bigint
            NOT NULL,
          "stripeFeeCents" bigint
            NOT NULL,
          "refundCents" bigint
            NOT NULL,
          "commissionUnits" bigint
            NOT NULL DEFAULT 0,
          "status" varchar(24)
            NOT NULL,
          "error" text,
          "createdAt" timestamptz
            NOT NULL DEFAULT NOW(),
          "verifiedAt" timestamptz,
          "purgedAt" timestamptz
        )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
        "order_retention_hold" (
          "orderId" integer
            PRIMARY KEY,
          "reason" text
            NOT NULL,
          "createdAt" timestamptz
            NOT NULL DEFAULT NOW(),
          "releasedAt" timestamptz,
          "releasedBy" varchar(255)
        )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
        "business_financial_monthly" (
          "businessId" integer
            NOT NULL,
          "storeCode" varchar(100),
          "year" integer
            NOT NULL,
          "month" integer
            NOT NULL,
          "currency" varchar(8)
            NOT NULL,
          "orderCount" bigint
            NOT NULL DEFAULT 0,
          "grossCents" bigint
            NOT NULL DEFAULT 0,
          "platformFeeCents" bigint
            NOT NULL DEFAULT 0,
          "stripeFeeCents" bigint
            NOT NULL DEFAULT 0,
          "refundCents" bigint
            NOT NULL DEFAULT 0,
          "commissionUnits" bigint
            NOT NULL DEFAULT 0,
          "firstOrderAt" timestamptz,
          "lastOrderAt" timestamptz,
          "createdAt" timestamptz
            NOT NULL DEFAULT NOW(),
          "updatedAt" timestamptz
            NOT NULL DEFAULT NOW(),

          PRIMARY KEY (
            "businessId",
            "year",
            "month",
            "currency"
          )
        )
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "business_financial_monthly"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "order_retention_hold"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "order_archive_manifest"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_order_archive_eligibility"
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "archiveBatchId"
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      DROP COLUMN IF EXISTS
        "archivedAt"
    `)
  }
}
