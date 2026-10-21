import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddDemoRequests20260922103000
  implements MigrationInterface
{
  name =
    'AddDemoRequests20260922103000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "demo_request" (
        "id" uuid NOT NULL
          DEFAULT uuid_generate_v4(),
        "email" varchar(320) NOT NULL,
        "phone" varchar(40) NOT NULL,
        "message" text NOT NULL,
        "status" varchar(20) NOT NULL
          DEFAULT 'NEW',
        "contactedAt" TIMESTAMPTZ,
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL
          DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL
          DEFAULT now(),
        CONSTRAINT "PK_demo_request"
          PRIMARY KEY ("id"),
        CONSTRAINT "CHK_demo_request_status"
          CHECK (
            "status" IN (
              'NEW',
              'CONTACTED',
              'CLOSED'
            )
          )
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_demo_request_status_created"
      ON "demo_request" (
        "status",
        "createdAt" DESC
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_demo_request_created"
      ON "demo_request" (
        "createdAt" DESC
      )
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_demo_request_created"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_demo_request_status_created"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "demo_request"
    `)
  }
}
