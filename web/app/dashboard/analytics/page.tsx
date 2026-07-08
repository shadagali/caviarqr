'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

export default function AnalyticsPage() {
  const search = useSearchParams()

  const storeCode =
    search.get('store')

  const [loading, setLoading] =
    useState(true)

  const [data, setData] =
    useState<any>(null)

  async function load() {
    try {
      const res = await fetch(
        `${API}/maintenance/cafe/${storeCode}`,
      )

      const json =
        await res.json()

      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (storeCode) {
      load()
    }
  }, [storeCode])

  if (loading) {
    return (
      <div className="p-10">
        Loading analytics...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">

      <h1 className="text-4xl font-bold mb-8">
        📈 Analytics
      </h1>

      <div className="grid grid-cols-4 gap-5">

        <div className="bg-gray-900 rounded-xl p-6">
          <div className="text-gray-400">
            Today Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.todayRevenue.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6">
          <div className="text-gray-400">
            Month Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.monthRevenue.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6">
          <div className="text-gray-400">
            All Time Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.allTimeRevenue.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6">
          <div className="text-gray-400">
            Average Order
          </div>

          <div className="text-3xl font-bold">
            $
            {data.averageOrder.toFixed(2)}
          </div>
        </div>

      </div>

      <div className="mt-10 bg-gray-900 rounded-xl p-6">

        <h2 className="text-2xl font-bold mb-5">
          Revenue Overview
        </h2>

        <div className="h-[350px] flex items-center justify-center text-gray-500">
          Revenue Chart Coming Soon
        </div>

      </div>

      <div className="mt-10 bg-gray-900 rounded-xl p-6">

        <h2 className="text-2xl font-bold mb-5">
          Recent Orders
        </h2>

        <div className="space-y-3">

          {data.recentOrders.map(
            (order: any) => (

              <div
                key={order.id}
                className="border border-gray-700 rounded-lg p-4 flex justify-between"
              >

                <div>

                  <div className="font-bold">
                    Order #{order.id}
                  </div>

                  <div className="text-sm text-gray-400">
                    Table {order.tableNumber}
                  </div>

                </div>

                <div>
                  ${order.total}
                </div>

                <div>
                  {order.status}
                </div>

              </div>

            ),
          )}

        </div>

      </div>

    </div>
  )
}