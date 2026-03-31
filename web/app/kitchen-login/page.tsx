'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function KitchenLogin() {
  const [storeCode, setStoreCode] = useState('')
  const router = useRouter()

  const handleLogin = () => {
    if (!storeCode) {
      alert('Enter store code')
      return
    }

    router.push(`/dashboard/kitchen?storeCode=${storeCode}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6">

      <h1 className="text-3xl text-white mb-6">
        Kitchen Login
      </h1>

      <input
        placeholder="Enter Store Code"
        className="p-3 rounded w-full max-w-sm mb-4"
        onChange={(e) => setStoreCode(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="bg-white text-black px-6 py-3 rounded-full"
      >
        Enter Kitchen
      </button>

    </div>
  )
}