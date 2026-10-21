'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  apiFetch,
} from '../../lib/api'

const API =
  process.env.NEXT_PUBLIC_API_URL || ''

type Amount = {
  units?: string
  cents?: string
  amount: number
}

type MonthRow = {
  month: number
  label: string
  earned: Amount
  paid: Amount
}

type TaxPayout = {
  id: string
  amount: Amount
  currency: string
  status: string
  stripeTransferId?: string | null
  requestedAt?: string | null
  paidAt?: string | null
  createdAt?: string | null
}

type TaxSummary = {
  success?: boolean
  year: number
  currency: string
  generatedAt: string
  earned: Amount
  paid: Amount
  outstandingFromYear: Amount
  pending: Amount
  available: Amount
  inPayout: Amount
  paidAllocatedFromYear: Amount
  payoutCount: number
  months: MonthRow[]
  payouts: TaxPayout[]
  message?: string
}

function money(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value || 0),
  )
}

function dateLabel(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—'
  }

  return date.toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  )
}

export default function SalesTaxSummary() {
  const currentYear =
    new Date()
      .getUTCFullYear()

  const years =
    useMemo(
      () => {
        const startYear =
          2026

        const result: number[] =
          []

        for (
          let year =
            currentYear;
          year >= startYear;
          year -= 1
        ) {
          result.push(year)
        }

        return result
      },
      [
        currentYear,
      ],
    )

  const [
    year,
    setYear,
  ] =
    useState(
      currentYear,
    )

  const [
    data,
    setData,
  ] =
    useState<
      TaxSummary | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  async function load(
    requestedYear:
      number = year,
  ) {
    if (!API) {
      setError(
        'API is not configured.',
      )
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const response =
        (await apiFetch(
          `${API}/sales/tax-summary?year=${requestedYear}`,
        )) as TaxSummary

      if (
        response
          ?.success !==
        true
      ) {
        throw new Error(
          response
            ?.message ||
          'Tax summary could not be loaded.',
        )
      }

      setData(
        response,
      )
    } catch (
      err: any
    ) {
      setError(
        err?.message ||
        'Tax summary could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(
    () => {
      void load(year)
    },
    [year],
  )

  function downloadCsv() {
    if (!data) {
      return
    }

    const rows: string[][] =
      [
        [
          'CaviarQR Sales Partner Earnings Summary',
        ],
        [
          'Tax year',
          String(
            data.year,
          ),
        ],
        [
          'Earned',
          data.earned.amount.toFixed(
            2,
          ),
        ],
        [
          'Paid',
          data.paid.amount.toFixed(
            2,
          ),
        ],
        [
          'Outstanding from year',
          data
            .outstandingFromYear
            .amount
            .toFixed(
              2,
            ),
        ],
        [],
        [
          'Month',
          'Earned',
          'Paid',
        ],
        ...data.months.map(
          (month) => [
            month.label,
            month
              .earned
              .amount
              .toFixed(2),
            month
              .paid
              .amount
              .toFixed(2),
          ],
        ),
      ]

    const csv =
      rows
        .map(
          (row) =>
            row
              .map(
                (cell) =>
                  `"${String(
                    cell ?? '',
                  ).replace(
                    /"/g,
                    '""',
                  )}"`,
              )
              .join(','),
        )
        .join('\n')

    const blob =
      new Blob(
        [
          csv,
        ],
        {
          type:
            'text/csv;charset=utf-8',
        },
      )

    const url =
      URL.createObjectURL(
        blob,
      )

    const link =
      document.createElement(
        'a',
      )

    link.href =
      url

    link.download =
      `caviarqr-earnings-${data.year}.csv`

    document.body.appendChild(
      link,
    )

    link.click()
    link.remove()

    URL.revokeObjectURL(
      url,
    )
  }

  return (
    <section className="tax">
      <div className="top">
        <div>
          <div className="eyebrow">
            Earnings & Tax Summary
          </div>

          <h2>
            Your yearly commission records
          </h2>

          <p>
            Review commissions earned and
            payouts actually paid by CaviarQR.
          </p>
        </div>

        <div className="controls">
          <label>
            Tax year

            <select
              value={year}
              onChange={(
                event,
              ) => {
                setYear(
                  Number(
                    event
                      .target
                      .value,
                  ),
                )
              }}
            >
              {years.map(
                (
                  item,
                ) => (
                  <option
                    key={
                      item
                    }
                    value={
                      item
                    }
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              void load(
                year,
              )
            }
            disabled={
              loading
            }
          >
            {loading
              ? 'Loading…'
              : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={
              downloadCsv
            }
            disabled={
              !data
            }
          >
            Download CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="cards">
            <div className="card">
              <span>
                Earned in {data.year}
              </span>

              <strong>
                {money(
                  data
                    .earned
                    .amount,
                )}
              </strong>

              <small>
                Commission earned from
                eligible CaviarQR platform
                fees.
              </small>
            </div>

            <div className="card">
              <span>
                Paid in {data.year}
              </span>

              <strong>
                {money(
                  data
                    .paid
                    .amount,
                )}
              </strong>

              <small>
                Successful payout batches
                actually paid during this
                calendar year.
              </small>
            </div>

            <div className="card">
              <span>
                Outstanding
              </span>

              <strong>
                {money(
                  data
                    .outstandingFromYear
                    .amount,
                )}
              </strong>

              <small>
                Unpaid commission originally
                earned in {data.year}.
              </small>
            </div>

            <div className="card">
              <span>
                Payouts
              </span>

              <strong>
                {
                  data
                    .payoutCount
                }
              </strong>

              <small>
                Successful payout batches
                paid during {data.year}.
              </small>
            </div>
          </div>

          <div className="balanceGrid">
            <div>
              <span>Pending</span>
              <strong>
                {money(
                  data
                    .pending
                    .amount,
                )}
              </strong>
            </div>

            <div>
              <span>Available</span>
              <strong>
                {money(
                  data
                    .available
                    .amount,
                )}
              </strong>
            </div>

            <div>
              <span>In payout</span>
              <strong>
                {money(
                  data
                    .inPayout
                    .amount,
                )}
              </strong>
            </div>
          </div>

          <div className="section">
            <div className="sectionHead">
              <div>
                <h3>
                  Monthly earnings
                </h3>

                <p>
                  Earned commission versus
                  cash actually paid.
                </p>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Month
                    </th>
                    <th>
                      Earned
                    </th>
                    <th>
                      Paid
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.months.map(
                    (
                      month,
                    ) => (
                      <tr
                        key={
                          month
                            .month
                        }
                      >
                        <td>
                          {
                            month
                              .label
                          }
                        </td>

                        <td>
                          {money(
                            month
                              .earned
                              .amount,
                          )}
                        </td>

                        <td>
                          {money(
                            month
                              .paid
                              .amount,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <div className="sectionHead">
              <div>
                <h3>
                  Paid payout history
                </h3>

                <p>
                  Successful payouts for
                  {` ${data.year}`}.
                </p>
              </div>
            </div>

            {data.payouts.length ===
            0 ? (
              <div className="empty">
                No successful payouts were
                paid during {data.year}.
              </div>
            ) : (
              <div className="payoutList">
                {data.payouts.map(
                  (
                    payout,
                  ) => (
                    <div
                      className="payoutRow"
                      key={
                        payout.id
                      }
                    >
                      <div>
                        <strong>
                          Payout #
                          {payout.id}
                        </strong>

                        <small>
                          {dateLabel(
                            payout
                              .paidAt,
                          )}
                        </small>

                        {payout
                          .stripeTransferId && (
                          <small className="code">
                            {
                              payout
                                .stripeTransferId
                            }
                          </small>
                        )}
                      </div>

                      <div className="right">
                        <strong>
                          {money(
                            payout
                              .amount
                              .amount,
                          )}
                        </strong>

                        <span className="pill">
                          {
                            payout
                              .status
                          }
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="notice">
            This page is a CaviarQR payment
            and commission record. It is not
            tax advice and does not determine
            your final taxable income. Keep
            your own records and use the
            applicable tax forms and advice
            for your situation.
          </div>
        </>
      )}

      {!data &&
        loading && (
        <div className="empty">
          Loading earnings…
        </div>
      )}

      <style jsx>{`
        .tax {
          display: grid;
          gap: 20px;
          margin-top: 20px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: #fff;
        }

        .top,
        .sectionHead,
        .payoutRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }

        h2,
        h3,
        p {
          margin: 0;
        }

        h2 {
          margin-top: 5px;
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #475569;
        }

        .top p,
        .sectionHead p,
        small {
          color: #64748b;
        }

        .controls {
          display: flex;
          align-items: end;
          gap: 10px;
          flex-wrap: wrap;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 12px;
          color: #64748b;
        }

        select,
        button {
          min-height: 40px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
          padding: 0 12px;
          font: inherit;
        }

        button {
          cursor: pointer;
          font-weight: 700;
        }

        button:disabled {
          cursor: default;
          opacity: .55;
        }

        .cards {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(180px, 1fr)
            );
          gap: 12px;
        }

        .card,
        .section,
        .balanceGrid {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }

        .card {
          padding: 18px;
          display: grid;
          gap: 7px;
        }

        .card span,
        .balanceGrid span {
          color: #64748b;
          font-size: 13px;
        }

        .card strong {
          font-size: 25px;
        }

        .balanceGrid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          overflow: hidden;
        }

        .balanceGrid > div {
          padding: 16px 18px;
          display: grid;
          gap: 5px;
          border-right:
            1px solid #e2e8f0;
        }

        .balanceGrid > div:last-child {
          border-right: 0;
        }

        .section {
          overflow: hidden;
        }

        .sectionHead {
          padding: 18px;
          border-bottom:
            1px solid #e2e8f0;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px 18px;
          border-bottom:
            1px solid #f1f5f9;
          text-align: left;
          white-space: nowrap;
        }

        th {
          font-size: 12px;
          color: #64748b;
          background: #f8fafc;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .payoutList {
          display: grid;
        }

        .payoutRow {
          padding: 15px 18px;
          border-bottom:
            1px solid #f1f5f9;
        }

        .payoutRow:last-child {
          border-bottom: 0;
        }

        .payoutRow > div {
          display: grid;
          gap: 4px;
        }

        .right {
          text-align: right;
          justify-items: end;
        }

        .pill {
          display: inline-flex;
          width: fit-content;
          padding: 3px 8px;
          border-radius: 999px;
          background: #f1f5f9;
          font-size: 11px;
          font-weight: 800;
        }

        .code {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          word-break: break-all;
        }

        .notice,
        .error,
        .empty {
          padding: 16px;
          border-radius: 12px;
        }

        .notice {
          background: #f8fafc;
          color: #475569;
          font-size: 13px;
        }

        .error {
          background: #fef2f2;
          color: #991b1b;
        }

        .empty {
          color: #64748b;
          background: #f8fafc;
        }

        @media (
          max-width: 720px
        ) {
          .tax {
            padding: 16px;
          }

          .top,
          .sectionHead,
          .payoutRow {
            align-items: flex-start;
            flex-direction: column;
          }

          .controls {
            width: 100%;
          }

          .balanceGrid {
            grid-template-columns: 1fr;
          }

          .balanceGrid > div {
            border-right: 0;
            border-bottom:
              1px solid #e2e8f0;
          }

          .balanceGrid > div:last-child {
            border-bottom: 0;
          }

          .right {
            text-align: left;
            justify-items: start;
          }
        }
      `}</style>
    </section>
  )
}
