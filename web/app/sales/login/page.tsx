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

export default function SalesLoginPage() {
  const router =
    useRouter()

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  useEffect(() => {
    if (
      getSalesPartnerToken()
    ) {
      router.replace('/sales')
    }
  }, [router])

  async function handleLogin() {
    if (loading) {
      return
    }

    const cleanEmail =
      email.trim().toLowerCase()

    if (
      !cleanEmail ||
      !password
    ) {
      setError(
        'Email and password are required.',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      const result: any =
        await apiFetch(
          `${API}/sales/login`,
          {
            method: 'POST',

            body: JSON.stringify({
              email:
                cleanEmail,

              password,
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
            'Sign in failed.',
        )
        return
      }

      setSalesPartnerToken(
        result.token,
      )

      router.replace('/sales')
    } catch {
      setError(
        'Unable to sign in right now.',
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
          background: #f7f7f8;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          color: #111113;
        }

        .card {
          width: 100%;
          max-width: 390px;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 20px;
          padding: 30px;
          box-shadow:
            0 12px 35px
            rgba(0, 0, 0, 0.05);
        }

        .brand {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.7px;
        }

        h1 {
          margin: 24px 0 4px;
          font-size: 20px;
        }

        .sub {
          margin: 0 0 22px;
          font-size: 14px;
          color: #71717a;
        }

        .field {
          margin-bottom: 12px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
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

        .forgot {
          margin-top: -2px;
          margin-bottom: 14px;
          text-align: right;
          font-size: 13px;
        }

        .login {
          width: 100%;
          margin-top: 5px;
          padding: 12px;
          border: 0;
          border-radius: 11px;
          background: #111113;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .login:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .error {
          margin-top: 12px;
          padding: 10px;
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
      `}</style>

      <section className="card">
        <div className="brand">
          CaviarQR
        </div>

        <h1>
          Sales Partner
        </h1>

        <p className="sub">
          Sign in to your partner account.
        </p>

        <div className="field">
          <label htmlFor="sales-email">
            Email
          </label>

          <input
            id="sales-email"
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

        <div className="field">
          <label htmlFor="sales-password">
            Password
          </label>

          <input
            id="sales-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={loading}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                'Enter'
              ) {
                void handleLogin()
              }
            }}
          />
        </div>

        <div className="forgot">
          <a href="/sales/forgot">
            Forgot password?
          </a>
        </div>

        <button
          className="login"
          disabled={loading}
          onClick={() => {
            void handleLogin()
          }}
        >
          {loading
            ? 'Signing in…'
            : 'Sign in'}
        </button>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="footer">
          New to CaviarQR?{' '}
          <a href="/sales/signup">
            Apply as a Sales Partner
          </a>
        </div>
      </section>
    </main>
  )
}
