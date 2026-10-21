'use client'

import {
  useState,
} from 'react'

import {
  apiFetch,
} from '@/lib/api'

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/+$/, '')

export default function SalesForgotPage() {
  const [email, setEmail] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  async function submit() {
    if (loading) {
      return
    }

    const cleanEmail =
      email.trim().toLowerCase()

    if (
      !cleanEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(cleanEmail)
    ) {
      setError(
        'Enter a valid email address.',
      )
      return
    }

    setLoading(true)
    setMessage('')
    setError('')

    try {
      const result: any =
        await apiFetch(
          `${API}/sales/forgot-password`,
          {
            method: 'POST',
            body:
              JSON.stringify({
                email:
                  cleanEmail,
              }),
          },
        )

      setMessage(
        result?.message ||
          'If a Sales Partner account exists for this email, a reset link has been sent.',
      )
    } catch {
      setError(
        'Unable to request a password reset right now.',
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
          margin-top: 14px;
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

        .message,
        .error {
          margin-top: 14px;
          padding: 11px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.45;
        }

        .message {
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
          Forgot password?
        </h1>

        <p className="sub">
          Enter the email associated with your
          Sales Partner account.
        </p>

        <label htmlFor="sales-forgot-email">
          Email
        </label>

        <input
          id="sales-forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={loading}
          onChange={(event) =>
            setEmail(
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

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void submit()
          }}
        >
          {loading
            ? 'Sending…'
            : 'Send reset link'}
        </button>

        {message && (
          <div className="message">
            {message}
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
