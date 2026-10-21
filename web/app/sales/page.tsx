'use client'

import SalesTaxSummary from './SalesTaxSummary'

import {
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  apiFetch,
  clearSalesPartnerToken,
  getSalesPartnerToken,
} from '@/lib/api'

import SalesLedgerDashboard from './SalesLedgerDashboard'

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/+$/, '')

type Partner = {
  id: number
  email: string
  legalName: string
  displayName: string | null
  phone: string | null
  countryCode: string
  referralCode: string
  commissionBps: number
  hardwareDiscountBps: number
  status: string
  stripeConnected: boolean
  stripeDetailsSubmitted: boolean
  stripePayoutsEnabled: boolean
  stripeAccountReady: boolean
  stripeLastCheckedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

type StripeStatus = {
  connected: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
  transfersCapability:
    | 'active'
    | 'inactive'
    | 'pending'
    | null
  ready: boolean
  disabledReason: string | null
  currentlyDue: string[]
  message: string | null
}

export default function SalesDashboardPage() {
  const router =
    useRouter()

  const [
    partner,
    setPartner,
  ] =
    useState<Partner | null>(
      null,
    )

  const [
    stripeStatus,
    setStripeStatus,
  ] =
    useState<StripeStatus | null>(
      null,
    )

  const [loading, setLoading] =
    useState(true)

  const [action, setAction] =
    useState<
      '' |
      'refresh' |
      'onboarding' |
      'dashboard'
    >('')

  const [error, setError] =
    useState('')

  async function loadDashboard(
    showRefreshState = false,
  ) {
    const token =
      getSalesPartnerToken()

    if (!token) {
      router.replace(
        '/sales/login',
      )
      return
    }

    if (showRefreshState) {
      setAction('refresh')
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const me: any =
        await apiFetch(
          `${API}/sales/me`,
        )

      if (!me?.success) {
        setError(
          me?.message ||
            'Could not load your Sales Partner account.',
        )
        return
      }

      setPartner(
        me.partner,
      )

      const stripe: any =
        await apiFetch(
          `${API}/sales/stripe/status`,
        )

      /*
       * GET /sales/stripe/status returns the
       * SalesStripeStatus object directly.
       * It intentionally has no `success`
       * wrapper, unlike signup/login and
       * Stripe action endpoints.
       */
      if (
        typeof stripe?.connected !==
          'boolean' ||
        typeof stripe
          ?.detailsSubmitted !==
          'boolean' ||
        typeof stripe
          ?.payoutsEnabled !==
          'boolean' ||
        typeof stripe?.ready !==
          'boolean' ||
        !Array.isArray(
          stripe?.currentlyDue,
        )
      ) {
        setError(
          'Could not load Stripe payout status.',
        )
        return
      }

      setStripeStatus({
        connected:
          Boolean(
            stripe.connected,
          ),

        detailsSubmitted:
          Boolean(
            stripe.detailsSubmitted,
          ),

        payoutsEnabled:
          Boolean(
            stripe.payoutsEnabled,
          ),

        transfersCapability:
          stripe.transfersCapability ??
          null,

        ready:
          Boolean(
            stripe.ready,
          ),

        disabledReason:
          stripe.disabledReason ??
          null,

        currentlyDue:
          Array.isArray(
            stripe.currentlyDue,
          )
            ? stripe.currentlyDue
            : [],

        message:
          stripe.message ??
          null,
      })
    } catch {
      setError(
        'Could not load your Sales Partner dashboard.',
      )
    } finally {
      setLoading(false)

      if (
        showRefreshState
      ) {
        setAction('')
      }
    }
  }

  useEffect(() => {
    void loadDashboard()
    // Initial authenticated load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectStripe() {
    if (action) {
      return
    }

    setAction(
      'onboarding',
    )

    setError('')

    try {
      const result: any =
        await apiFetch(
          `${API}/sales/stripe/onboarding`,
          {
            method:
              'POST',
          },
        )

      if (
        !result?.success ||
        typeof result?.url !==
          'string' ||
        !result.url
      ) {
        setError(
          result?.message ||
            'Could not start Stripe onboarding.',
        )

        return
      }

      window.location.assign(
        result.url,
      )
    } catch {
      setError(
        'Could not start Stripe onboarding.',
      )
    } finally {
      setAction('')
    }
  }

  async function openStripeDashboard() {
    if (action) {
      return
    }

    setAction(
      'dashboard',
    )

    setError('')

    try {
      const result: any =
        await apiFetch(
          `${API}/sales/stripe/dashboard`,
          {
            method:
              'POST',
          },
        )

      if (
        !result?.success ||
        typeof result?.url !==
          'string' ||
        !result.url
      ) {
        setError(
          result?.message ||
            'Could not open the Stripe payout dashboard.',
        )

        return
      }

      window.location.assign(
        result.url,
      )
    } catch {
      setError(
        'Could not open the Stripe payout dashboard.',
      )
    } finally {
      setAction('')
    }
  }

  function signOut() {
    clearSalesPartnerToken()

    router.replace(
      '/sales/login',
    )
  }

  const commissionPercent =
    partner
      ? (
          Number(
            partner
              .commissionBps ||
            0,
          ) / 100
        )
          .toFixed(2)
          .replace(
            /\.00$/,
            '',
          )
      : '0'

  const hardwareDiscountPercent =
    partner
      ? (
          Number(
            partner
              .hardwareDiscountBps ||
            0,
          ) / 100
        )
          .toFixed(2)
          .replace(
            /\.00$/,
            '',
          )
      : '0'

  const displayName =
    partner
      ? (
          partner
            .displayName ||
          partner
            .legalName
        )
      : ''

  return (
    <main className="page">
      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7f7f8;
          color: #111113;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .topbar {
          height: 62px;
          box-sizing: border-box;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #fff;
          border-bottom: 1px solid #e4e4e7;
        }

        .brand {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.4px;
        }

        .signout {
          border: 1px solid #d4d4d8;
          border-radius: 9px;
          padding: 8px 12px;
          background: #fff;
          color: #111113;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .wrap {
          width: calc(100% - 40px);
          max-width: 1060px;
          margin: 0 auto;
          padding: 34px 0 60px;
        }

        .heading {
          margin-bottom: 24px;
        }

        h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          letter-spacing: -0.6px;
        }

        .email {
          margin-top: 6px;
          color: #71717a;
          font-size: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 14px;
        }

        .card {
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 15px;
          padding: 20px;
        }

        .label {
          margin-bottom: 8px;
          color: #71717a;
          font-size: 12px;
        }

        .value {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.4px;
        }

        .code {
          overflow-wrap: anywhere;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          font-size: 19px;
        }

        .pill {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #f4f4f5;
          font-size: 12px;
          font-weight: 700;
        }

        .wide {
          margin-top: 14px;
        }

        .stripe-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
        }

        .message {
          max-width: 650px;
          margin-top: 6px;
          color: #71717a;
          font-size: 13px;
          line-height: 1.55;
        }

        .status-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 10px;
        }

        .status-item {
          padding: 12px;
          border-radius: 10px;
          background: #fafafa;
        }

        .status-name {
          color: #71717a;
          font-size: 11px;
        }

        .status-value {
          margin-top: 5px;
          font-size: 13px;
          font-weight: 600;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .primary,
        .secondary {
          padding: 10px 14px;
          border-radius: 10px;
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary {
          border: 0;
          background: #111113;
          color: #fff;
        }

        .secondary {
          border: 1px solid #d4d4d8;
          background: #fff;
          color: #111113;
        }

        .primary:disabled,
        .secondary:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .notice {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fffbeb;
          color: #92400e;
          font-size: 13px;
          line-height: 1.55;
        }

        .error {
          margin-bottom: 14px;
          padding: 11px 13px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        .loading {
          color: #71717a;
          font-size: 14px;
        }

        @media (
          max-width: 760px
        ) {
          .grid,
          .status-grid {
            grid-template-columns:
              1fr;
          }

          .stripe-head {
            flex-direction: column;
          }

          .wrap {
            width:
              calc(100% - 28px);
          }

          .topbar {
            padding: 0 14px;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          CaviarQR · Sales Partner
        </div>

        <button
          className="signout"
          onClick={signOut}
        >
          Sign out
        </button>
      </header>

      <div className="wrap">
        {loading ? (
          <div className="loading">
            Loading Sales Partner dashboard…
          </div>
        ) : !partner ? (
          <div className="error">
            {error ||
              'Sales Partner account unavailable.'}
          </div>
        ) : (
          <>
            <div className="heading">
              <h1>
                {displayName}
              </h1>

              <div className="email">
                {partner.email}
              </div>
            </div>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <div className="grid">
              <section className="card">
                <div className="label">
                  Partner status
                </div>

                <div className="pill">
                  {partner.status}
                </div>
              </section>

              <section className="card">
                <div className="label">
                  Referral code
                </div>

                <div className="value code">
                  {
                    partner
                      .referralCode
                  }
                </div>
              </section>

              <section className="card">
                <div className="label">
                  Commission rate
                </div>

                <div className="value">
                  {commissionPercent}%
                </div>

                <div className="message">
                  of eligible CaviarQR
                  platform fees
                </div>
              </section>
            </div>

            <section className="card wide">
              <div className="label">
                Hardware referral discount
              </div>

              <div className="value">
                {
                  hardwareDiscountPercent
                }%
              </div>

              <div className="message">
                This rate is controlled by
                CaviarQR and may remain 0%
                until a promotion is enabled.
              </div>
            </section>

            <section className="card wide">
              <div className="stripe-head">
                <div>
                  <h2>
                    Stripe payout account
                  </h2>

                  <div className="message">
                    {
                      stripeStatus
                        ?.message ||
                      (
                        stripeStatus
                          ?.ready
                          ? 'Your Stripe payout account is ready.'
                          : 'Complete Stripe verification before commissions can be paid.'
                      )
                    }
                  </div>
                </div>

                <div className="pill">
                  {
                    stripeStatus
                      ?.ready
                      ? 'READY'
                      : stripeStatus
                          ?.connected
                        ? 'CONNECTED'
                        : 'NOT CONNECTED'
                  }
                </div>
              </div>

              <div className="status-grid">
                <div className="status-item">
                  <div className="status-name">
                    Connected
                  </div>

                  <div className="status-value">
                    {
                      stripeStatus
                        ?.connected
                        ? 'Yes'
                        : 'No'
                    }
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-name">
                    Details submitted
                  </div>

                  <div className="status-value">
                    {
                      stripeStatus
                        ?.detailsSubmitted
                        ? 'Yes'
                        : 'No'
                    }
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-name">
                    Payouts enabled
                  </div>

                  <div className="status-value">
                    {
                      stripeStatus
                        ?.payoutsEnabled
                        ? 'Yes'
                        : 'No'
                    }
                  </div>
                </div>

                <div className="status-item">
                  <div className="status-name">
                    Transfers
                  </div>

                  <div className="status-value">
                    {
                      stripeStatus
                        ?.transfersCapability ||
                      'Not enabled'
                    }
                  </div>
                </div>
              </div>

              {Boolean(
                stripeStatus
                  ?.currentlyDue
                  ?.length,
              ) && (
                <div className="notice">
                  Stripe still requires:{' '}
                  {
                    stripeStatus!
                      .currentlyDue
                      .join(', ')
                  }
                </div>
              )}

              {stripeStatus
                ?.disabledReason && (
                <div className="notice">
                  Stripe status:{' '}
                  {
                    stripeStatus
                      .disabledReason
                  }
                </div>
              )}

              <div className="actions">
                {!stripeStatus
                  ?.ready && (
                  <button
                    className="primary"
                    disabled={
                      Boolean(action)
                    }
                    onClick={() => {
                      void connectStripe()
                    }}
                  >
                    {
                      action ===
                      'onboarding'
                        ? 'Opening Stripe…'
                        : stripeStatus
                            ?.connected
                          ? 'Continue Stripe setup'
                          : 'Connect Stripe'
                    }
                  </button>
                )}

                {stripeStatus
                  ?.connected && (
                  <button
                    className="secondary"
                    disabled={
                      Boolean(action)
                    }
                    onClick={() => {
                      void openStripeDashboard()
                    }}
                  >
                    {
                      action ===
                      'dashboard'
                        ? 'Opening…'
                        : 'Open Stripe dashboard'
                    }
                  </button>
                )}

                <button
                  className="secondary"
                  disabled={
                    Boolean(action)
                  }
                  onClick={() => {
                    void loadDashboard(
                      true,
                    )
                  }}
                >
                  {
                    action ===
                    'refresh'
                      ? 'Refreshing…'
                      : 'Refresh status'
                  }
                </button>
              </div>
            </section>
            <SalesLedgerDashboard />
            <SalesTaxSummary />
          </>
        )}
      </div>
    </main>
  )
}
