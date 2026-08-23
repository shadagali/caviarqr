'use client'

import {
  Suspense,
  useEffect,
  useState,
} from 'react'

import {
  useSearchParams,
} from 'next/navigation'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

type RecentOrder = {
  id: number | string
  tableNumber?: number | string | null
  total?: number | string
  status?: string
}

type AnalyticsData = {
  todayRevenue: number
  monthRevenue: number
  allTimeRevenue: number
  averageOrder: number
  recentOrders: RecentOrder[]
}

function AnalyticsContent() {
  const search =
    useSearchParams()

  const storeCode =
    search.get('store')

  const [loading, setLoading] =
    useState(true)

  const [data, setData] =
    useState<AnalyticsData | null>(
      null,
    )

  const [error, setError] =
    useState('')

  useEffect(() => {
    async function load() {
      if (!storeCode) {
        setError(
          'Store code is missing.',
        )
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')

        const res = await fetch(
          `${API}/maintenance/cafe/${encodeURIComponent(
            storeCode,
          )}`,
        )

        if (!res.ok) {
          throw new Error(
            `Analytics request failed (${res.status}).`,
          )
        }

        const json =
          await res.json()

        setData({
          todayRevenue:
            Number(
              json?.todayRevenue ||
                0,
            ),

          monthRevenue:
            Number(
              json?.monthRevenue ||
                0,
            ),

          allTimeRevenue:
            Number(
              json?.allTimeRevenue ||
                0,
            ),

          averageOrder:
            Number(
              json?.averageOrder ||
                0,
            ),

          recentOrders:
            Array.isArray(
              json?.recentOrders,
            )
              ? json.recentOrders
              : [],
        })
      } catch (err) {
        console.error(err)

        setError(
          'Analytics could not be loaded.',
        )

        setData(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [storeCode])

  if (loading) {
    return (
      <div className="p-8">
        Loading analytics...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="text-red-500">
          {error ||
            'Analytics unavailable.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="mb-8 text-4xl font-bold">
        📈 Analytics
      </h1>

      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-xl bg-gray-900 p-6">
          <div className="text-gray-400">
            Today Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.todayRevenue.toFixed(
              2,
            )}
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 p-6">
          <div className="text-gray-400">
            Month Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.monthRevenue.toFixed(
              2,
            )}
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 p-6">
          <div className="text-gray-400">
            All Time Revenue
          </div>

          <div className="text-3xl font-bold text-green-400">
            $
            {data.allTimeRevenue.toFixed(
              2,
            )}
          </div>
        </div>

        <div className="rounded-xl bg-gray-900 p-6">
          <div className="text-gray-400">
            Average Order
          </div>

          <div className="text-3xl font-bold">
            $
            {data.averageOrder.toFixed(
              2,
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 rounded-xl bg-gray-900 p-6">
        <h2 className="mb-5 text-2xl font-bold">
          Revenue Overview
        </h2>

        <div className="flex h-[350px] items-center justify-center text-gray-500">
          Revenue Chart Coming Soon
        </div>
      </div>

      <div className="mt-10 rounded-xl bg-gray-900 p-6">
        <h2 className="mb-5 text-2xl font-bold">
          Recent Orders
        </h2>

        <div className="space-y-3">
          {data.recentOrders.length ===
          0 ? (
            <div className="text-gray-400">
              No recent orders.
            </div>
          ) : (
            data.recentOrders.map(
              (order) => (
                <div
                  key={order.id}
                  className="flex justify-between rounded-lg border border-gray-700 p-4"
                >
                  <div>
                    <div className="font-bold">
                      Order #
                      {order.id}
                    </div>

                    <div className="text-sm text-gray-400">
                      Table{' '}
                      {order.tableNumber ??
                        '—'}
                    </div>
                  </div>

                  <div>
                    $
                    {Number(
                      order.total || 0,
                    ).toFixed(2)}
                  </div>

                  <div>
                    {order.status ||
                      'Unknown'}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          Loading analytics...
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  )
}