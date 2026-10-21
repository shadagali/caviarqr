'use client'

import {
  useEffect,
  useState,
} from 'react'

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

export default function SalesAgreementPage() {
  const [
    agreement,
    setAgreement,
  ] =
    useState<SalesAgreement | null>(
      null,
    )

  const [error, setError] =
    useState('')

  useEffect(() => {
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
          typeof data.text !==
            'string' ||
          typeof data.agreementVersion !==
            'string' ||
          typeof data.agreementHash !==
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
      }
    }

    void loadAgreement()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="page">
      <style jsx>{`
        .page {
          min-height: 100vh;
          box-sizing: border-box;
          background: #f7f7f8;
          padding: 40px 20px 64px;
          color: #111113;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .wrap {
          width: 100%;
          max-width: 850px;
          margin: 0 auto;
        }

        .header {
          margin-bottom: 20px;
        }

        .brand {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.4px;
        }

        .back {
          display: inline-block;
          margin-top: 10px;
          color: #52525b;
          font-size: 13px;
          text-decoration: none;
        }

        .back:hover {
          text-decoration: underline;
        }

        .card {
          box-sizing: border-box;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 18px;
          padding: 32px;
          box-shadow:
            0 8px 28px
            rgba(0, 0, 0, 0.04);
        }

        h1 {
          margin: 0 0 8px;
          font-size: 26px;
          line-height: 1.25;
          letter-spacing: -0.5px;
        }

        .meta {
          margin-bottom: 28px;
          color: #71717a;
          font-size: 12px;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .draft {
          margin-bottom: 24px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 13px;
          line-height: 1.5;
        }

        .agreement {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.72;
        }

        .loading {
          color: #71717a;
          font-size: 14px;
        }

        .error {
          padding: 12px 14px;
          border-radius: 10px;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 13px;
        }

        @media (max-width: 600px) {
          .page {
            padding:
              24px 14px 48px;
          }

          .card {
            padding: 22px;
          }

          h1 {
            font-size: 22px;
          }
        }
      `}</style>

      <div className="wrap">
        <header className="header">
          <div className="brand">
            CaviarQR
          </div>

          <a
            className="back"
            href="/sales/signup"
          >
            ← Back to Sales Partner signup
          </a>
        </header>

        <section className="card">
          {error ? (
            <div className="error">
              {error}
            </div>
          ) : !agreement ? (
            <div className="loading">
              Loading agreement…
            </div>
          ) : (
            <>
              <h1>
                {agreement.title}
              </h1>

              <div className="meta">
                Version:{' '}
                {
                  agreement
                    .agreementVersion
                }
                <br />

                Effective date:{' '}
                {
                  agreement
                    .effectiveDate
                }
                <br />

                SHA-256:{' '}
                {
                  agreement
                    .agreementHash
                }
              </div>

              {(
                agreement
                  .agreementVersion
                  .toLowerCase()
                  .startsWith(
                    'draft-',
                  ) ||
                agreement
                  .title
                  .toUpperCase()
                  .includes('DRAFT')
              ) && (
                <div className="draft">
                  This agreement is currently
                  marked DRAFT and is not yet
                  enabled for production Sales
                  Partner enrollment.
                </div>
              )}

              <pre className="agreement">
                {agreement.text}
              </pre>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
