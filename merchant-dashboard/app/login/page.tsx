'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {

  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: any) => {
    e.preventDefault()

    setLoading(true)

    try {

      const res = await fetch('http://localhost:3001/auth/merchant/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.message || 'Login failed')
        setLoading(false)
        return
      }

      localStorage.setItem('token', data.token)

      router.push('/dashboard')

    } catch (err) {

      console.error(err)
      alert('Server error')

    }

    setLoading(false)
  }

  return (

    <div className="flex items-center justify-center min-h-screen bg-gray-100">

      <div className="bg-white p-8 rounded-xl shadow-md w-[400px]">

        <h1 className="text-2xl font-bold mb-6 text-center">
          TapServe Merchant Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">

          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="w-full bg-black text-white p-3 rounded"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

        </form>

      </div>

    </div>

  )
}