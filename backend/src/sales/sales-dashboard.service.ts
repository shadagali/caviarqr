import {
  Injectable,
} from '@nestjs/common'

import {
  DataSource,
} from 'typeorm'

type ExactMoney = {
  units: string
  wholeCents: string
  residualUnits: string
  display: string
}

@Injectable()
export class SalesDashboardService {
  constructor(
    private readonly dataSource:
      DataSource,
  ) {}

  private moneyFromUnits(
    rawUnits: unknown,
  ): ExactMoney {
    let units = 0n

    try {
      units = BigInt(
        String(
          rawUnits ?? '0',
        ),
      )
    } catch {
      units = 0n
    }

    if (units < 0n) {
      units = 0n
    }

    const wholeCents =
      units / 10000n

    const residualUnits =
      units % 10000n

    const dollars =
      wholeCents / 100n

    const cents =
      (
        wholeCents %
        100n
      )
        .toString()
        .padStart(
          2,
          '0',
        )

    return {
      units:
        units.toString(),

      wholeCents:
        wholeCents.toString(),

      residualUnits:
        residualUnits.toString(),

      display:
        `$${dollars.toString()}.${cents}`,
    }
  }

  private moneyFromCents(
    rawCents: unknown,
  ) {
    let cents = 0n

    try {
      cents = BigInt(
        String(
          rawCents ?? '0',
        ),
      )
    } catch {
      cents = 0n
    }

    if (cents < 0n) {
      cents = 0n
    }

    const dollars =
      cents / 100n

    const remainder =
      (
        cents %
        100n
      )
        .toString()
        .padStart(
          2,
          '0',
        )

    return {
      cents:
        cents.toString(),

      display:
        `$${dollars.toString()}.${remainder}`,
    }
  }

  async dashboard(
    salesPartnerId: number,
  ) {
    if (
      !Number.isInteger(
        salesPartnerId,
      ) ||
      salesPartnerId < 1
    ) {
      throw new Error(
        'Valid Sales Partner id is required.',
      )
    }

    /*
     * Everything below is read-only.
     *
     * No payout is reserved.
     * No Stripe transfer is initiated.
     * No commission status is modified.
     */

    const restaurants =
      await this.dataSource.query(
        `
          SELECT
            b."id" AS "businessId",
            b."storeCode" AS "storeCode",
            b."salesAttributedAt" AS "attributedAt",
            b."salesCommissionBps" AS "commissionBps",
            b."salesCommissionDurationMode" AS "durationMode",
            b."salesCommissionDurationMonths" AS "durationMonths",
            b."salesCommissionEndsAt" AS "commissionEndsAt",
            COALESCE(
              SUM(
                CASE
                  WHEN sc."status" IN (
                    'PENDING',
                    'AVAILABLE',
                    'PAYOUT_PENDING',
                    'PAID'
                  )
                  THEN sc."commissionUnits"::numeric
                  ELSE 0
                END
              ),
              0
            )::text AS "earnedUnits"
          FROM "business" b
          LEFT JOIN "sales_commission" sc
            ON sc."businessId" = b."id"
            AND sc."salesPartnerId" = $1
          WHERE b."salesPartnerId" = $1
          GROUP BY
            b."id",
            b."storeCode",
            b."salesAttributedAt",
            b."salesCommissionBps",
            b."salesCommissionDurationMode",
            b."salesCommissionDurationMonths",
            b."salesCommissionEndsAt"
          ORDER BY
            b."salesAttributedAt" DESC NULLS LAST,
            b."id" DESC
        `,
        [
          salesPartnerId,
        ],
      )

    const summaryRows =
      await this.dataSource.query(
        `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN "status" IN (
                    'PENDING',
                    'AVAILABLE',
                    'PAYOUT_PENDING',
                    'PAID'
                  )
                  THEN "commissionUnits"::numeric
                  ELSE 0
                END
              ),
              0
            )::text AS "earnedUnits",

            COALESCE(
              SUM(
                CASE
                  WHEN "status" = 'PENDING'
                  THEN "commissionUnits"::numeric
                  ELSE 0
                END
              ),
              0
            )::text AS "pendingUnits"

          FROM "sales_commission"
          WHERE "salesPartnerId" = $1
        `,
        [
          salesPartnerId,
        ],
      )

    /*
     * AVAILABLE commissions can contain a
     * fractional residual after a payout.
     *
     * Subtract units already consumed by
     * PENDING / PROCESSING / PAID payout
     * batches so the displayed available
     * balance is exact.
     */
    const availableRows =
      await this.dataSource.query(
        `
          WITH consumed AS (
            SELECT
              item."salesCommissionId"
                AS "salesCommissionId",

              COALESCE(
                SUM(
                  item."amountUnits"::numeric
                ),
                0
              ) AS "consumedUnits"

            FROM "sales_payout_item" item

            INNER JOIN "sales_payout" payout
              ON payout."id" =
                item."salesPayoutId"

            WHERE
              payout."salesPartnerId" = $1

              AND payout."status" IN (
                'PENDING',
                'PROCESSING',
                'PAID'
              )

            GROUP BY
              item."salesCommissionId"
          )

          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  commission."commissionUnits"::numeric -
                    COALESCE(
                      consumed."consumedUnits",
                      0
                    ),
                  0
                )
              ),
              0
            )::text AS "availableUnits"

          FROM "sales_commission" commission

          LEFT JOIN consumed
            ON consumed."salesCommissionId" =
              commission."id"

          WHERE
            commission."salesPartnerId" = $1

            AND commission."status" =
              'AVAILABLE'

            AND commission."availableAt"
              IS NOT NULL

            AND commission."availableAt"
              <= NOW()
        `,
        [
          salesPartnerId,
        ],
      )

    const reservedRows =
      await this.dataSource.query(
        `
          SELECT
            COALESCE(
              SUM(
                item."amountUnits"::numeric
              ),
              0
            )::text AS "reservedUnits"

          FROM "sales_payout_item" item

          INNER JOIN "sales_payout" payout
            ON payout."id" =
              item."salesPayoutId"

          WHERE
            payout."salesPartnerId" = $1

            AND payout."status" IN (
              'PENDING',
              'PROCESSING'
            )
        `,
        [
          salesPartnerId,
        ],
      )

    const paidRows =
      await this.dataSource.query(
        `
          SELECT
            COALESCE(
              SUM(
                "amountCents"
              ),
              0
            )::text AS "paidCents"

          FROM "sales_payout"

          WHERE
            "salesPartnerId" = $1
            AND "status" = 'PAID'
        `,
        [
          salesPartnerId,
        ],
      )

    const payouts =
      await this.dataSource.query(
        `
          SELECT
            "id",
            "amountCents",
            "currency",
            "status",
            "requestedAt",
            "paidAt",
            "failedAt",
            "createdAt"

          FROM "sales_payout"

          WHERE
            "salesPartnerId" = $1

          ORDER BY
            "createdAt" DESC,
            "id" DESC

          LIMIT 50
        `,
        [
          salesPartnerId,
        ],
      )

    const commissions =
      await this.dataSource.query(
        `
          SELECT
            commission."id",
            commission."orderId",
            commission."businessId",
            business."storeCode",
            commission."commissionUnits",
            commission."status",
            commission."availableAt",
            commission."createdAt"

          FROM "sales_commission" commission

          LEFT JOIN "business" business
            ON business."id" =
              commission."businessId"

          WHERE
            commission."salesPartnerId" = $1

          ORDER BY
            commission."createdAt" DESC,
            commission."id" DESC

          LIMIT 50
        `,
        [
          salesPartnerId,
        ],
      )

    const summary =
      summaryRows[0] || {}

    const available =
      availableRows[0] || {}

    const reserved =
      reservedRows[0] || {}

    const paid =
      paidRows[0] || {}

    return {
      generatedAt:
        new Date()
          .toISOString(),

      currency:
        'usd',

      balances: {
        totalEarned:
          this.moneyFromUnits(
            summary
              .earnedUnits,
          ),

        pending:
          this.moneyFromUnits(
            summary
              .pendingUnits,
          ),

        available:
          this.moneyFromUnits(
            available
              .availableUnits,
          ),

        inPayout:
          this.moneyFromUnits(
            reserved
              .reservedUnits,
          ),

        totalPaid:
          this.moneyFromCents(
            paid
              .paidCents,
          ),
      },

      attributedRestaurants:
        restaurants.map(
          (row: any) => ({
            businessId:
              Number(
                row.businessId,
              ),

            storeCode:
              String(
                row.storeCode ||
                  '',
              ),

            attributedAt:
              row.attributedAt ||
              null,

            commissionBps:
              row.commissionBps ===
                null
                ? null
                : Number(
                    row
                      .commissionBps,
                  ),

            durationMode:
              row.durationMode ||
              null,

            durationMonths:
              row.durationMonths ===
                null
                ? null
                : Number(
                    row
                      .durationMonths,
                  ),

            commissionEndsAt:
              row.commissionEndsAt ||
              null,

            earned:
              this.moneyFromUnits(
                row.earnedUnits,
              ),
          }),
        ),

      recentCommissions:
        commissions.map(
          (row: any) => ({
            id:
              String(
                row.id,
              ),

            orderId:
              Number(
                row.orderId,
              ),

            businessId:
              Number(
                row.businessId,
              ),

            storeCode:
              row.storeCode ||
              null,

            status:
              String(
                row.status ||
                  '',
              ),

            availableAt:
              row.availableAt ||
              null,

            createdAt:
              row.createdAt,

            amount:
              this.moneyFromUnits(
                row
                  .commissionUnits,
              ),
          }),
        ),

      payouts:
        payouts.map(
          (row: any) => ({
            id:
              String(
                row.id,
              ),

            status:
              String(
                row.status ||
                  '',
              ),

            currency:
              String(
                row.currency ||
                  'usd',
              ),

            amount:
              this.moneyFromCents(
                row
                  .amountCents,
              ),

            requestedAt:
              row.requestedAt ||
              null,

            paidAt:
              row.paidAt ||
              null,

            failedAt:
              row.failedAt ||
              null,

            createdAt:
              row.createdAt,
          }),
        ),
    }
  }
}
