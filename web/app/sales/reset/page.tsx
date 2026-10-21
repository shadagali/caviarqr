'use client'

import {
  Suspense,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'next/navigation'

import {
  apiFetch,
} from '@/lib/api'

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/+$/, '')

function SalesResetContent() {
  const params =
    useSearchParams()

  const token =
    params.get('token') || ''

  const [password, setPassword] =
    useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('')

  const [loading, setLoading] =
    useState(false)

  const [success, setSuccess] =
    useState(false)

  const [error, setError] =
    useState('')

  async function submit() {
    if (loading) {
      return
    }

    if (!token) {
      setError(
        'This reset link is invalid or missing.',
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

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match.',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      await apiFetch(
        `${API}/sales/reset-password`,
        {
          method: 'POST',

          body:
            JSON.stringify({
              token,
              password,
            }),
        },
      )

      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError(
        'This reset link is invalid or expired. Request a new reset link.',
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
          margin: 24px 0 6px;
          font-size: 20px;
        }

        .sub {
          margin: 0 0 22px;
          color: #71717a;
          font-size: 14px;
          line-height: 1.5;
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
          font: inherit;
          outline: none;
        }

        button {
          width: 100%;
          margin-top: 4px;
          padding: 12px;
          border: 0;
          border-radius: 11px;
          background: #111113;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .success,
        .error {
          margin-top: 14px;
          padding: 11px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.45;
        }

        .success {
          background: #f0fdf4;
          color: #166534;
        }

        .error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .back {
          margin-top: 20px;
          text-align: center;
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
          Reset password
        </h1>

        <p className="sub">
          Create a new password for your
          Sales Partner account.
        </p>

        {!success && (
          <>
            <div className="field">
              <label htmlFor="new-password">
                New password
              </label>

              <input
                id="new-password"
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

            <div className="field">
              <label htmlFor="confirm-password">
                Confirm password
              </label>

              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                disabled={loading}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    void submit()
                  }
                }}
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void submit()
              }}
            >
              {loading
                ? 'Updating…'
                : 'Reset password'}
            </button>
          </>
        )}

        {success && (
          <div className="success">
            Password updated successfully.
            You can now sign in with your new password.
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="back">
          <a href="/sales/login">
            Back to Sales Partner login
          </a>
        </div>
      </section>
    </main>
  )
}

export default function SalesResetPage() {
  return (
    <Suspense
      fallback={
        <div>
          Loading…
        </div>
      }
    >
      <SalesResetContent />
    </Suspense>
  )
}
