import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddBusinessOrderHistoryMonthly20260929101000
  implements MigrationInterface
{
  name =
    'AddBusinessOrderHistoryMonthly20260929101000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS
        "business_order_history_monthly" (
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

          "grossRevenueCents" bigint
            NOT NULL DEFAULT 0,

          "netRevenueCents" bigint
            NOT NULL DEFAULT 0,

          "rawPlatformFeeCents" bigint
            NOT NULL DEFAULT 0,

          "netPlatformFeeCents" bigint
            NOT NULL DEFAULT 0,

          "statusRefundedOrderCount" bigint
            NOT NULL DEFAULT 0,

          "refundedOrderCount" bigint
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS
        "IDX_business_order_history_store"
      ON "business_order_history_monthly" (
        "storeCode"
      )
    `)

    /*
     * Backfill ONLY rows already successfully archived.
     *
     * These formulas intentionally match the existing
     * Maintenance calculations so removing archived
     * per-order rows later does not change the numbers
     * displayed to the user.
     *
     * The write is deterministic: ON CONFLICT replaces
     * the monthly values instead of incrementing them.
     * This prevents accidental double counting if this
     * SQL is ever replayed during validation.
     */
    await queryRunner.query(`
      INSERT INTO
        "business_order_history_monthly" (
          "businessId",
          "storeCode",
          "year",
          "month",
          "currency",
          "orderCount",
          "grossRevenueCents",
          "netRevenueCents",
          "rawPlatformFeeCents",
          "netPlatformFeeCents",
          "statusRefundedOrderCount",
          "refundedOrderCount",
          "firstOrderAt",
          "lastOrderAt",
          "updatedAt"
        )

      SELECT
        o."businessId",

        MAX(o."storeCode"),

        EXTRACT(
          YEAR FROM
            o."createdAt"
              AT TIME ZONE 'UTC'
        )::integer,

        EXTRACT(
          MONTH FROM
            o."createdAt"
              AT TIME ZONE 'UTC'
        )::integer,

        LOWER(o.currency),

        COUNT(*)::bigint,

        ROUND(
          SUM(o.total) * 100
        )::bigint,

        ROUND(
          SUM(
            CASE
              WHEN
                o."refundProcessed" = true
              THEN
                GREATEST(
                  o.total -
                    COALESCE(
                      o."refundAmount",
                      0
                    ),
                  0
                )
              ELSE
                o.total
            END
          ) * 100
        )::bigint,

        ROUND(
          SUM(
            COALESCE(
              o."platformFee",
              0
            )
          ) * 100
        )::bigint,

        ROUND(
          SUM(
            CASE
              WHEN
                (
                  o.status::text = 'REFUNDED'
                  OR
                  o."refundProcessed" = true
                )
                AND
                o."refundApplicationFee" = true
              THEN 0
              ELSE
                COALESCE(
                  o."platformFee",
                  0
                )
            END
          ) * 100
        )::bigint,

        COUNT(*) FILTER (
          WHERE
            o.status::text = 'REFUNDED'
        )::bigint,

        COUNT(*) FILTER (
          WHERE
            o.status::text = 'REFUNDED'
            OR
            o."refundProcessed" = true
        )::bigint,

        MIN(o."createdAt"),

        MAX(o."createdAt"),

        NOW()

      FROM "order" o

      WHERE
        o."archivedAt" IS NOT NULL

      GROUP BY
        o."businessId",

        EXTRACT(
          YEAR FROM
            o."createdAt"
              AT TIME ZONE 'UTC'
        ),

        EXTRACT(
          MONTH FROM
            o."createdAt"
              AT TIME ZONE 'UTC'
        ),

        LOWER(o.currency)

      ON CONFLICT (
        "businessId",
        "year",
        "month",
        "currency"
      )

      DO UPDATE SET
        "storeCode" =
          EXCLUDED."storeCode",

        "orderCount" =
          EXCLUDED."orderCount",

        "grossRevenueCents" =
          EXCLUDED."grossRevenueCents",

        "netRevenueCents" =
          EXCLUDED."netRevenueCents",

        "rawPlatformFeeCents" =
          EXCLUDED."rawPlatformFeeCents",

        "netPlatformFeeCents" =
          EXCLUDED."netPlatformFeeCents",

        "statusRefundedOrderCount" =
          EXCLUDED."statusRefundedOrderCount",

        "refundedOrderCount" =
          EXCLUDED."refundedOrderCount",

        "firstOrderAt" =
          EXCLUDED."firstOrderAt",

        "lastOrderAt" =
          EXCLUDED."lastOrderAt",

        "updatedAt" =
          NOW()
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_order_history_store"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "business_order_history_monthly"
    `)
  }
}
