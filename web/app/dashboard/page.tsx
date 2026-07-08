'use client'

import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-4xl font-bold mb-8">
        Owner Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        <Link
          href="/dashboard/menu"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            🍔 Menu
          </h2>

          <p className="text-gray-500 mt-2">
            Manage menu items and categories.
          </p>
        </Link>

        <Link
          href="/dashboard/kitchen"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            👨‍🍳 Kitchen
          </h2>

          <p className="text-gray-500 mt-2">
            View incoming orders.
          </p>
        </Link>

        <Link
          href="/dashboard/tags"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            📱 Register Tags
          </h2>

          <p className="text-gray-500 mt-2">
            Connect NFC tags and QR codes.
          </p>
        </Link>

        <Link
          href="/dashboard/analytics"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            📊 Analytics
          </h2>

          <p className="text-gray-500 mt-2">
            Revenue and order insights.
          </p>
        </Link>

        <Link
          href="/dashboard/payments"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            💳 Payments
          </h2>

          <p className="text-gray-500 mt-2">
            Stripe balance and payouts.
          </p>
        </Link>

        <Link
          href="/dashboard/branding"
          className="rounded-xl bg-white shadow p-6 hover:shadow-lg transition"
        >
          <h2 className="text-xl font-semibold">
            🎨 Branding
          </h2>

          <p className="text-gray-500 mt-2">
            Logo, cover image and theme.
          </p>
        </Link>

        <Link
          href="/dashboard/action-center"
          className="rounded-xl bg-red-50 border-2 border-red-400 shadow p-6 hover:shadow-xl transition"
        >
          <h2 className="text-xl font-bold text-red-600">
            🚨 Action Center
          </h2>

          <p className="text-gray-700 mt-2">
            Customer issues, refunds, email customers and manual actions.
          </p>
        </Link>

      </div>
    </div>
  )
}