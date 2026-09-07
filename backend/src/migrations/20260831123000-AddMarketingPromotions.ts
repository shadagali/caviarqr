import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddMarketingPromotions20260831123000
  implements MigrationInterface
{
  name =
    'AddMarketingPromotions20260831123000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Additive production-safe migration.
     * Existing customers/orders are not
     * automatically opted into marketing.
     */

    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS
      "uuid-ossp"
    `)

    // ---------------------------------
    // Carry explicit consent through
    // checkout/payment processing
    // ---------------------------------

    await queryRunner.query(`
      ALTER TABLE "pending_order"
      ADD COLUMN IF NOT EXISTS
      "marketingOptIn"
      boolean NOT NULL DEFAULT false
    `)

    await queryRunner.query(`
      ALTER TABLE "pending_order"
      ADD COLUMN IF NOT EXISTS
      "marketingConsentAt"
      timestamptz
    `)

    // ---------------------------------
    // Marketing subscribers
    // ---------------------------------

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
      "marketing_subscriber" (
        "id"
          uuid NOT NULL
          DEFAULT uuid_generate_v4(),

        "businessId"
          integer NOT NULL,

        "email"
          varchar(320) NOT NULL,

        "isSubscribed"
          boolean NOT NULL
          DEFAULT true,

        "consentSource"
          varchar(50) NOT NULL
          DEFAULT 'CHECKOUT',

        "consentOrderId"
          integer,

        "consentedAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        "unsubscribedAt"
          timestamptz,

        "unsubscribeToken"
          uuid NOT NULL
          DEFAULT uuid_generate_v4(),

        "createdAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        "updatedAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT
          "PK_marketing_subscriber"
          PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_marketing_subscriber_business_email"
      ON "marketing_subscriber"
      (
        "businessId",
        "email"
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_marketing_subscriber_unsubscribe_token"
      ON "marketing_subscriber"
      ("unsubscribeToken")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_marketing_subscriber_business_active"
      ON "marketing_subscriber"
      (
        "businessId",
        "isSubscribed"
      )
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE
        "marketing_subscriber"
        ADD CONSTRAINT
        "FK_marketing_subscriber_business"
        FOREIGN KEY ("businessId")
        REFERENCES "business"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE
        "marketing_subscriber"
        ADD CONSTRAINT
        "FK_marketing_subscriber_consent_order"
        FOREIGN KEY ("consentOrderId")
        REFERENCES "order"("id")
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)

    // ---------------------------------
    // Marketing campaigns
    // ---------------------------------

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
      "marketing_campaign" (
        "id"
          uuid NOT NULL
          DEFAULT uuid_generate_v4(),

        "businessId"
          integer NOT NULL,

        "monthKey"
          varchar(7) NOT NULL,

        "subject"
          varchar(200) NOT NULL,

        "message"
          text NOT NULL,

        "status"
          varchar(20) NOT NULL
          DEFAULT 'SENDING',

        "recipientCount"
          integer NOT NULL
          DEFAULT 0,

        "sentCount"
          integer NOT NULL
          DEFAULT 0,

        "failedCount"
          integer NOT NULL
          DEFAULT 0,

        "failureMessage"
          text,

        "sentAt"
          timestamptz,

        "createdAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        "updatedAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT
          "PK_marketing_campaign"
          PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_marketing_campaign_business_created"
      ON "marketing_campaign"
      (
        "businessId",
        "createdAt"
      )
    `)

    /*
     * Critical protection:
     *
     * Only one SENDING/SENT campaign
     * can exist for a business in the
     * same calendar month.
     *
     * A FAILED campaign does not consume
     * the café's monthly allowance.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_marketing_campaign_business_month_active"
      ON "marketing_campaign"
      (
        "businessId",
        "monthKey"
      )
      WHERE
        "status" IN (
          'SENDING',
          'SENT'
        )
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE
        "marketing_campaign"
        ADD CONSTRAINT
        "FK_marketing_campaign_business"
        FOREIGN KEY ("businessId")
        REFERENCES "business"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
      "marketing_campaign"
      CASCADE
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
      "marketing_subscriber"
      CASCADE
    `)

    await queryRunner.query(`
      ALTER TABLE "pending_order"
      DROP COLUMN IF EXISTS
      "marketingConsentAt"
    `)

    await queryRunner.query(`
      ALTER TABLE "pending_order"
      DROP COLUMN IF EXISTS
      "marketingOptIn"
    `)
  }
}
