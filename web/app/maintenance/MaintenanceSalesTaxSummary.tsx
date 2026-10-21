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

type Partner = {
  id: number
  email: string
  legalName: string
  displayName?: string | null
  referralCode: string
  status: string
  earned: Amount
  paid: Amount
  outstandingFromYear: Amount
  payoutCount: number
}

type MonthRow = {
  month: number
  label: string
  earned: Amount
  paid: Amount
}

type Payout = {
  id: string
  salesPartnerId: number
  partnerName: string
  email: string
  amount: Amount
  currency: string
  status: string
  stripeTransferId?: string | null
  paidAt?: string | null
}

type Summary = {
  success?: boolean
  year: number
  currency: string
  generatedAt: string

  totals: {
    earned: Amount
    paid: Amount
    outstandingFromYear: Amount
    partnerCount: number
    partnersPaid: number
  }

  months: MonthRow[]
  partners: Partner[]
  payouts: Payout[]
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

export default function MaintenanceSalesTaxSummary() {
  const currentYear =
    new Date()
      .getUTCFullYear()

  const years =
    useMemo(
      () => {
        const result: number[] =
          []

        for (
          let year =
            currentYear;
          year >= 2026;
          year -= 1
        ) {
          result.push(
            year,
          )
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
      Summary | null
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
          `${API}/maintenance/sales-tax-summary?year=${requestedYear}`,
        )) as Summary

      if (
        response
          ?.success !==
        true
      ) {
        throw new Error(
          response
            ?.message ||
          'Commission expense records could not be loaded.',
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
        'Commission expense records could not be loaded.',
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
          'CaviarQR Sales Partner Commission Records',
        ],
        [
          'Tax year',
          String(
            data.year,
          ),
        ],
        [
          'Total earned',
          data
            .totals
            .earned
            .amount
            .toFixed(2),
        ],
        [
          'Total paid',
          data
            .totals
            .paid
            .amount
            .toFixed(2),
        ],
        [
          'Outstanding',
          data
            .totals
            .outstandingFromYear
            .amount
            .toFixed(2),
        ],
        [],
        [
          'Sales partner',
          'Email',
          'Referral code',
          'Earned',
          'Paid',
          'Outstanding',
          'Payout count',
        ],
        ...data.partners.map(
          (partner) => [
            partner
              .displayName ||
            partner
              .legalName,
            partner.email,
            partner
              .referralCode,
            partner
              .earned
              .amount
              .toFixed(2),
            partner
              .paid
              .amount
              .toFixed(2),
            partner
              .outstandingFromYear
              .amount
              .toFixed(2),
            String(
              partner
                .payoutCount,
            ),
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
      `caviarqr-sales-commission-expenses-${data.year}.csv`

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
    <section className="taxOps">
      <div className="head">
        <div>
          <span className="kicker">
            Business expenses
          </span>

          <h3>
            Sales Partner Commissions
          </h3>

          <p>
            Tax-year records for commissions
            earned and payouts actually paid.
          </p>
        </div>

        <div className="actions">
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
                    value={
                      item
                    }
                    key={
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
            disabled={
              !data
            }
            onClick={
              downloadCsv
            }
          >
            Export CSV
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
            <div className="metric">
              <span>
                Commission earned
              </span>

              <strong>
                {money(
                  data
                    .totals
                    .earned
                    .amount,
                )}
              </strong>

              <small>
                Earned by reps from
                {` ${data.year} `}
                eligible transactions.
              </small>
            </div>

            <div className="metric">
              <span>
                Commission paid
              </span>

              <strong>
                {money(
                  data
                    .totals
                    .paid
                    .amount,
                )}
              </strong>

              <small>
                Cash actually paid through
                successful payout batches
                during {data.year}.
              </small>
            </div>

            <div className="metric">
              <span>
                Outstanding
              </span>

              <strong>
                {money(
                  data
                    .totals
                    .outstandingFromYear
                    .amount,
                )}
              </strong>

              <small>
                Currently unpaid commission
                originating from {data.year}.
              </small>
            </div>

            <div className="metric">
              <span>
                Reps paid
              </span>

              <strong>
                {
                  data
                    .totals
                    .partnersPaid
                }
              </strong>

              <small>
                of{' '}
                {
                  data
                    .totals
                    .partnerCount
                }{' '}
                Sales Partner accounts.
              </small>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div>
                <h4>
                  By Sales Partner
                </h4>

                <p>
                  Individual annual earnings,
                  cash paid, and outstanding
                  commission.
                </p>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Sales rep</th>
                    <th>Earned</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Payouts</th>
                  </tr>
                </thead>

                <tbody>
                  {data.partners.map(
                    (
                      partner,
                    ) => (
                      <tr
                        key={
                          partner.id
                        }
                      >
                        <td>
                          <strong>
                            {partner
                              .displayName ||
                              partner
                                .legalName}
                          </strong>

                          <small className="block">
                            {
                              partner
                                .email
                            }
                          </small>
                        </td>

                        <td>
                          {money(
                            partner
                              .earned
                              .amount,
                          )}
                        </td>

                        <td>
                          {money(
                            partner
                              .paid
                              .amount,
                          )}
                        </td>

                        <td>
                          {money(
                            partner
                              .outstandingFromYear
                              .amount,
                          )}
                        </td>

                        <td>
                          {
                            partner
                              .payoutCount
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panelHead">
              <div>
                <h4>
                  Monthly expense record
                </h4>

                <p>
                  Commission earned versus
                  successful cash payouts.
                </p>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Earned</th>
                    <th>Paid</th>
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

          <div className="panel">
            <div className="panelHead">
              <div>
                <h4>
                  Successful payout audit trail
                </h4>

                <p>
                  Stripe references for
                  completed Sales Partner
                  payout batches.
                </p>
              </div>
            </div>

            {data.payouts.length ===
            0 ? (
              <div className="empty">
                No successful payouts in
                {` ${data.year}`}.
              </div>
            ) : (
              <div className="payouts">
                {data.payouts.map(
                  (
                    payout,
                  ) => (
                    <div
                      className="payout"
                      key={
                        payout.id
                      }
                    >
                      <div>
                        <strong>
                          {
                            payout
                              .partnerName
                          }
                        </strong>

                        <small>
                          Payout #
                          {payout.id}
                          {' · '}
                          {dateLabel(
                            payout
                              .paidAt,
                          )}
                        </small>

                        {payout
                          .stripeTransferId && (
                          <small className="code">
                            Stripe:{' '}
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

          <div className="note">
            “Paid” is based on successful
            payout records. Accounting and
            tax treatment can depend on
            CaviarQR’s accounting method and
            applicable tax rules, so this is
            an internal financial record
            rather than a tax return.
          </div>
        </>
      )}

      {!data &&
        loading && (
        <div className="empty">
          Loading commission expense
          records…
        </div>
      )}

      <style jsx>{`
        .taxOps {
          display: grid;
          gap: 16px;
          margin-bottom: 20px;
          padding: 20px;
          border: 1px solid #dbe3ee;
          border-radius: 20px;
          background: #fff;
        }

        .head,
        .panelHead,
        .payout {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        h3,
        h4,
        p {
          margin: 0;
        }

        h3 {
          margin-top: 5px;
        }

        .kicker {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #64748b;
        }

        .head p,
        .panelHead p,
        small {
          color: #64748b;
        }

        .actions {
          display: flex;
          align-items: end;
          flex-wrap: wrap;
          gap: 10px;
        }

        label {
          display: grid;
          gap: 5px;
          font-size: 12px;
          color: #64748b;
        }

        select,
        button {
          height: 40px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
          font: inherit;
        }

        button {
          cursor: pointer;
          font-weight: 700;
        }

        button:disabled {
          opacity: .55;
          cursor: default;
        }

        .cards {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 12px;
        }

        .metric,
        .panel {
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #fff;
        }

        .metric {
          padding: 16px;
          display: grid;
          gap: 6px;
        }

        .metric > span {
          color: #64748b;
          font-size: 12px;
        }

        .metric > strong {
          font-size: 23px;
        }

        .panel {
          overflow: hidden;
        }

        .panelHead {
          padding: 16px 18px;
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
          padding: 12px 16px;
          border-bottom:
            1px solid #f1f5f9;
          text-align: left;
          white-space: nowrap;
        }

        th {
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .block {
          display: block;
          margin-top: 3px;
        }

        .payouts {
          display: grid;
        }

        .payout {
          padding: 14px 18px;
          border-bottom:
            1px solid #f1f5f9;
        }

        .payout:last-child {
          border-bottom: 0;
        }

        .payout > div {
          display: grid;
          gap: 4px;
        }

        .right {
          text-align: right;
          justify-items: end;
        }

        .code {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          word-break: break-all;
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

        .note,
        .error,
        .empty {
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
        }

        .note,
        .empty {
          background: #f8fafc;
          color: #475569;
        }

        .error {
          background: #fef2f2;
          color: #991b1b;
        }

        @media (
          max-width: 1050px
        ) {
          .cards {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (
          max-width: 700px
        ) {
          .head,
          .panelHead,
          .payout {
            align-items: flex-start;
            flex-direction: column;
          }

          .cards {
            grid-template-columns: 1fr;
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
