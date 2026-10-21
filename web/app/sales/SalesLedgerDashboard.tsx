'use client'

import {
  useEffect,
  useState,
} from 'react'

import {
  apiFetch,
} from '@/lib/api'

const API = (
  process.env
    .NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(
  /\/+$/,
  '',
)

type ExactMoney = {
  units?: string
  wholeCents?: string
  residualUnits?: string
  cents?: string
  display: string
}

type Restaurant = {
  businessId: number
  storeCode: string
  attributedAt: string | null
  commissionBps: number | null
  durationMode: string | null
  durationMonths: number | null
  commissionEndsAt: string | null
  earned: ExactMoney
}

type Commission = {
  id: string
  orderId: number
  businessId: number
  storeCode: string | null
  status: string
  availableAt: string | null
  createdAt: string
  amount: ExactMoney
}

type Payout = {
  id: string
  status: string
  currency: string
  amount: ExactMoney
  requestedAt: string | null
  paidAt: string | null
  failedAt: string | null
  createdAt: string
}

type Dashboard = {
  generatedAt: string
  currency: string
  balances: {
    totalEarned: ExactMoney
    pending: ExactMoney
    available: ExactMoney
    inPayout: ExactMoney
    totalPaid: ExactMoney
  }
  attributedRestaurants: Restaurant[]
  recentCommissions: Commission[]
  payouts: Payout[]
}

function dateLabel(
  value: string | null,
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

  return date.toLocaleDateString()
}

export default function SalesLedgerDashboard() {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<Dashboard | null>(
      null,
    )

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

  async function load() {
    setLoading(true)
    setError('')

    const result: any =
      await apiFetch(
        `${API}/sales/dashboard`,
      )

    if (!result?.success) {
      setError(
        result?.message ||
          'Could not load commission dashboard.',
      )

      setLoading(false)
      return
    }

    setDashboard(
      result as Dashboard,
    )

    setLoading(false)
  }

  useEffect(
    () => {
      void load()
    },
    [],
  )

  if (loading) {
    return (
      <section className="ledger">
        <div className="empty">
          Loading commission activity…
        </div>

        <style jsx>{styles}</style>
      </section>
    )
  }

  if (
    error ||
    !dashboard
  ) {
    return (
      <section className="ledger">
        <div className="error">
          {
            error ||
            'Commission dashboard unavailable.'
          }
        </div>

        <button
          className="refresh"
          onClick={() => {
            void load()
          }}
        >
          Try again
        </button>

        <style jsx>{styles}</style>
      </section>
    )
  }

  const restaurants =
    dashboard
      .attributedRestaurants ||
    []

  const payouts =
    dashboard.payouts ||
    []

  const commissions =
    dashboard
      .recentCommissions ||
    []

  return (
    <section className="ledger">
      <div className="header">
        <div>
          <h2>
            Commission dashboard
          </h2>

          <p>
            Real CaviarQR ledger data
          </p>
        </div>

        <button
          className="refresh"
          onClick={() => {
            void load()
          }}
        >
          Refresh earnings
        </button>
      </div>

      <div className="cards">
        <div className="card">
          <span>
            Total earned
          </span>
          <strong>
            {
              dashboard
                .balances
                .totalEarned
                .display
            }
          </strong>
        </div>

        <div className="card">
          <span>
            Pending
          </span>
          <strong>
            {
              dashboard
                .balances
                .pending
                .display
            }
          </strong>
          <small>
            Includes commissions
            still in the maturation
            period.
          </small>
        </div>

        <div className="card">
          <span>
            Available
          </span>
          <strong>
            {
              dashboard
                .balances
                .available
                .display
            }
          </strong>
          <small>
            Eligible for a future
            payout batch.
          </small>
        </div>

        <div className="card">
          <span>
            In payout
          </span>
          <strong>
            {
              dashboard
                .balances
                .inPayout
                .display
            }
          </strong>
        </div>

        <div className="card">
          <span>
            Total paid
          </span>
          <strong>
            {
              dashboard
                .balances
                .totalPaid
                .display
            }
          </strong>
        </div>
      </div>

      <div className="section">
        <div className="sectionTitle">
          <div>
            <h3>
              Attributed restaurants
            </h3>
            <p>
              {
                restaurants.length
              } restaurant
              {
                restaurants.length ===
                1
                  ? ''
                  : 's'
              }
            </p>
          </div>
        </div>

        {restaurants.length ===
        0 ? (
          <div className="empty">
            No restaurants have
            been attributed to your
            Sales Partner account
            yet.
          </div>
        ) : (
          <div className="list">
            {restaurants.map(
              (restaurant) => (
                <div
                  className="row"
                  key={
                    restaurant
                      .businessId
                  }
                >
                  <div>
                    <strong>
                      {
                        restaurant
                          .storeCode
                      }
                    </strong>

                    <small>
                      Attributed{' '}
                      {
                        dateLabel(
                          restaurant
                            .attributedAt,
                        )
                      }
                    </small>
                  </div>

                  <div className="right">
                    <strong>
                      {
                        restaurant
                          .earned
                          .display
                      }
                    </strong>

                    <small>
                      {
                        restaurant
                          .durationMode ===
                        'ONGOING'
                          ? 'Ongoing'
                          : restaurant
                              .durationMonths
                            ? `${restaurant.durationMonths} months`
                            : 'Fixed term'
                      }
                    </small>

                    {restaurant
                      .commissionEndsAt && (
                      <small>
                        Ends{' '}
                        {
                          dateLabel(
                            restaurant
                              .commissionEndsAt,
                          )
                        }
                      </small>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="section">
        <div className="sectionTitle">
          <div>
            <h3>
              Recent commissions
            </h3>
            <p>
              Actual ledger entries
            </p>
          </div>
        </div>

        {commissions.length ===
        0 ? (
          <div className="empty">
            No commission earnings
            have been recorded yet.
          </div>
        ) : (
          <div className="list">
            {commissions.map(
              (commission) => (
                <div
                  className="row"
                  key={
                    commission.id
                  }
                >
                  <div>
                    <strong>
                      {
                        commission
                          .storeCode ||
                        `Restaurant #${commission.businessId}`
                      }
                    </strong>

                    <small>
                      Order #
                      {
                        commission
                          .orderId
                      }{' '}
                      ·{' '}
                      {
                        dateLabel(
                          commission
                            .createdAt,
                        )
                      }
                    </small>
                  </div>

                  <div className="right">
                    <strong>
                      {
                        commission
                          .amount
                          .display
                      }
                    </strong>

                    <span className="pill">
                      {
                        commission
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

      <div className="section">
        <div className="sectionTitle">
          <div>
            <h3>
              Payout history
            </h3>
            <p>
              Completed and attempted
              payout batches
            </p>
          </div>
        </div>

        {payouts.length ===
        0 ? (
          <div className="empty">
            No payouts yet.
          </div>
        ) : (
          <div className="list">
            {payouts.map(
              (payout) => (
                <div
                  className="row"
                  key={
                    payout.id
                  }
                >
                  <div>
                    <strong>
                      Payout #
                      {
                        payout.id
                      }
                    </strong>

                    <small>
                      {
                        dateLabel(
                          payout
                            .paidAt ||
                          payout
                            .requestedAt ||
                          payout
                            .createdAt,
                        )
                      }
                    </small>
                  </div>

                  <div className="right">
                    <strong>
                      {
                        payout
                          .amount
                          .display
                      }
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

      <style jsx>{styles}</style>
    </section>
  )
}

const styles = `
  .ledger {
    display: grid;
    gap: 20px;
    margin-top: 20px;
  }

  .header,
  .sectionTitle,
  .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  .header p,
  .sectionTitle p,
  small {
    color: #64748b;
  }

  .cards {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(150px, 1fr)
      );
    gap: 12px;
  }

  .card,
  .section {
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: white;
  }

  .card {
    padding: 18px;
    display: grid;
    gap: 6px;
  }

  .card span {
    color: #64748b;
    font-size: 13px;
  }

  .card strong {
    font-size: 24px;
  }

  .section {
    padding: 18px;
  }

  .list {
    display: grid;
    margin-top: 14px;
  }

  .row {
    padding: 14px 0;
    border-top:
      1px solid #eef2f7;
  }

  .row:first-child {
    border-top: 0;
  }

  .row > div {
    display: grid;
    gap: 4px;
  }

  .right {
    text-align: right;
    justify-items: end;
  }

  .empty {
    margin-top: 12px;
    padding: 16px;
    border-radius: 12px;
    background: #f8fafc;
    color: #64748b;
  }

  .error {
    padding: 16px;
    border-radius: 12px;
    background: #fff1f2;
    color: #be123c;
  }

  .refresh {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: white;
    padding: 9px 12px;
    cursor: pointer;
    font-weight: 600;
  }

  .pill {
    display: inline-flex;
    width: fit-content;
    border-radius: 999px;
    background: #f1f5f9;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
  }

  @media (max-width: 640px) {
    .header,
    .sectionTitle,
    .row {
      align-items: flex-start;
    }

    .row {
      flex-direction: column;
    }

    .right {
      text-align: left;
      justify-items: start;
    }
  }
`
