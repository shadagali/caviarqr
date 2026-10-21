'use client'

import {
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  apiFetch,
  getSalesPartnerToken,
  setSalesPartnerToken,
} from '@/lib/api'

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/+$/, '')

type SalesAgreement = {
  title: string
  agreementVersion: string
  effectiveDate: string
  agreementHash: string
  text: string
}

export default function SalesSignupPage() {
  const router =
    useRouter()

  const [legalName, setLegalName] =
    useState('')

  const [displayName, setDisplayName] =
    useState('')

  const [phone, setPhone] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [
    agreementAccepted,
    setAgreementAccepted,
  ] =
    useState(false)

  const [
    agreement,
    setAgreement,
  ] =
    useState<SalesAgreement | null>(
      null,
    )

  const [
    agreementLoading,
    setAgreementLoading,
  ] =
    useState(true)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  useEffect(() => {
    if (
      getSalesPartnerToken()
    ) {
      router.replace('/sales')
      return
    }

    let active = true

    async function loadAgreement() {
      try {
        const response =
          await fetch(
            `${API}/sales/agreement`,
          )

        if (!response.ok) {
          throw new Error(
            'Agreement unavailable.',
          )
        }

        const data =
          await response.json()

        if (
          !data ||
          typeof data.title !==
            'string' ||
          typeof data.agreementVersion !==
            'string' ||
          typeof data.agreementHash !==
            'string' ||
          typeof data.text !==
            'string'
        ) {
          throw new Error(
            'Invalid agreement response.',
          )
        }

        if (active) {
          setAgreement(data)
        }
      } catch {
        if (active) {
          setError(
            'The Sales Partner Agreement could not be loaded.',
          )
        }
      } finally {
        if (active) {
          setAgreementLoading(
            false,
          )
        }
      }
    }

    void loadAgreement()

    return () => {
      active = false
    }
  }, [router])

  const agreementIsDraft =
    Boolean(
      agreement &&
      (
        agreement
          .agreementVersion
          .toLowerCase()
          .startsWith('draft-') ||
        agreement
          .title
          .toUpperCase()
          .includes('DRAFT')
      ),
    )

  async function handleSignup() {
    if (
      loading ||
      agreementLoading ||
      !agreement
    ) {
      return
    }

    if (agreementIsDraft) {
      setError(
        'Sales Partner enrollment is not open until the agreement is finalized.',
      )
      return
    }

    const cleanLegalName =
      legalName.trim()

    const cleanDisplayName =
      displayName.trim()

    const cleanPhone =
      phone.trim()

    const cleanEmail =
      email.trim().toLowerCase()

    if (
      !cleanLegalName ||
      !cleanEmail ||
      !password
    ) {
      setError(
        'Legal name, email and password are required.',
      )
      return
    }

    if (
      password.length < 8
    ) {
      setError(
        'Password must be at least 8 characters.',
      )
      return
    }

    if (!agreementAccepted) {
      setError(
        'You must accept the Independent Sales Partner Agreement.',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      const result: any =
        await apiFetch(
          `${API}/sales/signup`,
          {
            method: 'POST',

            body: JSON.stringify({
              legalName:
                cleanLegalName,

              displayName:
                cleanDisplayName ||
                undefined,

              phone:
                cleanPhone ||
                undefined,

              email:
                cleanEmail,

              password,

              agreementAccepted:
                true,

              agreementVersion:
                agreement
                  .agreementVersion,
            }),
          },
        )

      if (
        !result?.success ||
        typeof result?.token !==
          'string' ||
        !result.token.trim()
      ) {
        setError(
          result?.message ||
            'Account creation failed.',
        )
        return
      }

      setSalesPartnerToken(
        result.token,
      )

      router.replace('/sales')
    } catch {
      setError(
        'Unable to create your account right now.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <style jsx>{`
        .page {
          min-height: 100vh;
          box-sizing: border-box;
          background: #f7f7f8;
          padding: 40px 20px 60px;
          color: #111113;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .card {
          width: 100%;
          max-width: 540px;
          box-sizing: border-box;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 20px;
          padding: 30px;
          box-shadow:
            0 10px 32px
            rgba(0,0,0,0.04);
        }

        .brand {
          font-size: 25px;
          font-weight: 700;
          letter-spacing: -0.6px;
        }

        h1 {
          margin: 22px 0 5px;
          font-size: 22px;
        }

        .sub {
          margin: 0 0 24px;
          color: #71717a;
          font-size: 14px;
          line-height: 1.55;
        }

        .grid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 13px;
        }

        .full {
          grid-column: 1 / -1;
        }

        .label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="password"] {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #d4d4d8;
          border-radius: 10px;
          background: #fff;
          color: #111113;
          font: inherit;
          outline: none;
        }

        input:focus {
          border-color: #71717a;
        }

        .agreement {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          background: #fafafa;
          font-size: 13px;
          line-height: 1.55;
        }

        .agreement-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .agreement-row input {
          width: 17px;
          height: 17px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .draft {
          margin-bottom: 13px;
          padding: 10px 12px;
          border-radius: 9px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 12px;
          line-height: 1.5;
        }

        .primary {
          width: 100%;
          margin-top: 18px;
          padding: 12px;
          border: 0;
          border-radius: 11px;
          background: #111113;
          color: #fff;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }

        .primary:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .error {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 9px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        .footer {
          margin-top: 20px;
          text-align: center;
          color: #71717a;
          font-size: 13px;
        }

        a {
          color: #111113;
          font-weight: 600;
        }

        @media (max-width: 600px) {
          .grid {
            grid-template-columns:
              1fr;
          }

          .full {
            grid-column: auto;
          }

          .card {
            padding: 22px;
          }
        }
      `}</style>

      <section className="card">
        <div className="brand">
          CaviarQR
        </div>

        <h1>
          Become a Sales Partner
        </h1>

        <p className="sub">
          Create your independent
          CaviarQR Sales Partner account.
        </p>

        <div className="grid">
          <div>
            <label
              className="label"
              htmlFor="legal-name"
            >
              Legal name
            </label>

            <input
              id="legal-name"
              type="text"
              autoComplete="name"
              value={legalName}
              disabled={loading}
              onChange={(event) =>
                setLegalName(
                  event.target.value,
                )
              }
            />
          </div>

          <div>
            <label
              className="label"
              htmlFor="display-name"
            >
              Display name
            </label>

            <input
              id="display-name"
              type="text"
              value={displayName}
              disabled={loading}
              onChange={(event) =>
                setDisplayName(
                  event.target.value,
                )
              }
            />
          </div>

          <div>
            <label
              className="label"
              htmlFor="phone"
            >
              Phone
            </label>

            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              disabled={loading}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
            />
          </div>

          <div>
            <label
              className="label"
              htmlFor="email"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={loading}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="full">
            <label
              className="label"
              htmlFor="password"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={loading}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
            />
          </div>
        </div>

        <div className="agreement">
          {agreementLoading ? (
            <div>
              Loading agreement…
            </div>
          ) : agreement ? (
            <>
              {agreementIsDraft && (
                <div className="draft">
                  The agreement is still
                  marked DRAFT. New Sales
                  Partner enrollment is
                  disabled until it is
                  finalized.
                </div>
              )}

              <div className="agreement-row">
                <input
                  id="agreement"
                  type="checkbox"
                  checked={
                    agreementAccepted
                  }
                  disabled={
                    loading ||
                    agreementIsDraft
                  }
                  onChange={(event) =>
                    setAgreementAccepted(
                      event.target.checked,
                    )
                  }
                />

                <label htmlFor="agreement">
                  I have reviewed and accept
                  the{' '}
                  <a
                    href="/sales/agreement"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Independent Sales Partner
                    Agreement
                  </a>
                  {' '}version{' '}
                  {
                    agreement
                      .agreementVersion
                  }.
                </label>
              </div>
            </>
          ) : (
            <div>
              Agreement unavailable.
            </div>
          )}
        </div>

        <button
          className="primary"
          disabled={
            loading ||
            agreementLoading ||
            !agreement ||
            !agreementAccepted ||
            agreementIsDraft
          }
          onClick={() => {
            void handleSignup()
          }}
        >
          {loading
            ? 'Creating account…'
            : 'Create Sales Partner Account'}
        </button>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="footer">
          Already have an account?{' '}
          <a href="/sales/login">
            Sign in
          </a>
        </div>
      </section>
    </main>
  )
}
