import {
  BadRequestException,
  Injectable,
} from '@nestjs/common'

import {
  DataSource,
} from 'typeorm'

const UNITS_PER_DOLLAR =
  1_000_000

@Injectable()
export class SalesTaxReportService {
  constructor(
    private readonly dataSource:
      DataSource,
  ) {}

  private yearBounds(
    value?: unknown,
  ) {
    const currentYear =
      new Date()
        .getUTCFullYear()

    const year =
      value === undefined ||
      value === null ||
      String(value).trim() === ''
        ? currentYear
        : Number(value)

    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > currentYear + 1
    ) {
      throw new BadRequestException(
        'Tax year must be a valid calendar year.',
      )
    }

    return {
      year,

      start:
        new Date(
          Date.UTC(
            year,
            0,
            1,
          ),
        ).toISOString(),

      end:
        new Date(
          Date.UTC(
            year + 1,
            0,
            1,
          ),
        ).toISOString(),
    }
  }

  private big(
    value: unknown,
  ): bigint {
    try {
      return BigInt(
        String(
          value ?? '0',
        ),
      )
    } catch {
      return 0n
    }
  }

  private units(
    value: unknown,
  ) {
    const units =
      this.big(value)

    return {
      units:
        units.toString(),

      amount:
        Number(units) /
        UNITS_PER_DOLLAR,
    }
  }

  private cents(
    value: unknown,
  ) {
    const cents =
      this.big(value)

    return {
      cents:
        cents.toString(),

      amount:
        Number(cents) /
        100,
    }
  }

  private months(
    earnedRows: any[],
    paidRows: any[],
  ) {
    const earned =
      new Map<
        number,
        bigint
      >()

    const paid =
      new Map<
        number,
        bigint
      >()

    for (
      const row of
      earnedRows
    ) {
      earned.set(
        Number(row.month),
        this.big(
          row.units,
        ),
      )
    }

    for (
      const row of
      paidRows
    ) {
      paid.set(
        Number(row.month),
        this.big(
          row.cents,
        ),
      )
    }

    const labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    return labels.map(
      (
        label,
        index,
      ) => ({
        month:
          index + 1,

        label,

        earned:
          this.units(
            earned.get(
              index + 1,
            ) ??
            0n,
          ),

        paid:
          this.cents(
            paid.get(
              index + 1,
            ) ??
            0n,
          ),
      }),
    )
  }

  async partnerSummary(
    salesPartnerId: number,
    requestedYear?: unknown,
  ) {
    const {
      year,
      start,
      end,
    } =
      this.yearBounds(
        requestedYear,
      )

    const [
      ledgerRows,
      paidRows,
      earnedMonthly,
      paidMonthly,
      payouts,
    ] =
      await Promise.all([
        this.dataSource.query(
          `
          WITH selected AS (
            SELECT
              c.id,
              c.status,
              c."commissionUnits"::numeric
                AS units
            FROM
              "sales_commission" c
            WHERE
              c."salesPartnerId" = $1
              AND c."earnedAt" >=
                $2::timestamptz
              AND c."earnedAt" <
                $3::timestamptz
              AND c.status NOT IN (
                'REVERSED',
                'INELIGIBLE'
              )
          ),

          allocation AS (
            SELECT
              i."salesCommissionId"
                AS "commissionId",

              COALESCE(
                SUM(
                  CASE
                    WHEN p.status IN (
                      'PENDING',
                      'PROCESSING',
                      'PAID'
                    )
                    THEN
                      i."amountUnits"::numeric
                    ELSE 0
                  END
                ),
                0
              ) AS allocated,

              COALESCE(
                SUM(
                  CASE
                    WHEN p.status IN (
                      'PENDING',
                      'PROCESSING'
                    )
                    THEN
                      i."amountUnits"::numeric
                    ELSE 0
                  END
                ),
                0
              ) AS active_units,

              COALESCE(
                SUM(
                  CASE
                    WHEN p.status =
                      'PAID'
                    THEN
                      i."amountUnits"::numeric
                    ELSE 0
                  END
                ),
                0
              ) AS paid_units

            FROM
              "sales_payout_item" i

            JOIN
              "sales_payout" p
              ON p.id =
                i."salesPayoutId"

            JOIN
              selected s
              ON s.id =
                i."salesCommissionId"

            GROUP BY
              i."salesCommissionId"
          )

          SELECT
            COALESCE(
              SUM(s.units),
              0
            )::text
              AS "earnedUnits",

            COALESCE(
              SUM(
                CASE
                  WHEN s.status =
                    'PENDING'
                  THEN s.units
                  ELSE 0
                END
              ),
              0
            )::text
              AS "pendingUnits",

            COALESCE(
              SUM(
                CASE
                  WHEN s.status =
                    'AVAILABLE'
                  THEN GREATEST(
                    s.units -
                      COALESCE(
                        a.allocated,
                        0
                      ),
                    0
                  )
                  ELSE 0
                END
              ),
              0
            )::text
              AS "availableUnits",

            COALESCE(
              SUM(
                COALESCE(
                  a.active_units,
                  0
                )
              ),
              0
            )::text
              AS "inPayoutUnits",

            COALESCE(
              SUM(
                COALESCE(
                  a.paid_units,
                  0
                )
              ),
              0
            )::text
              AS "paidAllocatedUnits",

            COALESCE(
              SUM(
                GREATEST(
                  s.units -
                    COALESCE(
                      a.paid_units,
                      0
                    ),
                  0
                )
              ),
              0
            )::text
              AS "outstandingUnits"

          FROM
            selected s

          LEFT JOIN
            allocation a
            ON a."commissionId" =
              s.id
          `,
          [
            salesPartnerId,
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            COUNT(*)::int
              AS "payoutCount",

            COALESCE(
              SUM(
                p."amountCents"::bigint
              ),
              0
            )::text
              AS "paidCents"

          FROM
            "sales_payout" p

          WHERE
            p."salesPartnerId" = $1
            AND p.status =
              'PAID'
            AND p."paidAt" >=
              $2::timestamptz
            AND p."paidAt" <
              $3::timestamptz
          `,
          [
            salesPartnerId,
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            EXTRACT(
              MONTH FROM
                c."earnedAt"
            )::int
              AS month,

            COALESCE(
              SUM(
                c."commissionUnits"::numeric
              ),
              0
            )::text
              AS units

          FROM
            "sales_commission" c

          WHERE
            c."salesPartnerId" = $1
            AND c."earnedAt" >=
              $2::timestamptz
            AND c."earnedAt" <
              $3::timestamptz
            AND c.status NOT IN (
              'REVERSED',
              'INELIGIBLE'
            )

          GROUP BY 1
          ORDER BY 1
          `,
          [
            salesPartnerId,
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            EXTRACT(
              MONTH FROM
                p."paidAt"
            )::int
              AS month,

            COALESCE(
              SUM(
                p."amountCents"::bigint
              ),
              0
            )::text
              AS cents

          FROM
            "sales_payout" p

          WHERE
            p."salesPartnerId" = $1
            AND p.status =
              'PAID'
            AND p."paidAt" >=
              $2::timestamptz
            AND p."paidAt" <
              $3::timestamptz

          GROUP BY 1
          ORDER BY 1
          `,
          [
            salesPartnerId,
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            p.id::text AS id,
            p."amountCents",
            p.currency,
            p.status,
            p."stripeTransferId",
            p."requestedAt",
            p."paidAt",
            p."createdAt"

          FROM
            "sales_payout" p

          WHERE
            p."salesPartnerId" = $1
            AND p.status =
              'PAID'
            AND p."paidAt" >=
              $2::timestamptz
            AND p."paidAt" <
              $3::timestamptz

          ORDER BY
            p."paidAt" DESC,
            p.id DESC

          LIMIT 100
          `,
          [
            salesPartnerId,
            start,
            end,
          ],
        ),
      ])

    const ledger =
      ledgerRows?.[0] ??
      {}

    const paid =
      paidRows?.[0] ??
      {}

    return {
      success: true,
      year,
      currency:
        'USD',

      generatedAt:
        new Date()
          .toISOString(),

      earned:
        this.units(
          ledger
            .earnedUnits,
        ),

      paid:
        this.cents(
          paid
            .paidCents,
        ),

      outstandingFromYear:
        this.units(
          ledger
            .outstandingUnits,
        ),

      pending:
        this.units(
          ledger
            .pendingUnits,
        ),

      available:
        this.units(
          ledger
            .availableUnits,
        ),

      inPayout:
        this.units(
          ledger
            .inPayoutUnits,
        ),

      paidAllocatedFromYear:
        this.units(
          ledger
            .paidAllocatedUnits,
        ),

      payoutCount:
        Number(
          paid
            .payoutCount ??
          0,
        ),

      months:
        this.months(
          earnedMonthly,
          paidMonthly,
        ),

      payouts:
        payouts.map(
          (
            row: any,
          ) => ({
            id:
              String(
                row.id,
              ),

            amount:
              this.cents(
                row
                  .amountCents,
              ),

            currency:
              String(
                row.currency ||
                'usd',
              )
                .toUpperCase(),

            status:
              String(
                row.status ||
                '',
              ),

            stripeTransferId:
              row
                .stripeTransferId ||
              null,

            requestedAt:
              row
                .requestedAt ||
              null,

            paidAt:
              row
                .paidAt ||
              null,

            createdAt:
              row
                .createdAt ||
              null,
          }),
        ),
    }
  }

  async maintenanceSummary(
    requestedYear?: unknown,
  ) {
    const {
      year,
      start,
      end,
    } =
      this.yearBounds(
        requestedYear,
      )

    const [
      partnerRows,
      earnedMonthly,
      paidMonthly,
      payouts,
    ] =
      await Promise.all([
        this.dataSource.query(
          `
          WITH selected AS (
            SELECT
              c.id,
              c."salesPartnerId",
              c."commissionUnits"::numeric
                AS units

            FROM
              "sales_commission" c

            WHERE
              c."earnedAt" >=
                $1::timestamptz
              AND c."earnedAt" <
                $2::timestamptz
              AND c.status NOT IN (
                'REVERSED',
                'INELIGIBLE'
              )
          ),

          earned AS (
            SELECT
              s."salesPartnerId",
              SUM(s.units)
                AS earned_units

            FROM
              selected s

            GROUP BY
              s."salesPartnerId"
          ),

          paid_allocation AS (
            SELECT
              s."salesPartnerId",

              COALESCE(
                SUM(
                  i."amountUnits"::numeric
                ),
                0
              ) AS paid_units

            FROM
              selected s

            JOIN
              "sales_payout_item" i
              ON i."salesCommissionId" =
                s.id

            JOIN
              "sales_payout" p
              ON p.id =
                i."salesPayoutId"
              AND p.status =
                'PAID'

            GROUP BY
              s."salesPartnerId"
          ),

          cash_paid AS (
            SELECT
              p."salesPartnerId",

              COALESCE(
                SUM(
                  p."amountCents"::bigint
                ),
                0
              ) AS paid_cents,

              COUNT(*)::int
                AS payout_count

            FROM
              "sales_payout" p

            WHERE
              p.status =
                'PAID'
              AND p."paidAt" >=
                $1::timestamptz
              AND p."paidAt" <
                $2::timestamptz

            GROUP BY
              p."salesPartnerId"
          )

          SELECT
            sp.id,
            sp.email,
            sp."legalName",
            sp."displayName",
            sp."referralCode",
            sp.status,

            COALESCE(
              e.earned_units,
              0
            )::text
              AS "earnedUnits",

            COALESCE(
              pa.paid_units,
              0
            )::text
              AS "paidAllocatedUnits",

            COALESCE(
              cp.paid_cents,
              0
            )::text
              AS "paidCents",

            COALESCE(
              cp.payout_count,
              0
            )::int
              AS "payoutCount"

          FROM
            "sales_partner" sp

          LEFT JOIN
            earned e
            ON e."salesPartnerId" =
              sp.id

          LEFT JOIN
            paid_allocation pa
            ON pa."salesPartnerId" =
              sp.id

          LEFT JOIN
            cash_paid cp
            ON cp."salesPartnerId" =
              sp.id

          ORDER BY
            LOWER(
              COALESCE(
                sp."displayName",
                sp."legalName",
                sp.email
              )
            ),
            sp.id
          `,
          [
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            EXTRACT(
              MONTH FROM
                c."earnedAt"
            )::int
              AS month,

            COALESCE(
              SUM(
                c."commissionUnits"::numeric
              ),
              0
            )::text
              AS units

          FROM
            "sales_commission" c

          WHERE
            c."earnedAt" >=
              $1::timestamptz
            AND c."earnedAt" <
              $2::timestamptz
            AND c.status NOT IN (
              'REVERSED',
              'INELIGIBLE'
            )

          GROUP BY 1
          ORDER BY 1
          `,
          [
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            EXTRACT(
              MONTH FROM
                p."paidAt"
            )::int
              AS month,

            COALESCE(
              SUM(
                p."amountCents"::bigint
              ),
              0
            )::text
              AS cents

          FROM
            "sales_payout" p

          WHERE
            p.status =
              'PAID'
            AND p."paidAt" >=
              $1::timestamptz
            AND p."paidAt" <
              $2::timestamptz

          GROUP BY 1
          ORDER BY 1
          `,
          [
            start,
            end,
          ],
        ),

        this.dataSource.query(
          `
          SELECT
            p.id::text AS id,
            p."salesPartnerId",
            sp.email,
            sp."legalName",
            sp."displayName",
            p."amountCents",
            p.currency,
            p.status,
            p."stripeTransferId",
            p."paidAt"

          FROM
            "sales_payout" p

          JOIN
            "sales_partner" sp
            ON sp.id =
              p."salesPartnerId"

          WHERE
            p.status =
              'PAID'
            AND p."paidAt" >=
              $1::timestamptz
            AND p."paidAt" <
              $2::timestamptz

          ORDER BY
            p."paidAt" DESC,
            p.id DESC

          LIMIT 200
          `,
          [
            start,
            end,
          ],
        ),
      ])

    let totalEarnedUnits =
      0n

    let totalPaidCents =
      0n

    let totalOutstandingUnits =
      0n

    const partners =
      partnerRows.map(
        (
          row: any,
        ) => {
          const earnedUnits =
            this.big(
              row
                .earnedUnits,
            )

          const paidAllocatedUnits =
            this.big(
              row
                .paidAllocatedUnits,
            )

          const paidCents =
            this.big(
              row
                .paidCents,
            )

          const outstandingUnits =
            earnedUnits >
            paidAllocatedUnits
              ? earnedUnits -
                paidAllocatedUnits
              : 0n

          totalEarnedUnits +=
            earnedUnits

          totalPaidCents +=
            paidCents

          totalOutstandingUnits +=
            outstandingUnits

          return {
            id:
              Number(
                row.id,
              ),

            email:
              String(
                row.email ||
                '',
              ),

            legalName:
              String(
                row.legalName ||
                '',
              ),

            displayName:
              row.displayName ||
              null,

            referralCode:
              String(
                row.referralCode ||
                '',
              ),

            status:
              String(
                row.status ||
                '',
              ),

            earned:
              this.units(
                earnedUnits,
              ),

            paid:
              this.cents(
                paidCents,
              ),

            outstandingFromYear:
              this.units(
                outstandingUnits,
              ),

            payoutCount:
              Number(
                row
                  .payoutCount ??
                0,
              ),
          }
        },
      )

    return {
      success: true,
      year,
      currency:
        'USD',

      generatedAt:
        new Date()
          .toISOString(),

      totals: {
        earned:
          this.units(
            totalEarnedUnits,
          ),

        paid:
          this.cents(
            totalPaidCents,
          ),

        outstandingFromYear:
          this.units(
            totalOutstandingUnits,
          ),

        partnerCount:
          partners.length,

        partnersPaid:
          partners.filter(
            (
              partner: any,
            ) =>
              partner
                .paid
                .amount > 0,
          ).length,
      },

      months:
        this.months(
          earnedMonthly,
          paidMonthly,
        ),

      partners,

      payouts:
        payouts.map(
          (
            row: any,
          ) => ({
            id:
              String(
                row.id,
              ),

            salesPartnerId:
              Number(
                row
                  .salesPartnerId,
              ),

            partnerName:
              row.displayName ||
              row.legalName ||
              row.email,

            email:
              row.email,

            amount:
              this.cents(
                row
                  .amountCents,
              ),

            currency:
              String(
                row.currency ||
                'usd',
              )
                .toUpperCase(),

            status:
              String(
                row.status ||
                '',
              ),

            stripeTransferId:
              row
                .stripeTransferId ||
              null,

            paidAt:
              row
                .paidAt ||
              null,
          }),
        ),
    }
  }
}
