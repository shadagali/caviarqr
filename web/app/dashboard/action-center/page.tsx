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

  const [note, setNote] =
    useState('')

  const [sendingEmail, setSendingEmail] =
    useState(false)

  async function loadIssues() {
    try {
      const res = await axios.get(
        `${API}/maintenance/issues`,
      )

      setOrders(res.data)
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

  async function emailCustomer() {
    if (!selected)
      return

    try {
      setSendingEmail(true)

      await axios.post(
        `${API}/maintenance/email-customer`,
        {
          orderId: selected.id,
          email:
            selected.customerEmail,
          name:
            selected.customerName,
          note,
        },
      )

      alert(
        'Email sent successfully.',
      )
    } catch (err) {
      console.log(err)

      alert(
        'Failed to send email.',
      )
    } finally {
      setSendingEmail(false)
    }
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

      <div className="grid grid-cols-4 gap-4 mt-6">

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
            NEW
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                o => o.status === 'NEW',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            PREPARING
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                o => o.status === 'PREPARING',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            Revenue At Risk
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

      {!loading && (
        <div className="grid gap-6 mt-8">

          {filtered.map((order) => (

            <div
              key={order.id}
              className="bg-white rounded-xl shadow p-6 border"
            >

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
                    {order.status}
                  </div>

                </div>

                <div>

                  <b>Issue</b>

                  <div>

                    {order.issueType ||
                      'None'}

                  </div>

                </div>

              </div>

              <div className="mt-4 text-sm text-gray-500">

                Payment Intent

                <div className="font-mono break-all">
                  {order.stripePaymentIntentId}
                </div>

              </div>

              <div className="mt-3 text-sm text-gray-500">

                Created

                <div>
                  {new Date(
                    order.createdAt,
                  ).toLocaleString()}
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
                  Details
                </button>

                <button
                  onClick={() =>
                    refund(
                      order.stripePaymentIntentId,
                    )
                  }
                  className="bg-red-600 text-white px-4 py-2 rounded"
                >
                  Refund
                </button>

                <button
                  onClick={() =>
                    resolve(
                      order.id,
                    )
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Resolve
                </button>

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
                <div className="font-semibold">
                  Issue
                </div>

                <div>
                  {selected.issueType || 'None'}
                </div>
              </div>

            </div>

            <h3 className="text-2xl font-bold mt-8">
              Support Notes
            </h3>

            <textarea
              className="w-full border rounded-lg mt-4 p-4 h-32"
              placeholder="Write internal notes or a message to the customer..."
              value={note}
              onChange={(e) =>
                setNote(
                  e.target.value,
                )
              }
            />

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
                Resolve Issue
              </button>

              <button
                onClick={emailCustomer}
                disabled={sendingEmail}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
              >
                {sendingEmail
                  ? 'Sending...'
                  : 'Email Customer'}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}