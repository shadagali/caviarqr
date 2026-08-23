import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddCustomerSupportAndReceipts20260817175000
  implements MigrationInterface
{
  name =
    'AddCustomerSupportAndReceipts20260817175000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * CaviarQR production uses migrations rather than
     * synchronize. This migration is deliberately
     * additive and preserves all existing order data.
     */

    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS
      "uuid-ossp"
    `)

    // ---------------------------------
    // Order receipt/support fields
    // ---------------------------------

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "supportThreadId"
      uuid
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "receiptEmailSentAt"
      timestamptz
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "receiptEmailLastAttemptAt"
      timestamptz
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "receiptEmailAttempts"
      integer NOT NULL DEFAULT 0
    `)

    await queryRunner.query(`
      ALTER TABLE "order"
      ADD COLUMN IF NOT EXISTS
      "receiptEmailFailureMessage"
      text
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_order_support_thread"
      ON "order"
      ("supportThreadId")
      WHERE "supportThreadId" IS NOT NULL
    `)

    // ---------------------------------
    // Action Center support issue enum
    // ---------------------------------
    //
    // Existing CaviarQR databases are not guaranteed to
    // use a PostgreSQL enum for order.ownerIssueType.
    // Some installations store it as varchar/text.
    //
    // If the actual column is backed by an enum, add the
    // new value to that exact enum type. Otherwise there
    // is nothing to alter because varchar/text already
    // accepts CUSTOMER_SUPPORT_REQUEST.
    await queryRunner.query(`
      DO $$
      DECLARE
        owner_issue_type_schema text;
        owner_issue_type_name text;
        owner_issue_type_kind "char";
      BEGIN
        SELECT
          type_namespace.nspname,
          type_info.typname,
          type_info.typtype
        INTO
          owner_issue_type_schema,
          owner_issue_type_name,
          owner_issue_type_kind
        FROM pg_attribute attribute_info
        JOIN pg_class table_info
          ON table_info.oid =
            attribute_info.attrelid
        JOIN pg_namespace table_namespace
          ON table_namespace.oid =
            table_info.relnamespace
        JOIN pg_type type_info
          ON type_info.oid =
            attribute_info.atttypid
        JOIN pg_namespace type_namespace
          ON type_namespace.oid =
            type_info.typnamespace
        WHERE
          table_namespace.nspname =
            current_schema()
          AND table_info.relname =
            'order'
          AND attribute_info.attname =
            'ownerIssueType'
          AND attribute_info.attnum > 0
          AND NOT attribute_info.attisdropped
        LIMIT 1;

        IF
          owner_issue_type_kind = 'e'
          AND owner_issue_type_name IS NOT NULL
        THEN
          EXECUTE format(
            'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
            owner_issue_type_schema,
            owner_issue_type_name,
            'CUSTOMER_SUPPORT_REQUEST'
          );
        END IF;
      END
      $$;
    `)

    // ---------------------------------
    // Support enums
    // ---------------------------------

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE
        "support_thread_status_enum"
        AS ENUM (
          'AVAILABLE',
          'AWAITING_RESTAURANT',
          'AWAITING_CUSTOMER',
          'RESOLVED',
          'REFUNDED'
        );
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE
        "support_sender_type_enum"
        AS ENUM (
          'CUSTOMER',
          'RESTAURANT',
          'CAVIARQR',
          'SYSTEM'
        );
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)

    // ---------------------------------
    // Support thread
    // ---------------------------------

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
      "support_thread" (
        "id" uuid NOT NULL
          DEFAULT uuid_generate_v4(),

        "orderId" integer NOT NULL,

        "businessId" integer NOT NULL,

        "storeCode" varchar(100),

        "customerEmail" varchar(320),

        "customerName" varchar(255),

        "status"
          "support_thread_status_enum"
          NOT NULL
          DEFAULT 'AVAILABLE',

        "restaurantUnreadCount"
          integer NOT NULL
          DEFAULT 0,

        "customerUnreadCount"
          integer NOT NULL
          DEFAULT 0,

        "lastMessageAt"
          timestamptz,

        "resolvedAt"
          timestamptz,

        "createdAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        "updatedAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT
          "PK_support_thread"
          PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      "UQ_support_thread_order"
      ON "support_thread"
      ("orderId")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_support_thread_business_status"
      ON "support_thread"
      (
        "businessId",
        "status",
        "lastMessageAt"
      )
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE
        "support_thread"
        ADD CONSTRAINT
        "FK_support_thread_order"
        FOREIGN KEY ("orderId")
        REFERENCES "order"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)

    // ---------------------------------
    // Support messages
    // ---------------------------------

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
      "support_message" (
        "id" SERIAL NOT NULL,

        "threadId"
          uuid NOT NULL,

        "senderType"
          "support_sender_type_enum"
          NOT NULL,

        "senderName"
          varchar(255),

        "message"
          text NOT NULL,

        "metadata"
          jsonb,

        "emailNotificationSentAt"
          timestamptz,

        "createdAt"
          timestamptz NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT
          "PK_support_message"
          PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
      "IDX_support_message_thread_created"
      ON "support_message"
      (
        "threadId",
        "createdAt"
      )
    `)

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE
        "support_message"
        ADD CONSTRAINT
        "FK_support_message_thread"
        FOREIGN KEY ("threadId")
        REFERENCES "support_thread"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END
      $$;
    `)
  }

  public async down(
    _queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Intentionally non-destructive.
     *
     * Support conversations, customer emails and receipt
     * delivery state are operational/audit records. A
     * production rollback should restore from a verified
     * database snapshot or use a separately reviewed,
     * explicit data-migration rollback.
     */
  }
}