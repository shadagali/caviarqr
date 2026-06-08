'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

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

  .reg-input::placeholder { color: var(--text3); }

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

  .reg-btn:hover { background: var(--accent-hover); }
  .reg-btn:active { transform: scale(0.99); }

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

  const [storeCode, setStoreCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    setError('')

    const res = await apiFetch(`${API}/business/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode, email, password }),
    })

    setLoading(false)

    if (!res.success) {
      setError(res.message)
      return
    }

    localStorage.setItem('token', res.token)
    localStorage.setItem('storeCode', res.storeCode)

    router.push('/dashboard/kitchen')
  }

  return (
    <>
      <style>{css}</style>
      <div className="reg-page">
        <div className="reg-card">

          <div className="reg-mark">🍴</div>
          <div className="reg-title">Create your store</div>
          <div className="reg-sub">Set up your CaviarQR restaurant account</div>

          <div className="reg-fields">
            <div className="reg-field">
              <div className="reg-label">Store Code</div>
              <input
                className="reg-input"
                placeholder="e.g. cafe1"
                value={storeCode}
                onChange={e => setStoreCode(e.target.value)}
              />
            </div>
            <div className="reg-field">
              <div className="reg-label">Email</div>
              <input
                className="reg-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="reg-field">
              <div className="reg-label">Password</div>
              <input
                className="reg-input"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button className="reg-btn" onClick={handle} disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          {error && <div className="reg-error">{error}</div>}

          <div className="reg-divider" />

          <div className="reg-footer">
            Already have an account? <a href="/login">Sign in</a>
          </div>

        </div>
      </div>
    </>
  )
}