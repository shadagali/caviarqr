"use client"

import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">

      <div className="text-center space-y-8">

        {/* BRAND */}
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">
            CaviarQR
          </h1>

          <p className="text-gray-500 mt-3 text-lg">
            Scan. Order. Pay.
          </p>
        </div>

        {/* BUTTON ROW (APPLE STYLE) */}
        <div className="flex gap-4 justify-center flex-wrap">

          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 rounded-full bg-black text-white hover:opacity-90 transition"
          >
            Owner
          </button>

          <button
            onClick={() => router.push("/dashboard/kitchen")}
            className="px-6 py-3 rounded-full border hover:bg-gray-100 transition"
          >
            Kitchen
          </button>

          <button
            onClick={() => router.push("/setup")}
            className="px-6 py-3 rounded-full border hover:bg-gray-100 transition"
          >
            Register Tags
          </button>

          <button
            onClick={() => router.push("/admin")}
            className="px-6 py-3 rounded-full border hover:bg-gray-100 transition"
          >
            Maintenance
          </button>

        </div>

      </div>

    </div>
  )
}