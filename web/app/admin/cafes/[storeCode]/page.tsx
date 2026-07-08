'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

export default function CafeDetailsPage() {
  const { storeCode } = useParams()

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [data, setData] =
    useState<any>(null)

  const [
    processingFee,
    setProcessingFee,
  ] = useState(1.75)

  async function loadCafe() {
    try {
      const res = await axios.get(
        `${API}/maintenance/cafe/${storeCode}`,
      )

      setData(res.data)

      setProcessingFee(
        res.data.business
          ?.processingFeePercent ??
          1.75,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function saveFee() {
    try {
      setSaving(true)

      await axios.patch(
        `${API}/maintenance/cafe/${storeCode}/processing-fee`,
        {
          processingFeePercent:
            processingFee,
        },
      )

      await loadCafe()

      alert(
        'Processing fee updated',
      )
    } catch (err) {
      console.error(err)
      alert(
        'Failed to update fee',
      )
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (storeCode) {
      loadCafe()
    }
  }, [storeCode])

  if (loading) {
    return (
      <div className="p-10">
        Loading...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-10">
        Cafe not found.
      </div>
    )
  }

  return (
    <div className="p-10 space-y-8">

      <div>

        <h1 className="text-4xl font-bold">
          {data.business.cafeName ||
            data.business.name ||
            data.business.storeCode}
        </h1>

        <div className="text-gray-500 mt-2">
          Store Code:{' '}
          {data.business.storeCode}
        </div>

        <div className="text-gray-500">
          {data.business.email}
        </div>

      </div>

      <div className="grid grid-cols-3 gap-5">

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Today Revenue
          </div>

          <div className="text-3xl font-bold">
            $
            {data.todayRevenue.toFixed(
              2,
            )}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Month Revenue
          </div>

          <div className="text-3xl font-bold">
            $
            {data.monthRevenue.toFixed(
              2,
            )}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            All Time Revenue
          </div>

          <div className="text-3xl font-bold">
            $
            {data.allTimeRevenue.toFixed(
              2,
            )}
          </div>

        </div>

      </div>

      <div className="grid grid-cols-3 gap-5">

        <div className="border rounded-xl p-5">

          <div>
            Today CaviarQR Earnings
          </div>

          <div className="text-3xl font-bold text-green-600">
            $
            {data.todayPlatformFees.toFixed(
              2,
            )}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div>
            Month CaviarQR Earnings
          </div>

          <div className="text-3xl font-bold text-green-600">
            $
            {data.monthPlatformFees.toFixed(
              2,
            )}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div>
            All Time CaviarQR Earnings
          </div>

          <div className="text-3xl font-bold text-green-600">
            $
            {data.allTimePlatformFees.toFixed(
              2,
            )}
          </div>

        </div>

      </div>

      <div className="border rounded-xl p-6">

        <h2 className="text-2xl font-bold">
          Processing Fee
        </h2>

        <div className="mt-4 flex gap-4 items-center">

          <input
            type="number"
            step="0.25"
            value={processingFee}
            onChange={(e) =>
              setProcessingFee(
                Number(
                  e.target.value,
                ),
              )
            }
            className="border rounded p-3 w-40"
          />

          <span>%</span>

          <button
            onClick={saveFee}
            disabled={saving}
            className="bg-black text-white rounded px-6 py-3"
          >
            {saving
              ? 'Saving...'
              : 'Save'}
          </button>

        </div>

      </div>

      <div className="grid grid-cols-3 gap-5">

        <div className="border rounded-xl p-5">

          <div>
            Average Order
          </div>

          <div className="text-3xl font-bold">
            $
            {data.averageOrder.toFixed(
              2,
            )}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div>
            Refunds
          </div>

          <div className="text-3xl font-bold">
            {data.refunds}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div>
            Open Issues
          </div>

          <div className="text-3xl font-bold text-red-600">
            {data.openIssues}
          </div>

        </div>

      </div>

      <div>

        <h2 className="text-2xl font-bold mb-5">
          Recent Orders
        </h2>

        <div className="space-y-3">

          {data.recentOrders.map(
            (order: any) => (
              <div
                key={order.id}
                className="border rounded-xl p-5 flex justify-between"
              >
                <div>
                  <div className="font-bold">
                    Order #{order.id}
                  </div>

                  <div>
                    Table{' '}
                    {order.tableNumber}
                  </div>
                </div>

                <div>
                  $
                  {order.total}
                </div>

                <div>
                  {order.status}
                </div>
              </div>
            ),
          )}

        </div>

      </div>

      {/* =========================
          Merchant Controls
      ========================= */}

      <div className="border rounded-xl p-6">

        <h2 className="text-2xl font-bold mb-6">
          Merchant Controls
        </h2>

        <div className="grid grid-cols-3 gap-5">

          <button className="bg-green-600 text-white rounded-xl p-5">
            🍔 Menu
          </button>

          <button className="bg-blue-600 text-white rounded-xl p-5">
            👨‍🍳 Kitchen
          </button>

          <button className="bg-red-600 text-white rounded-xl p-5">
            🚨 Action Center
          </button>

          <button className="bg-yellow-600 text-white rounded-xl p-5">
            📈 Analytics
          </button>

          <button className="bg-purple-600 text-white rounded-xl p-5">
            💳 Refund Customer
          </button>

          <button className="bg-gray-800 text-white rounded-xl p-5">
            📧 Email Owner
          </button>

        </div>

      </div>

      {/* =========================
          Business Information
      ========================= */}

      <div className="border rounded-xl p-6">

        <h2 className="text-2xl font-bold mb-6">
          Business Information
        </h2>

        <div className="grid grid-cols-2 gap-6">

          <div>

            <div className="text-gray-500">
              Email
            </div>

            <div className="font-semibold">
              {data.business.email}
            </div>

          </div>

          <div>

            <div className="text-gray-500">
              Store Code
            </div>

            <div className="font-semibold">
              {data.business.storeCode}
            </div>

          </div>

          <div>

            <div className="text-gray-500">
              Current Processing Fee
            </div>

            <div className="font-semibold">
              {processingFee}%
            </div>

          </div>

          <div>

            <div className="text-gray-500">
              All Time Processing Fees Earned
            </div>

            <div className="text-3xl font-bold text-green-600">
              $
              {data.allTimePlatformFees.toFixed(2)}
            </div>

          </div>

        </div>

      </div>

      {/* =========================
          Quick Stats
      ========================= */}

      <div className="grid grid-cols-4 gap-5">

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Average Order
          </div>

          <div className="text-3xl font-bold">
            $
            {data.averageOrder.toFixed(2)}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Refunds
          </div>

          <div className="text-3xl font-bold">
            {data.refunds}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Open Issues
          </div>

          <div className="text-3xl font-bold text-red-600">
            {data.openIssues}
          </div>

        </div>

        <div className="border rounded-xl p-5">

          <div className="text-gray-500">
            Total Orders Loaded
          </div>

          <div className="text-3xl font-bold">
            {data.recentOrders.length}
          </div>

        </div>

      </div>

    </div>
  )
}