import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddLegalDocuments20260916101500
  implements MigrationInterface
{
  name =
    'AddLegalDocuments20260916101500'

  public async up(
    queryRunner:
      QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "legal_document" (
        "id" BIGSERIAL NOT NULL,
        "documentType" varchar(64) NOT NULL,
        "version" varchar(64) NOT NULL,
        "title" varchar(255) NOT NULL,
        "effectiveDate" date NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT',
        "content" text NOT NULL,
        "contentHash" varchar(64) NOT NULL,
        "requiresReacceptance" boolean NOT NULL DEFAULT false,
        "publishedAt" TIMESTAMPTZ NULL,
        "archivedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_legal_document"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_legal_document_type_version"
          UNIQUE (
            "documentType",
            "version"
          ),

        CONSTRAINT "CHK_legal_document_type"
          CHECK (
            "documentType" IN (
              'TERMS',
              'PRIVACY',
              'SALES_PARTNER_AGREEMENT'
            )
          ),

        CONSTRAINT "CHK_legal_document_status"
          CHECK (
            "status" IN (
              'DRAFT',
              'PUBLISHED',
              'ARCHIVED'
            )
          )
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "UQ_legal_document_one_published_per_type"
      ON "legal_document" (
        "documentType"
      )
      WHERE
        "status" = 'PUBLISHED'
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_legal_document_type_status"
      ON "legal_document" (
        "documentType",
        "status"
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_legal_document_createdAt"
      ON "legal_document" (
        "createdAt"
      )
    `)
  }

  public async down(
    queryRunner:
      QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_legal_document_createdAt"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_legal_document_type_status"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "UQ_legal_document_one_published_per_type"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "legal_document"
    `)
  }
}
