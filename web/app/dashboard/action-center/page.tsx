'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001'

type Order = {
  id: number
  customerName: string
  customerEmail: string
  tableNumber: number
  total: number
  status: string
  issueType: string
  issueResolved: boolean
  stripePaymentIntentId: string
  createdAt: string
  items: any[]
  requiresOwnerAction: boolean
  ownerIssueType: string | null
  ownerIssueSeverity: string | null
  ownerActionMessage: string | null
  ownerActionId: string | null
}

export default function ActionCenter() {
  const businessId = 3

  const [orders, setOrders] =
    useState<Order[]>([])

  const [loading, setLoading] =
    useState(true)

  const [search, setSearch] =
    useState('')

  const [selected, setSelected] =
    useState<Order | null>(null)

  const [filter, setFilter] =
    useState('ALL')

  const [autoRefresh, setAutoRefresh] =
    useState(true)

  async function loadIssues() {
    try {
      const res = await axios.get(
        `${API}/maintenance/issues`,
      )

      setOrders(
        res.data.filter(
          (o: Order) =>
            o.requiresOwnerAction === true,
        ),
      )
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIssues()

    if (!autoRefresh)
      return

    const timer =
      setInterval(
        loadIssues,
        5000,
      )

    return () =>
      clearInterval(timer)
  }, [autoRefresh])

  const filtered = useMemo(() => {
    const q =
      search.toLowerCase()

    return orders.filter((o) => {
      const matchesSearch =
        o.customerName
          ?.toLowerCase()
          .includes(q) ||
        o.customerEmail
          ?.toLowerCase()
          .includes(q) ||
        String(o.id).includes(q) ||
        o.stripePaymentIntentId
          ?.toLowerCase()
          .includes(q)

      if (!matchesSearch)
        return false

      if (filter === 'ALL')
        return true

      if (filter === 'PAYMENT')
        return (
          o.issueType?.includes(
            'PAY',
          ) || false
        )

      if (filter === 'KITCHEN')
        return (
          o.issueType?.includes(
            'KITCHEN',
          ) || false
        )

      if (filter === 'REFUNDS')
        return (
          o.status ===
          'REFUNDED'
        )

      if (filter === 'COMPLETED')
        return (
          o.issueResolved
        )

      return true
    })
  }, [
    orders,
    search,
    filter,
  ])

  async function refund(
    paymentIntent: string,
  ) {
    if (
      !confirm(
        'Refund customer?',
      )
    )
      return

    await axios.patch(
      `${API}/order/refund/${paymentIntent}`,
    )

    loadIssues()
  }

  async function resolve(
    id: number,
  ) {
    await axios.patch(
      `${API}/maintenance/resolve/${id}`,
    )

    loadIssues()
  }

  function timeAgo(dateString: string) {
    const seconds = Math.floor(
      (Date.now() -
        new Date(dateString).getTime()) /
        1000,
    )

    if (seconds < 60)
      return 'just now'

    const minutes = Math.floor(
      seconds / 60,
    )

    if (minutes < 60)
      return `${minutes} minute${
        minutes === 1 ? '' : 's'
      } ago`

    const hours = Math.floor(
      minutes / 60,
    )

    if (hours < 24)
      return `${hours} hour${
        hours === 1 ? '' : 's'
      } ago`

    const days = Math.floor(
      hours / 24,
    )

    return `${days} day${
      days === 1 ? '' : 's'
    } ago`
  }

  return (
    <div className="p-8">

      <div className="flex justify-between items-center">

        <div>

          <h1 className="text-4xl font-bold">
            🚨 Action Center
          </h1>

          <div className="text-gray-500 mt-1">
            CaviarQR Operations Dashboard
          </div>

        </div>

        <div className="flex gap-6">

          <div className="bg-white rounded-xl shadow px-6 py-4 text-center">

            <div className="text-3xl font-bold">
              {orders.length}
            </div>

            <div className="text-gray-500">
              Issues
            </div>

          </div>

          <div className="bg-white rounded-xl shadow px-6 py-4 text-center">

            <div className="text-3xl font-bold">

              $
              {orders
                .reduce(
                  (sum, o) => sum + o.total,
                  0,
                )
                .toFixed(2)}

            </div>

            <div className="text-gray-500">
              At Risk
            </div>

          </div>

        </div>

      </div>

      <input
        className="mt-6 w-full border rounded-lg p-3"
        placeholder="Search name, email, payment intent..."
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value,
          )
        }
      />

      <div className="flex gap-3 mt-5 flex-wrap">

        <button
          onClick={() =>
            setFilter('ALL')
          }
          className={`px-4 py-2 rounded-lg ${
            filter === 'ALL'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          All
        </button>

        <button
          onClick={() =>
            setFilter(
              'PAYMENT',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'PAYMENT'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Payment
        </button>

        <button
          onClick={() =>
            setFilter(
              'KITCHEN',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'KITCHEN'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Kitchen
        </button>

        <button
          onClick={() =>
            setFilter(
              'REFUNDS',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'REFUNDS'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Refunds
        </button>

        <button
          onClick={() =>
            setFilter(
              'COMPLETED',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'COMPLETED'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Completed
        </button>

        <button
          onClick={loadIssues}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Refresh
        </button>

      </div>

      <div className="grid grid-cols-5 gap-4 mt-6">

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            Total Orders
          </div>

          <div className="text-3xl font-bold mt-2">
            {orders.length}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            🚨 Critical
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                o => o.ownerIssueSeverity === 'CRITICAL',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            ⚠️ Warning
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                o => o.ownerIssueSeverity === 'WARNING',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            ℹ️ Info
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                o =>
                  o.ownerIssueSeverity !== 'CRITICAL' &&
                  o.ownerIssueSeverity !== 'WARNING',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            💰 Revenue At Risk
          </div>

          <div className="text-3xl font-bold mt-2">
            $
            {orders
              .reduce(
                (sum, o) => sum + o.total,
                0,
              )
              .toFixed(2)}
          </div>
        </div>

      </div>

      {loading && (
        <div className="mt-8">
          Loading...
        </div>
      )}

      {!loading && filtered.length === 0 && (

        <div className="bg-green-50 border border-green-300 rounded-xl p-12 text-center mt-8">

          <div className="text-6xl">
            ✅
          </div>

          <h2 className="text-2xl font-bold mt-4">
            No issues found
          </h2>

          <p className="text-gray-600 mt-2">
            Everything is running normally.
          </p>

        </div>

      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-6 mt-8">

          {filtered.map((order) => (

            <div
              key={order.id}
              className={`bg-white rounded-xl shadow p-6 border-l-8 ${
                order.ownerIssueSeverity === 'CRITICAL'
                  ? 'border-red-600'
                  : order.ownerIssueSeverity === 'WARNING'
                  ? 'border-yellow-500'
                  : 'border-blue-500'
              }`}
            >

              <div className="mb-5">

                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    order.ownerIssueSeverity === 'CRITICAL'
                      ? 'bg-red-100 text-red-700'
                      : order.ownerIssueSeverity === 'WARNING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {order.ownerIssueSeverity}
                </span>

              </div>

              <div className="flex justify-between">

                <div>

                  <div className="font-bold text-xl">

                    {order.customerName ||
                      'Unknown Customer'}

                  </div>

                  <div className="text-gray-500">

                    {order.customerEmail ||
                      'No email'}

                  </div>

                </div>

                <div className="text-right">

                  <div className="font-bold">

                    $
                    {order.total.toFixed(
                      2,
                    )}

                  </div>

                  <div>

                    Table{' '}
                    {
                      order.tableNumber
                    }

                  </div>

                </div>

              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">

                <div>

                  <b>Status</b>

                  <div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        order.status === 'NEW'
                          ? 'bg-blue-100 text-blue-700'
                          : order.status === 'PREPARING'
                          ? 'bg-orange-100 text-orange-700'
                          : order.status === 'READY'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'REFUNDED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {order.status}
                    </span>

                  </div>

                </div>

                <div>

                  <b>Severity</b>

                  <div
                    className={`font-bold ${
                      order.ownerIssueSeverity ===
                      'CRITICAL'
                        ? 'text-red-600'
                        : order.ownerIssueSeverity ===
                          'WARNING'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {order.ownerIssueSeverity}
                  </div>

                </div>

                <div className="col-span-2">

                  <div className="text-xl font-bold text-red-600">

                    🚨 {order.ownerActionMessage}

                  </div>

                  <div className="mt-3 text-gray-500">

                    Issue ID

                    <div className="font-mono text-black">

                      {order.ownerActionId}

                    </div>

                  </div>

                </div>

              </div>

              <div className="mt-4 text-sm text-gray-500">

                Payment Intent

                <div className="flex items-center gap-3">

                  <div className="font-mono break-all">

                    {order.stripePaymentIntentId}

                  </div>

                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        order.stripePaymentIntentId,
                      )
                    }
                    className="text-blue-600 text-sm"
                  >
                    📋 Copy
                  </button>

                </div>

              </div>

              <div className="mt-3 text-sm text-gray-500">

                Created

                <div>
                  {timeAgo(order.createdAt)}
                </div>

              </div>

              <div className="mt-5 flex gap-3">

                <button
                  onClick={() =>
                    setSelected(
                      order,
                    )
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  View Details
                </button>

                {order.status === 'REFUNDED' ? (

                  <button
                    disabled
                    className="bg-gray-300 text-gray-600 px-4 py-2 rounded cursor-not-allowed"
                  >
                    Refunded
                  </button>

                ) : (

                  <button
                    onClick={() =>
                      refund(
                        order.stripePaymentIntentId,
                      )
                    }
                    className="bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Refund Customer
                  </button>

                )}

                {order.issueResolved ? (

                  <button
                    disabled
                    className="bg-gray-300 text-gray-600 px-4 py-2 rounded cursor-not-allowed"
                  >
                    ✔ Resolved
                  </button>

                ) : (

                  <button
                    onClick={() =>
                      resolve(
                        order.id,
                      )
                    }
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    ✓ Mark as Resolved
                  </button>

                )}

              </div>

            </div>

          ))}

        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto p-8">

            <div className="flex justify-between items-center">

              <h2 className="text-3xl font-bold">
                Order #{selected.id}
              </h2>

              <button
                onClick={() => setSelected(null)}
                className="text-2xl"
              >
                ✕
              </button>

            </div>

            <div className="grid grid-cols-2 gap-6 mt-8">

              <div>
                <div className="font-semibold">
                  Customer
                </div>

                <div>
                  {selected.customerName || 'Unknown'}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Email
                </div>

                <div>
                  {selected.customerEmail || 'None'}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Status
                </div>

                <div>
                  {selected.status}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Table
                </div>

                <div>
                  {selected.tableNumber}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Total
                </div>

                <div>
                  ${selected.total.toFixed(2)}
                </div>
              </div>

              <div>

                <div>

                  <b>Severity</b>

                  <div
                    className={`font-bold ${
                      selected.ownerIssueSeverity ===
                      'CRITICAL'
                        ? 'text-red-600'
                        : selected.ownerIssueSeverity ===
                          'WARNING'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {selected.ownerIssueSeverity}
                  </div>

                </div>

                <div className="mt-3">

                  <div className="text-2xl font-bold text-red-600">

                    🚨 {selected.ownerActionMessage}

                  </div>

                  <div className="mt-4 text-gray-500">

                    Issue ID

                    <div className="font-mono text-black">

                      {selected.ownerActionId}

                    </div>

                  </div>

                </div>

              </div>

            </div>

            <h3 className="text-2xl font-bold mt-10">
              Ordered Items
            </h3>

            <div className="mt-5 space-y-3">

              {selected.items?.map(
                (item: any, index: number) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4"
                  >

                    <div className="font-semibold text-lg">
                      {item.name}
                    </div>

                    <div>
                      Qty: {item.quantity}
                    </div>

                    <div>
                      Price: ${item.price}
                    </div>

                  </div>
                ),
              )}

            </div>

            <div className="flex gap-4 mt-10">

              <button
                onClick={() =>
                  refund(
                    selected.stripePaymentIntentId,
                  )
                }
                className="bg-red-600 text-white px-6 py-3 rounded-lg"
              >
                Refund Customer
              </button>

              <button
                onClick={() =>
                  resolve(selected.id)
                }
                className="bg-green-600 text-white px-6 py-3 rounded-lg"
              >
                ✓ Mark as Resolved
              </button>


            </div>

          </div>

        </div>
      )}

    </div>
  )
}