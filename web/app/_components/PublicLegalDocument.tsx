'use client'

import {
  useEffect,
  useState,
} from 'react'

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'
).replace(/\/+$/, '')

type LegalDocumentType =
  | 'TERMS'
  | 'PRIVACY'

type LegalDocument = {
  documentType: LegalDocumentType
  title: string
  version: string
  effectiveDate: string
  contentHash: string
  requiresReacceptance: boolean
  publishedAt: string | null
  content: string
}

export default function PublicLegalDocument({
  documentType,
  fallbackTitle,
}: {
  documentType: LegalDocumentType
  fallbackTitle: string
}) {
  const [
    document,
    setDocument,
  ] =
    useState<LegalDocument | null>(
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

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError('')

        const response =
          await fetch(
            `${API}/legal/${documentType}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

        if (!response.ok) {
          throw new Error(
            'Legal document unavailable.',
          )
        }

        const data =
          await response.json()

        if (
          !data ||
          typeof data.title !==
            'string' ||
          typeof data.version !==
            'string' ||
          typeof data.contentHash !==
            'string' ||
          typeof data.content !==
            'string'
        ) {
          throw new Error(
            'Invalid legal document response.',
          )
        }

        if (active) {
          setDocument(data)
        }
      } catch {
        if (active) {
          setError(
            `${fallbackTitle} is currently unavailable.`,
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [
    documentType,
    fallbackTitle,
  ])

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

        .content {
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
          line-height: 1.5;
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
            href="/"
          >
            ← Back to CaviarQR
          </a>
        </header>

        <section className="card">
          {loading ? (
            <div className="loading">
              Loading {fallbackTitle}…
            </div>
          ) : error ? (
            <div className="error">
              {error}
            </div>
          ) : document ? (
            <>
              <h1>
                {document.title}
              </h1>

              <div className="meta">
                Version:{' '}
                {document.version}
                <br />

                Effective date:{' '}
                {
                  document
                    .effectiveDate
                }
                <br />

                SHA-256:{' '}
                {
                  document
                    .contentHash
                }
              </div>

              <pre className="content">
                {document.content}
              </pre>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
