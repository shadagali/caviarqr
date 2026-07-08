'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

type Cafe = {
  id: number
  storeCode: string
  email: string
  name?: string
  cafeName?: string
  stripeAccountId?: string
  isOpen: boolean
  processingFeePercent?: number
}

export default function CafesPage() {
  const router = useRouter()

  const [cafes, setCafes] =
    useState<Cafe[]>([])

  const [loading, setLoading] =
    useState(true)

  async function load() {
    try {
      const res =
        await fetch(
          `${API}/business`,
        )

      const data =
        await res.json()

      setCafes(
        Array.isArray(data)
          ? data
          : [],
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-8">

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold">
          ☕ Cafes
        </h1>

        <button
          onClick={() =>
            router.push('/admin')
          }
          className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-lg"
        >
          ← Dashboard
        </button>

      </div>

      {loading && (
        <div className="text-xl">
          Loading cafes...
        </div>
      )}

      {!loading && cafes.length === 0 && (
        <div className="text-gray-400">
          No cafes found.
        </div>
      )}

      {!loading && cafes.length > 0 && (

        <div className="space-y-6">

          {cafes.map((cafe) => (

            <div
              key={cafe.id}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-lg"
            >

              <div className="flex justify-between items-start">

                <div>

                  <div className="text-2xl font-bold">

                    {cafe.cafeName ||
                      cafe.name ||
                      cafe.storeCode}

                  </div>

                  <div className="text-gray-400 mt-1">
                    {cafe.email}
                  </div>

                </div>

                <div>

                  <span
                    className={
                      cafe.isOpen
                        ? 'text-green-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {cafe.isOpen
                      ? '🟢 OPEN'
                      : '🔴 CLOSED'}
                  </span>

                </div>

              </div>

              <div className="grid grid-cols-5 gap-5 mt-8">

                <div>

                  <div className="text-gray-500 text-sm">
                    Store Code
                  </div>

                  <div className="font-semibold mt-1">
                    {cafe.storeCode}
                  </div>

                </div>

                <div>

                  <div className="text-gray-500 text-sm">
                    Stripe
                  </div>

                  <div className="font-semibold mt-1">

                    {cafe.stripeAccountId
                      ? '✅ Connected'
                      : '❌ Not Connected'}

                  </div>

                </div>

                <div>

                  <div className="text-gray-500 text-sm">
                    Processing Fee
                  </div>

                  <div className="font-semibold mt-1">

                    {cafe.processingFeePercent ??
                      1.75}%

                  </div>

                </div>

                <div>

                  <div className="text-gray-500 text-sm">
                    Revenue
                  </div>

                  <div className="font-semibold mt-1">
                    View Details
                  </div>

                </div>

                <div>

                  <div className="text-gray-500 text-sm">
                    Orders
                  </div>

                  <div className="font-semibold mt-1">
                    View Details
                  </div>

                </div>

              </div>

              <div className="mt-8 flex flex-wrap gap-3">

                <button
                  onClick={() =>
                    router.push(
                      `/admin/cafes/${cafe.storeCode}`,
                    )
                  }
                  className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-lg"
                >
                  ☕ View Cafe
                </button>

                <button
                  onClick={() =>
                    router.push(
                      `/dashboard/analytics?store=${cafe.storeCode}`,
                    )
                  }
                  className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-lg"
                >
                  📈 Analytics
                </button>

                <button
                  onClick={() =>
                    router.push(
                      '/dashboard/action-center',
                    )
                  }
                  className="bg-red-600 hover:bg-red-500 px-5 py-3 rounded-lg"
                >
                  🚨 Action Center
                </button>

                <button
                  onClick={() =>
                    router.push(
                      `/dashboard/menu?store=${cafe.storeCode}`,
                    )
                  }
                  className="bg-yellow-600 hover:bg-yellow-500 px-5 py-3 rounded-lg"
                >
                  🍔 Menu
                </button>

                <button
                  onClick={() =>
                    router.push(
                      `/dashboard/kitchen?store=${cafe.storeCode}`,
                    )
                  }
                  className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-lg"
                >
                  👨‍🍳 Kitchen
                </button>

              </div>

            </div>

          ))}

        </div>

      )}

    </div>
  )
}