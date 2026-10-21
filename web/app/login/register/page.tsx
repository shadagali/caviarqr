'use client'

import {
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:4101'

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    --bg: #f5f5f7;
    --white: #ffffff;
    --border: rgba(0,0,0,0.09);
    --border-focus: #1d1d1f;
    --text: #1d1d1f;
    --text2: #6e6e73;
    --text3: #aeaeb2;
    --accent: #1d1d1f;
    --accent-hover: #3a3a3c;
    --red: #ff3b30;
    --font: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --shadow: 0 2px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04);
    --radius: 14px;
    --radius-sm: 10px;
  }

  .reg-page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    padding: 24px;
  }

  .reg-card {
    background: var(--white);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    padding: 36px 32px 32px;
    width: 100%;
    max-width: 380px;
  }

  .reg-mark {
    width: 44px;
    height: 44px;
    background: var(--text);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    margin: 0 auto 20px;
  }

  .reg-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    text-align: center;
    letter-spacing: -0.5px;
    margin-bottom: 4px;
  }

  .reg-sub {
    font-size: 13.5px;
    color: var(--text2);
    text-align: center;
    margin-bottom: 28px;
  }

  .reg-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .reg-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .reg-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.1px;
  }

  .reg-input {
    background: #f5f5f7;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 13px;
    font-size: 14px;
    color: var(--text);
    font-family: var(--font);
    outline: none;
    transition: all 0.15s;
    width: 100%;
    -webkit-appearance: none;
  }

  .reg-input:focus {
    border-color: var(--border-focus);
    background: white;
    box-shadow: 0 0 0 3px rgba(29,29,31,0.1);
  }

  .reg-input::placeholder {
    color: var(--text3);
  }

  .reg-btn {
    width: 100%;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 11px;
    font-size: 14.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: -0.1px;
    margin-bottom: 14px;
  }

  .reg-btn:hover {
    background: var(--accent-hover);
  }

  .reg-btn:active {
    transform: scale(0.99);
  }

  .reg-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .reg-error {
    font-size: 12.5px;
    color: var(--red);
    text-align: center;
    background: rgba(255,59,48,0.07);
    border-radius: 8px;
    padding: 8px 12px;
    margin-top: 4px;
  }

  .reg-footer {
    text-align: center;
    font-size: 12.5px;
    color: var(--text3);
    margin-top: 20px;
  }

  .reg-footer a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
  }

  .reg-divider {
    height: 1px;
    background: var(--border);
    margin: 20px 0;
  }
`

export default function RegisterPage() {
  const router = useRouter()

  const [storeCode, setStoreCode] =
    useState('')

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [termsAccepted, setTermsAccepted] =
    useState(false)

  const [
    termsVersion,
    setTermsVersion,
  ] =
    useState('')

  const [
    privacyVersion,
    setPrivacyVersion,
  ] =
    useState('')

  const [
    legalLoading,
    setLegalLoading,
  ] =
    useState(true)

  const [
    legalError,
    setLegalError,
  ] =
    useState('')

  useEffect(() => {
    let active = true

    async function loadLegalVersions() {
      try {
        setLegalLoading(true)
        setLegalError('')

        const [
          termsResponse,
          privacyResponse,
        ] =
          await Promise.all([
            fetch(
              `${API}/legal/TERMS`,
              {
                cache:
                  'no-store',
              },
            ),

            fetch(
              `${API}/legal/PRIVACY`,
              {
                cache:
                  'no-store',
              },
            ),
          ])

        if (
          !termsResponse.ok ||
          !privacyResponse.ok
        ) {
          throw new Error(
            'Legal documents unavailable.',
          )
        }

        const [
          terms,
          privacy,
        ] =
          await Promise.all([
            termsResponse.json(),
            privacyResponse.json(),
          ])

        if (
          typeof terms?.version !==
            'string' ||
          typeof terms?.contentHash !==
            'string' ||
          typeof privacy?.version !==
            'string' ||
          typeof privacy?.contentHash !==
            'string'
        ) {
          throw new Error(
            'Invalid legal document response.',
          )
        }

        if (active) {
          setTermsVersion(
            terms.version,
          )

          setPrivacyVersion(
            privacy.version,
          )
        }
      } catch {
        if (active) {
          setTermsVersion('')
          setPrivacyVersion('')
          setTermsAccepted(false)

          setLegalError(
            'Terms of Service and Privacy Policy are temporarily unavailable. Please try again later.',
          )
        }
      } finally {
        if (active) {
          setLegalLoading(false)
        }
      }
    }

    void loadLegalVersions()

    return () => {
      active = false
    }
  }, [])

  const handle = async () => {
    if (loading) {
      return
    }

    const cleanStoreCode =
      storeCode.trim()

    const cleanEmail =
      email.trim().toLowerCase()



    if (
      !cleanStoreCode ||
      !cleanEmail ||
      !password
    ) {
      setError(
        'Store code, email and password are required',
      )
      return
    }

    if (
      legalLoading ||
      legalError ||
      !termsVersion ||
      !privacyVersion
    ) {
      setError(
        'Current Terms of Service and Privacy Policy are unavailable. Please try again.',
      )
      return
    }

    if (!termsAccepted) {
      setError(
        'You must agree to the Terms of Service and acknowledge the Privacy Policy',
      )
      return
    }

    setLoading(true)
    setError('')

    try {
      const res =
        await apiFetch(
          `${API}/business/signup`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              storeCode:
                cleanStoreCode,

              email:
                cleanEmail,

              password,

              termsAccepted:
                true,

              termsVersion,

              privacyAcknowledged:
                true,

              privacyVersion,
            }),
          },
        )

      if (!res?.success) {
        setError(
          res?.message ||
            'Could not create account',
        )
        return
      }

      const newBusinessId =
        Number(res.id)

      const newStoreCode =
        String(
          res.storeCode ||
            cleanStoreCode,
        ).trim()

      if (
        !Number.isInteger(
          newBusinessId,
        ) ||
        newBusinessId < 1 ||
        !newStoreCode
      ) {
        setError(
          'Invalid registration response',
        )
        return
      }

      /*
       * Clear any previous restaurant or
       * kitchen session before signing into
       * the newly created owner account.
       */
      localStorage.removeItem(
        'businessId',
      )

      localStorage.removeItem(
        'storeCode',
      )

      localStorage.removeItem(
        'role',
      )

      localStorage.removeItem(
        'token',
      )

      localStorage.setItem(
        'businessId',
        String(newBusinessId),
      )

      localStorage.setItem(
        'storeCode',
        newStoreCode,
      )

      localStorage.setItem(
        'role',
        'owner',
      )

      if (
        typeof res.token ===
          'string' &&
        res.token
      ) {
        localStorage.setItem(
          'token',
          res.token,
        )
      }

      /*
       * Registration creates the OWNER.
       * Never send a newly registered
       * restaurant directly to Kitchen.
       */
      router.replace(
        '/dashboard/owner',
      )
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not create account',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{css}</style>

      <div className="reg-page">
        <div className="reg-card">
          <div className="reg-mark">
            🍴
          </div>

          <div className="reg-title">
            Create your store
          </div>

          <div className="reg-sub">
            Set up your CaviarQR restaurant account
          </div>

          <div className="reg-fields">
            <div className="reg-field">
              <div className="reg-label">
                Store Code
              </div>

              <input
                className="reg-input"
                placeholder="e.g. cafe1"
                value={storeCode}
                disabled={loading}
                onChange={(e) =>
                  setStoreCode(
                    e.target.value,
                  )
                }
              />
            </div>

            <div className="reg-field">
              <div className="reg-label">
                Email
              </div>

              <input
                className="reg-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled={loading}
                onChange={(e) =>
                  setEmail(
                    e.target.value,
                  )
                }
              />
            </div>

            <div className="reg-field">
              <div className="reg-label">
                Password
              </div>

              <input
                className="reg-input"
                type="password"
                placeholder="Create a password"
                value={password}
                disabled={loading}
                onChange={(e) =>
                  setPassword(
                    e.target.value,
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter'
                  ) {
                    void handle()
                  }
                }}
              />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              margin: '18px 0',
              fontSize: 14,
              lineHeight: 1.5,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={termsAccepted}
              disabled={
                loading ||
                legalLoading ||
                Boolean(
                  legalError,
                )
              }
              onChange={(e) =>
                setTermsAccepted(
                  e.target.checked,
                )
              }
              style={{
                marginTop: 3,
                width: 16,
                height: 16,
                flexShrink: 0,
              }}
            />

            <span>
              I agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                CaviarQR Terms of Service
              </a>{' '}
              and acknowledge the{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                Privacy Policy
              </a>.
            </span>
          </label>

          {legalLoading && (
            <div
              className="reg-error"
              style={{
                color:
                  '#6e6e73',
                background:
                  'rgba(0,0,0,0.04)',
                marginBottom:
                  10,
              }}
            >
              Loading current legal documents…
            </div>
          )}

          {legalError && (
            <div
              className="reg-error"
              style={{
                marginBottom:
                  10,
              }}
            >
              {legalError}
            </div>
          )}

          <button
            className="reg-btn"
            onClick={() => {
              void handle()
            }}
            disabled={
              loading ||
              legalLoading ||
              Boolean(
                legalError,
              ) ||
              !termsAccepted
            }
          >
            {loading
              ? 'Creating account…'
              : 'Create Account'}
          </button>

          {error && (
            <div className="reg-error">
              {error}
            </div>
          )}

          <div className="reg-divider" />

          <div className="reg-footer">
            Already have an account?{' '}
            <a href="/login">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </>
  )
}