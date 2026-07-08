'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeCanvas } from 'qrcode.react'

export default function AdminPage() {
  const router = useRouter()

  const [stores, setStores] = useState<any[]>([])
  const [storeCodeInput, setStoreCodeInput] = useState('cafe1')
  const [tables, setTables] = useState(25)
  const [generatedStore, setGeneratedStore] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [stats, setStats] = useState<any>(null)

  const [recentOrders, setRecentOrders] =
    useState<any[]>([])

  const [health, setHealth] =
    useState<any>(null)

  const [issues, setIssues] =
    useState<any[]>([])

  const BASE_URL =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'

  const fetchStores = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/business')
      const data = await res.json()
      setStores(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchDashboard = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:3001/maintenance/admin-dashboard',
      )

      const data = await res.json()

      setStats(data)

      setRecentOrders(
        data.recentOrders || [],
      )
    } catch (e) {
      console.error(e)
    }
  }

  const fetchHealth = async () => {
    try {
      const [
        backend,
        database,
        stripe,
      ] = await Promise.all([
        fetch(
          'http://127.0.0.1:3001/health',
        ).then(r => r.json()),

        fetch(
          'http://127.0.0.1:3001/health/db',
        ).then(r => r.json()),

        fetch(
          'http://127.0.0.1:3001/health/stripe',
        ).then(r => r.json()),
      ])

      setHealth({
        backend,
        database,
        stripe,
      })
    } catch (err) {
      console.error(err)
    }
  }

  const fetchIssues = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:3001/maintenance/issues',
      )

      const data = await res.json()

      setIssues(
        Array.isArray(data)
          ? data
          : [],
      )
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchStores()
    fetchDashboard()
    fetchHealth()
    fetchIssues()

    const timer =
      setInterval(() => {

        fetchStores()

        fetchDashboard()

        fetchHealth()

        fetchIssues()

      }, 10000)

    return () =>
      clearInterval(timer)
  }, [])

  // 🔥 FIXED: SAFE STORE CREATE (handles existing + errors properly)
  const createStoreDirect = async () => {
    if (!storeCodeInput) {
      alert('Enter store code')
      return
    }

    setLoading(true)

    const cleanCode = storeCodeInput.toLowerCase().trim()
    const match = cleanCode.match(/\d+/)
    const number = match ? parseInt(match[0]) : 1

    try {
      const res = await fetch(
        'http://127.0.0.1:3001/business/admin/bulk-create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: number,
            count: 1,
          }),
        }
      )

      const data = await res.json()

      // 🔥 KEY FIX: even if already exists, allow QR generation
      setGeneratedStore(cleanCode)

      if (data.createdCount === 0) {
        alert('Store already exists — loading QR kit')
      }

      fetchStores()
    } catch (e) {
      console.error(e)
      alert('Backend not reachable. Is backend running?')
    }

    setLoading(false)
  }

  const urls = useMemo(() => {
    if (!generatedStore) return []
    return Array.from({ length: tables }).map((_, i) => {
      return `${BASE_URL}/store/${generatedStore}?table=${i + 1}`
    })
  }, [generatedStore, tables, BASE_URL])

  const withdraw = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:3001/order/admin/withdraw',
        { method: 'POST' }
      )
      const data = await res.json()
      alert(data.message || 'Withdraw attempted')
    } catch {
      alert('Withdraw failed — check backend')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">

      <h1 className="text-3xl mb-6">Maintenance Panel</h1>

      {stats && (

        <div className="grid grid-cols-6 gap-4 mb-8">

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Platform Revenue
            </div>

            <div className="text-3xl font-bold text-green-400">

              $
              {stats.totalRevenue?.toFixed(2)}

            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Orders
            </div>

            <div className="text-3xl font-bold">

              {stats.totalOrders}

            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Issues
            </div>

            <div className="text-3xl font-bold text-red-400">

              {stats.unresolvedIssues}

            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Refunds
            </div>

            <div className="text-3xl font-bold text-yellow-400">

              {stats.refundedOrders}

            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Platform Fees
            </div>

            <div className="text-3xl font-bold text-cyan-400">

              $

              {stats.platformFees?.toFixed(2)}

            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Avg Order
            </div>

            <div className="text-3xl font-bold">

              $

              {stats.averageOrderValue?.toFixed(2)}

            </div>

          </div>

        </div>

      )}

      <div className="grid grid-cols-4 gap-4 mb-8">

        <button
          onClick={() =>
            router.push(
              '/dashboard/action-center',
            )
          }
          className="bg-red-600 rounded-xl p-5 hover:bg-red-500"
        >

          🚨 Action Center

        </button>

        <button
          onClick={() =>
            router.push(
              '/dashboard/analytics',
            )
          }
          className="bg-green-600 rounded-xl p-5 hover:bg-green-500"
        >

          📈 Analytics

        </button>

        <button
          onClick={() =>
            router.push(
              '/admin/cafes',
            )
          }
          className="bg-blue-600 rounded-xl p-5 hover:bg-blue-500"
        >

          ☕ Cafes

        </button>

        <button
          onClick={() =>
            router.push(
              '/admin/refunds',
            )
          }
          className="bg-yellow-600 rounded-xl p-5 hover:bg-yellow-500"
        >

          💳 Refund Queue

        </button>

      </div>

      {health && (

        <div className="grid grid-cols-3 gap-4 mb-8">

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Backend
            </div>

            <div
              className={
                health.backend?.status === 'ok'
                  ? 'text-green-400 font-bold'
                  : 'text-red-400 font-bold'
              }
            >
              {health.backend?.status}
            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Database
            </div>

            <div
              className={
                health.database?.status === 'ok'
                  ? 'text-green-400 font-bold'
                  : 'text-red-400 font-bold'
              }
            >
              {health.database?.status}
            </div>

          </div>

          <div className="bg-gray-900 rounded-xl p-5">

            <div className="text-gray-400">
              Stripe
            </div>

            <div
              className={
                health.stripe?.status === 'ok'
                  ? 'text-green-400 font-bold'
                  : 'text-red-400 font-bold'
              }
            >
              {health.stripe?.status}
            </div>

          </div>

        </div>

      )}

      <div className="mb-8 border border-red-600 rounded-xl p-5">

        <div className="flex justify-between items-center mb-5">

          <h2 className="text-2xl font-bold text-red-400">

            🚨 Live Action Center

          </h2>

          <button
            onClick={() =>
              router.push(
                '/dashboard/action-center',
              )
            }
            className="bg-red-600 px-4 py-2 rounded"
          >
            Open
          </button>

        </div>

        <div className="space-y-3">

          {issues.length === 0 && (

            <div className="text-green-400">

              ✅ No open issues

            </div>

          )}

          {issues.slice(0,5).map(issue => (

            <div
              key={issue.id}
              className="bg-gray-900 rounded-lg p-4 flex justify-between items-center"
            >

              <div>

                <div className="font-bold">

                  Order #{issue.id}

                </div>

                <div className="text-sm text-gray-400">

                  {issue.storeCode}

                </div>

                <div className="text-red-400">

                  {issue.issueType}

                </div>

              </div>

              <button
                className="bg-red-600 px-4 py-2 rounded"
              >
                View
              </button>

            </div>

          ))}

        </div>

      </div>

      <div className="mb-8 border border-gray-700 rounded-xl p-5">

        <h2 className="text-2xl mb-4">

          Recent Orders

        </h2>

        <div className="space-y-3">

          {recentOrders.map(order => (

            <div
              key={order.id}
              className="flex justify-between border-b border-gray-700 pb-3"
            >

              <div>

                <div className="font-bold">

                  {order.storeCode}

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

          ))}

        </div>

      </div>

      {/* CREATE STORE */}
      <div className="mb-6 border border-gray-700 p-4 rounded">
        <h2 className="mb-3">Create QR Kit</h2>

        <div className="flex flex-wrap gap-2 mb-3 items-center">

          <input
            value={storeCodeInput}
            onChange={(e) => setStoreCodeInput(e.target.value)}
            placeholder="cafe1"
            className="bg-gray-900 p-2"
          />

          <input
            type="number"
            value={tables}
            onChange={(e) => setTables(Number(e.target.value))}
            className="bg-gray-900 p-2 w-24"
          />

          <button
            onClick={createStoreDirect}
            disabled={loading}
            className="bg-white text-black px-4 py-2 rounded"
          >
            {loading ? 'Generating...' : 'Generate Kit'}
          </button>

        </div>

        <p className="text-xs text-gray-400">
          Works even if store already exists
        </p>
      </div>

      {/* STORE LIST */}
      <div className="mb-6 border border-gray-700 p-3 max-h-40 overflow-y-scroll">
        {stores.map((s) => (
          <div
            key={s.id}
            onClick={() => setGeneratedStore(s.storeCode)}
            className="cursor-pointer mb-2 hover:text-green-400"
          >
            {s.storeCode}
          </div>
        ))}
      </div>

      {/* QR OUTPUT */}
      {generatedStore && (
        <div>
          <h2 className="mb-3">
            QR Kit: <span className="text-green-400">{generatedStore}</span>
          </h2>

          <div className="mb-4 max-h-32 overflow-y-scroll border border-gray-700 p-2 text-xs">
            {urls.map((u, i) => (
              <div key={i} className="break-all">
                {u}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {urls.map((u, i) => (
              <div
                key={i}
                className="bg-white text-black p-2 rounded text-center"
              >
                <QRCodeCanvas value={u} size={140} />
                <div className="text-xs mt-1">Table {i + 1}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="mt-6 bg-green-500 px-4 py-2 rounded"
          >
            Print QR Kit
          </button>
        </div>
      )}

      {/* WITHDRAW */}
      <div className="mt-10">
        <button
          onClick={withdraw}
          className="bg-green-500 px-4 py-2 rounded"
        >
          Withdraw Platform Earnings
        </button>
      </div>

    </div>
  )
}