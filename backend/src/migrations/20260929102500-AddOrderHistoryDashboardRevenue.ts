import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddOrderHistoryDashboardRevenue20260929102500
  implements MigrationInterface
{
  name =
    'AddOrderHistoryDashboardRevenue20260929102500'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Preserve the exact revenue definition currently
     * used by Maintenance getDashboardStats().
     *
     * This differs from:
     * - raw gross revenue
     * - refundProcessed-only revenue
     *
     * A status=REFUNDED order with no refundAmount
     * contributes zero revenue under the dashboard
     * formula because total is used as the fallback
     * refund amount.
     */
    await queryRunner.query(`
      ALTER TABLE
        "business_order_history_monthly"

      ADD COLUMN
        "dashboardRevenueCents"
        bigint
        NOT NULL
        DEFAULT 0
    `)

    /*
     * Backfill only orders that have already completed
     * the verified archival process.
     */
    await queryRunner.query(`
      WITH archived AS (
        SELECT
          o."businessId"
            AS "businessId",

          EXTRACT(
            YEAR FROM
              o."createdAt"
                AT TIME ZONE 'UTC'
          )::integer
            AS year,

          EXTRACT(
            MONTH FROM
              o."createdAt"
                AT TIME ZONE 'UTC'
          )::integer
            AS month,

          LOWER(o.currency)
            AS currency,

          ROUND(
            SUM(
              GREATEST(
                o.total -
                CASE
                  WHEN
                    o."refundProcessed" = true
                    OR
                    o.status::text = 'REFUNDED'
                  THEN
                    COALESCE(
                      o."refundAmount",
                      o.total,
                      0
                    )
                  ELSE
                    0
                END,
                0
              )
            ) * 100
          )::bigint
            AS "dashboardRevenueCents"

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
      )

      UPDATE
        "business_order_history_monthly"
          AS history

      SET
        "dashboardRevenueCents" =
          archived."dashboardRevenueCents",

        "updatedAt" =
          NOW()

      FROM archived

      WHERE
        history."businessId" =
          archived."businessId"

        AND
        history.year =
          archived.year

        AND
        history.month =
          archived.month

        AND
        history.currency =
          archived.currency
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE
        "business_order_history_monthly"

      DROP COLUMN IF EXISTS
        "dashboardRevenueCents"
    `)
  }
}
