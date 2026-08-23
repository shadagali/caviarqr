'use client'

import {
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

import {
  apiFetch,
  setMaintenanceToken,
} from '@/lib/api'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

type Mode =
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'

const styles = {
  main: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    padding: '16px',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, sans-serif',
    color: '#18181b',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e5e5e5',
    overflow: 'hidden',
    boxShadow:
      '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #ececec',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    background: '#fbeed6',
    border: '1px solid #f3dba8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '12px',
    fontWeight: 500,
    color: '#8a5a09',
    flexShrink: 0,
  } as React.CSSProperties,
  eyebrowRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#ef9f27',
    flexShrink: 0,
  } as React.CSSProperties,
  eyebrow: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10.5px',
    letterSpacing: '0.06em',
    color: '#8a8a8a',
    margin: 0,
    textTransform: 'uppercase',
  } as React.CSSProperties,
  title: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#18181b',
    margin: '2px 0 0',
  } as React.CSSProperties,
  body: {
    padding: '24px',
  } as React.CSSProperties,
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: '#f4f4f5',
    borderRadius: '9px',
    padding: '3px',
    marginBottom: '20px',
  } as React.CSSProperties,
  tabInactive: {
    height: '32px',
    border: 'none',
    borderRadius: '7px',
    background: 'transparent',
    color: '#8a8a8a',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  tabActive: {
    height: '32px',
    border: 'none',
    borderRadius: '7px',
    background: '#ffffff',
    color: '#18181b',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '10.5px',
    letterSpacing: '0.05em',
    color: '#8a8a8a',
    marginBottom: '6px',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '6px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid #e4e4e7',
    background: '#fafafa',
    color: '#18181b',
    padding: '0 12px',
    fontSize: '13.5px',
    boxSizing: 'border-box',
    outline: 'none',
  } as React.CSSProperties,
  forgotLink: {
    fontSize: '12px',
    color: '#18181b',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  } as React.CSSProperties,
  notice: {
    background: '#fdf6e8',
    border: '1px solid #f3dba8',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12.5px',
    color: '#8a5a09',
    lineHeight: 1.5,
  } as React.CSSProperties,
  errorBox: {
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#dc2626',
  } as React.CSSProperties,
  successBox: {
    borderRadius: '8px',
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#047857',
  } as React.CSSProperties,
  submit: {
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    background: '#18181b',
    color: '#ffffff',
    fontSize: '13.5px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '4px',
  } as React.CSSProperties,
  submitDisabled: {
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    background: '#f4f4f5',
    color: '#a1a1aa',
    fontSize: '13.5px',
    fontWeight: 500,
    cursor: 'not-allowed',
    marginTop: '4px',
  } as React.CSSProperties,
  footerCenter: {
    textAlign: 'center',
  } as React.CSSProperties,
  footerText: {
    fontSize: '12.5px',
    color: '#8a8a8a',
  } as React.CSSProperties,
  footerLink: {
    fontSize: '12.5px',
    color: '#18181b',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
  } as React.CSSProperties,
  footerRow: {
    marginTop: '20px',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '12.5px',
    fontWeight: 500,
  } as React.CSSProperties,
  footerMuted: {
    color: '#8a8a8a',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  } as React.CSSProperties,
}

export default function MaintenanceLoginPage() {
  const router = useRouter()

  const [mode, setMode] =
    useState<Mode>('login')

  const [email, setEmail] =
    useState('kingjith24@gmail.com')

  const [password, setPassword] =
    useState('')

  const [otp, setOtp] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  async function submit() {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'login') {
        const res =
          await apiFetch(
            `${API}/maintenance-auth/login`,
            {
              method: 'POST',
              body: JSON.stringify({
                email,
                password,
              }),
            },
          )

        if (!res.success) {
          setError(
            res.message ||
              'Login failed',
          )
          return
        }

        setMaintenanceToken(res.token)

        router.replace(
          '/maintenance',
        )

        return
      }

      if (mode === 'register') {
        const res =
          await apiFetch(
            `${API}/maintenance-auth/register`,
            {
              method: 'POST',
              body: JSON.stringify({
                email,
                password,
                otp,
              }),
            },
          )

        if (!res.success) {
          setError(
            res.message ||
              'Register failed',
          )
          return
        }

        setMaintenanceToken(res.token)

        router.replace(
          '/maintenance',
        )

        return
      }

      if (mode === 'forgot') {
        const res =
          await apiFetch(
            `${API}/maintenance-auth/forgot-password`,
            {
              method: 'POST',
              body: JSON.stringify({
                email,
              }),
            },
          )

        if (!res.success) {
          setError(
            res.message ||
              'Could not send OTP',
          )
          return
        }

        setMessage(
          res.message ||
            'Reset code sent.',
        )

        setMode('reset')

        return
      }

      if (mode === 'reset') {
        const res =
          await apiFetch(
            `${API}/maintenance-auth/reset-password`,
            {
              method: 'POST',
              body: JSON.stringify({
                email,
                otp,
                newPassword,
              }),
            },
          )

        if (!res.success) {
          setError(
            res.message ||
              'Password reset failed',
          )
          return
        }

        setMessage(
          'Password reset. Login with your new password.',
        )

        setPassword('')
        setOtp('')
        setNewPassword('')
        setMode('login')

        return
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>CQ</div>

          <div style={{ minWidth: 0 }}>
            <div style={styles.eyebrowRow}>
              <span style={styles.dot} />
              <p style={styles.eyebrow}>
                Ops access &middot; restricted
              </p>
            </div>

            <p style={styles.title}>
              CaviarQR maintenance
            </p>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setMessage('')
              }}
              style={
                mode === 'login' || mode === 'register'
                  ? styles.tabActive
                  : styles.tabInactive
              }
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setError('')
                setMessage('')
              }}
              style={
                mode === 'forgot' || mode === 'reset'
                  ? styles.tabActive
                  : styles.tabInactive
              }
            >
              Reset
            </button>
          </div>

          <div style={styles.fields}>
            <div>
              <label style={styles.label}>
                Admin email
              </label>

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="you@example.com"
              />
            </div>

            {(mode === 'login' || mode === 'register') && (
              <div>
                <div style={styles.labelRow}>
                  <label style={styles.label}>
                    Password
                  </label>

                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setError('')
                        setMessage('')
                      }}
                      style={styles.forgotLink}
                    >
                      Forgot?
                    </button>
                  )}
                </div>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Password"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label style={styles.label}>
                  Register OTP
                </label>

                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={styles.input}
                  placeholder="Private OTP"
                />
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label style={styles.label}>
                    Reset OTP
                  </label>

                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    style={styles.input}
                    placeholder="6-digit code"
                  />
                </div>

                <div>
                  <label style={styles.label}>
                    New password
                  </label>

                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    placeholder="New password"
                  />
                </div>
              </>
            )}

            <div style={styles.notice}>
              This console controls live tenant data. Actions here are audit-logged.
            </div>

            {error ? (
              <div style={styles.errorBox}>{error}</div>
            ) : null}

            {message ? (
              <div style={styles.successBox}>{message}</div>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              style={loading ? styles.submitDisabled : styles.submit}
            >
              {loading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                    ? 'Register admin'
                    : mode === 'forgot'
                      ? 'Send reset OTP'
                      : 'Reset password'}
            </button>

            {mode === 'login' && (
              <div style={styles.footerCenter}>
                <span style={styles.footerText}>No admin account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                    setMessage('')
                  }}
                  style={styles.footerLink}
                >
                  Register with OTP
                </button>
              </div>
            )}
          </div>

          {mode !== 'login' && (
            <div style={styles.footerRow}>
              {mode !== 'register' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                    setMessage('')
                  }}
                  style={styles.footerMuted}
                >
                  Register with OTP
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setMessage('')
                  }}
                  style={styles.footerMuted}
                >
                  Back to sign in
                </button>
              )}

              {mode !== 'forgot' && mode !== 'reset' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setError('')
                    setMessage('')
                  }}
                  style={styles.footerMuted}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}