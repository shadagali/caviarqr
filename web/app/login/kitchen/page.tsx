'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

export default function KitchenLogin() {
  const router = useRouter()

  const [storeCode, setStoreCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const login = async () => {
    setError('')

    const res = await apiFetch(`${API}/business/kitchen-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode, password }),
    })

    if (!res.success) {
      setError(res.message || 'Login failed')
      return
    }

    localStorage.setItem('token', res.token)
    localStorage.setItem('storeCode', res.storeCode)
    localStorage.setItem('role', 'kitchen')

    router.push('/dashboard/kitchen')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5]">

      {/* BRAND */}
      <h1 className="text-black text-4xl font-bold mb-6">
        CaviarQR Kitchen
      </h1>

      {/* CARD */}
      <div className="bg-white p-6 rounded-xl shadow w-80 space-y-3">

        <input
          placeholder="Store Code"
          className="w-full p-3 border rounded"
          onChange={e => setStoreCode(e.target.value)}
        />

        <input
          type="password"
          placeholder="Kitchen Password"
          className="w-full p-3 border rounded"
          onChange={e => setPassword(e.target.value)}
        />

        <button
          onClick={login}
          className="w-full bg-black text-white p-3 rounded"
        >
          Kitchen Login
        </button>

        <button
          onClick={() => router.push('/login')}
          className="w-full text-sm text-gray-600"
        >
          Back to Owner Login
        </button>

        {error && (
          <p className="text-red-500 text-sm text-center">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}