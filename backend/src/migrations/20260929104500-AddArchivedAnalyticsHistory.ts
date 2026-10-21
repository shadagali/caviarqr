import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddArchivedAnalyticsHistory20260929104500
  implements MigrationInterface
{
  name =
    'AddArchivedAnalyticsHistory20260929104500'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Preserve the exact historical inputs needed by
     * AnalyticsService.getDashboard()/getStats().
     */
    await queryRunner.query(`
      ALTER TABLE
        "business_order_history_monthly"

      ADD COLUMN
        "stripeFeeCents"
        bigint
        NOT NULL
        DEFAULT 0,

      ADD COLUMN
        "successfulRefundCents"
        bigint
        NOT NULL
        DEFAULT 0,

      ADD COLUMN
        "ownerAnalyticsNetRevenueCents"
        bigint
        NOT NULL
        DEFAULT 0
    `)

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
              COALESCE(
                o."stripeFee",
                0
              )
            ) * 100
          )::bigint
            AS "stripeFeeCents",

          ROUND(
            SUM(
              CASE
                WHEN
                  o."refundProcessed" = true
                  OR
                  o.status::text = 'REFUNDED'
                  OR
                  LOWER(
                    COALESCE(
                      o."stripeRefundStatus",
                      ''
                    )
                  ) = 'succeeded'
                THEN
                  COALESCE(
                    o."refundAmount",
                    o.total,
                    0
                  )
                ELSE
                  0
              END
            ) * 100
          )::bigint
            AS "successfulRefundCents",

          ROUND(
            (
              SUM(
                COALESCE(
                  o.total,
                  0
                )
                -
                COALESCE(
                  o."stripeFee",
                  0
                )
                -
                COALESCE(
                  o."platformFee",
                  0
                )
              )
              -
              SUM(
                CASE
                  WHEN
                    o."refundProcessed" = true
                    OR
                    o.status::text = 'REFUNDED'
                    OR
                    LOWER(
                      COALESCE(
                        o."stripeRefundStatus",
                        ''
                      )
                    ) = 'succeeded'
                  THEN
                    COALESCE(
                      o."refundAmount",
                      o.total,
                      0
                    )
                  ELSE
                    0
                END
              )
            ) * 100
          )::bigint
            AS "ownerAnalyticsNetRevenueCents"

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
        "stripeFeeCents" =
          archived."stripeFeeCents",

        "successfulRefundCents" =
          archived."successfulRefundCents",

        "ownerAnalyticsNetRevenueCents" =
          archived."ownerAnalyticsNetRevenueCents",

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

    /*
     * Preserve Top Selling Items independently from
     * individual archived order rows.
     *
     * Monthly rows keep the data compact while allowing
     * deterministic historical aggregation.
     */
    await queryRunner.query(`
      CREATE TABLE
        "business_order_item_history_monthly" (
          "businessId"
            integer
            NOT NULL,

          "storeCode"
            varchar(100),

          "year"
            integer
            NOT NULL,

          "month"
            integer
            NOT NULL,

          "itemName"
            text
            NOT NULL,

          "quantitySold"
            numeric
            NOT NULL
            DEFAULT 0,

          "createdAt"
            timestamptz
            NOT NULL
            DEFAULT NOW(),

          "updatedAt"
            timestamptz
            NOT NULL
            DEFAULT NOW(),

          CONSTRAINT
            "PK_business_order_item_history_monthly"
          PRIMARY KEY (
            "businessId",
            "year",
            "month",
            "itemName"
          )
        )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_business_order_item_history_business"

      ON
        "business_order_item_history_monthly"
        ("businessId")
    `)

    /*
     * Refuse to silently reinterpret unusual legacy
     * item shapes. The current archived dataset was
     * audited as objects with numeric quantities.
     */
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1

          FROM "order" o

          CROSS JOIN LATERAL
            jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(
                  COALESCE(
                    o.items::jsonb,
                    '[]'::jsonb
                  )
                ) = 'array'
                THEN COALESCE(
                  o.items::jsonb,
                  '[]'::jsonb
                )
                ELSE '[]'::jsonb
              END
            ) AS item

          WHERE
            o."archivedAt" IS NOT NULL

            AND (
              jsonb_typeof(item)
                <> 'object'

              OR (
                item ? 'name'
                AND
                jsonb_typeof(
                  item -> 'name'
                ) NOT IN (
                  'string',
                  'null'
                )
              )

              OR (
                item ? 'qty'
                AND
                jsonb_typeof(
                  item -> 'qty'
                ) NOT IN (
                  'number',
                  'null'
                )
              )
            )
        ) THEN
          RAISE EXCEPTION
            'Unsupported archived item shape';
        END IF;
      END
      $$
    `)

    await queryRunner.query(`
      INSERT INTO
        "business_order_item_history_monthly" (
          "businessId",
          "storeCode",
          "year",
          "month",
          "itemName",
          "quantitySold"
        )

      SELECT
        o."businessId",

        MAX(
          o."storeCode"
        ) AS "storeCode",

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

        COALESCE(
          NULLIF(
            item ->> 'name',
            ''
          ),
          'Unknown'
        ) AS "itemName",

        SUM(
          CASE
            WHEN
              item -> 'qty'
                IS NULL

              OR
              jsonb_typeof(
                item -> 'qty'
              ) = 'null'

              OR
              (
                jsonb_typeof(
                  item -> 'qty'
                ) = 'number'

                AND
                (
                  item ->> 'qty'
                )::numeric = 0
              )
            THEN
              1::numeric

            ELSE
              (
                item ->> 'qty'
              )::numeric
          END
        ) AS "quantitySold"

      FROM "order" o

      CROSS JOIN LATERAL
        jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(
              COALESCE(
                o.items::jsonb,
                '[]'::jsonb
              )
            ) = 'array'
            THEN COALESCE(
              o.items::jsonb,
              '[]'::jsonb
            )
            ELSE '[]'::jsonb
          END
        ) AS item

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

        COALESCE(
          NULLIF(
            item ->> 'name',
            ''
          ),
          'Unknown'
        )
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_order_item_history_business"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "business_order_item_history_monthly"
    `)

    await queryRunner.query(`
      ALTER TABLE
        "business_order_history_monthly"

      DROP COLUMN IF EXISTS
        "ownerAnalyticsNetRevenueCents",

      DROP COLUMN IF EXISTS
        "successfulRefundCents",

      DROP COLUMN IF EXISTS
        "stripeFeeCents"
    `)
  }
}
