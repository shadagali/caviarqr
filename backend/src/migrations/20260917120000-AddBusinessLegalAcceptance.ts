import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddBusinessLegalAcceptance20260917120000
implements MigrationInterface {
  name =
    'AddBusinessLegalAcceptance20260917120000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "business_legal_acceptance" (
        "id" BIGSERIAL NOT NULL,
        "businessId" integer NOT NULL,
        "documentType" varchar(64) NOT NULL,
        "documentVersion" varchar(64) NOT NULL,
        "documentHash" varchar(64) NOT NULL,
        "acceptanceAction" varchar(32) NOT NULL,
        "acceptedAt" TIMESTAMPTZ NOT NULL,
        "ipAddress" varchar(64),
        "userAgent" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_business_legal_acceptance"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_business_legal_acceptance_version"
          UNIQUE (
            "businessId",
            "documentType",
            "documentVersion"
          ),

        CONSTRAINT "CHK_business_legal_acceptance_type"
          CHECK (
            "documentType" IN (
              'TERMS',
              'PRIVACY'
            )
          ),

        CONSTRAINT "CHK_business_legal_acceptance_action"
          CHECK (
            "acceptanceAction" IN (
              'AGREED',
              'ACKNOWLEDGED'
            )
          ),

        CONSTRAINT "FK_business_legal_acceptance_business"
          FOREIGN KEY ("businessId")
          REFERENCES "business"("id")
          ON DELETE RESTRICT
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_business_legal_acceptance_business"
      ON "business_legal_acceptance"
        ("businessId")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_business_legal_acceptance_document"
      ON "business_legal_acceptance"
        (
          "documentType",
          "documentVersion"
        )
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_legal_acceptance_document"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_legal_acceptance_business"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "business_legal_acceptance"
    `)
  }
}
