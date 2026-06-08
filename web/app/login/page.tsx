'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

// ✅ FIXED LINE (only change)
const API = "http://127.0.0.1:3001"

export default function LoginPage() {
  const router = useRouter()
  const [storeCode, setStoreCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'owner' | 'kitchen'>('owner')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    const endpoint = role === 'owner'
      ? `${API}/business/login`
      : `${API}/business/kitchen-login`
    const res = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode, email, password }),
    })
    if (!res.success) { setError(res.message || 'Login failed'); return }
    localStorage.setItem('token', res.token)
    localStorage.setItem('storeCode', res.storeCode)
    localStorage.setItem('role', role)
    router.push(role === 'owner' ? '/dashboard/owner' : '/dashboard/kitchen')
  }

  return (
    <>
      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f4f4f5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .brand { text-align: center; margin-bottom: 2rem; }
        .brand h1 { font-size: 28px; font-weight: 500; color: #000; letter-spacing: -0.5px; margin: 0; }
        .brand p { font-size: 14px; color: #71717a; margin: 4px 0 0; }
        .card {
          width: 100%;
          max-width: 360px;
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 20px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .seg {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #f4f4f5;
          border-radius: 14px;
          padding: 4px;
        }
        .seg-btn {
          padding: 9px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          background: transparent;
          color: #71717a;
          transition: all 0.15s;
        }
        .seg-btn.active {
          background: #fff;
          color: #000;
          border: 1px solid #e4e4e7;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .fields { display: flex; flex-direction: column; gap: 10px; }
        .field { position: relative; }
        .field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #a1a1aa;
          pointer-events: none;
          display: flex;
        }
        .field input {
          width: 100%;
          padding: 11px 12px 11px 36px;
          font-size: 14px;
          border: 1px solid #e4e4e7;
          border-radius: 10px;
          background: #fff;
          color: #000;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .field input::placeholder { color: #a1a1aa; }
        .field input:focus { border-color: #a1a1aa; }
        .login-btn {
          width: 100%;
          padding: 12px;
          font-size: 15px;
          font-weight: 500;
          background: #000;
          color: #fff;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: opacity 0.15s;
          font-family: inherit;
        }
        .login-btn:hover { opacity: 0.85; }
        .login-btn:active { transform: scale(0.99); }
        .forgot {
          background: none;
          border: none;
          font-size: 13px;
          color: #a1a1aa;
          cursor: pointer;
          padding: 2px 0;
          transition: color 0.15s;
          font-family: inherit;
        }
        .forgot:hover { color: #000; }
        .divider { display: flex; align-items: center; gap: 10px; }
        .divider-line { flex: 1; height: 1px; background: #f4f4f5; }
        .divider-text { font-size: 12px; color: #a1a1aa; }
        .reg-btn {
          width: 100%;
          padding: 11px;
          font-size: 14px;
          font-weight: 500;
          background: transparent;
          color: #000;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: inherit;
        }
        .reg-btn:hover { background: #fafafa; }
        .error-msg {
          font-size: 13px;
          color: #dc2626;
          text-align: center;
          background: #fef2f2;
          border-radius: 10px;
          padding: 8px 12px;
        }
      `}</style>

      {/* UI unchanged */}
      <div className="page">
        <div className="brand">
          <h1>CaviarQR</h1>
          <p>Sign in to your dashboard</p>
        </div>

        <div className="card">
          <div className="seg">
            <button className={`seg-btn${role === 'owner' ? ' active' : ''}`} onClick={() => setRole('owner')}>Owner</button>
            <button className={`seg-btn${role === 'kitchen' ? ' active' : ''}`} onClick={() => setRole('kitchen')}>Kitchen</button>
          </div>

          <div className="fields">
            <div className="field">
              <span className="field-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
              </span>
              <input placeholder="Store code" onChange={e => setStoreCode(e.target.value)} />
            </div>

            <div className="field">
              <span className="field-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
              </span>
              <input placeholder="Email address" type="email" onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="field">
              <span className="field-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
              </span>
              <input placeholder="Password" type="password" onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          <button className="login-btn" onClick={handleLogin}>
            {role === 'owner' ? 'Sign in as Owner' : 'Sign in as Kitchen'}
          </button>

          <button className="forgot" onClick={() => router.push('/login/forgot')}>
            Forgot password?
          </button>

          <div className="divider">
            <div className="divider-line" />
            <span className="divider-text">or</span>
            <div className="divider-line" />
          </div>

          <button className="reg-btn" onClick={() => router.push('/login/register')}>
            Create a new store
          </button>

          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    </>
  )
}