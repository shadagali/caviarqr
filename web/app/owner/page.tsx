"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function OwnerPage() {
  const router = useRouter()

  const [storeCode, setStoreCode] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)
  const [menu, setMenu] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 🔐 PROTECT ROUTE
  useEffect(() => {
    const stored = localStorage.getItem("storeCode")

    if (!stored) {
      router.push("/login")
      return
    }

    setStoreCode(stored)
  }, [])

  // 📊 FETCH DATA
  useEffect(() => {
    if (!storeCode) return

    fetchData()
  }, [storeCode])

  const fetchData = async () => {
    try {
      const earningsRes = await fetch(
        `http://127.0.0.1:3001/business/earnings/${storeCode}`
      )
      const earnings = await earningsRes.json()

      const menuRes = await fetch(
        `http://127.0.0.1:3001/menu/${storeCode}`
      )
      const menuData = await menuRes.json()

      setData(earnings)
      setMenu(menuData)
    } catch (err) {
      console.error("Fetch error:", err)
    }
  }

  // 💸 WITHDRAW
  const withdraw = async () => {
    if (!storeCode) return

    setLoading(true)

    try {
      const res = await fetch(
        `http://127.0.0.1:3001/business/withdraw/${storeCode}`,
        {
          method: "POST",
        }
      )

      const result = await res.json()
      console.log(result)

      fetchData()
    } catch (err) {
      console.error(err)
    }

    setLoading(false)
  }

  if (!storeCode || !data) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          🏪 {storeCode} Dashboard
        </h1>

        <button
          onClick={() => {
            localStorage.removeItem("storeCode")
            router.push("/login")
          }}
          className="text-sm text-red-500"
        >
          Logout
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Total Revenue" value={data.totalRevenue} color="green" />
        <Card title="Platform Fees" value={data.platformFees} color="red" />
        <Card title="Net Earnings" value={data.net} color="black" />
      </div>

      {/* WITHDRAW */}
      <button
        onClick={withdraw}
        disabled={loading}
        className="bg-black text-white px-6 py-3 rounded-xl"
      >
        {loading ? "Processing..." : "Withdraw Earnings"}
      </button>

      {/* MENU */}
      <div>
        <h2 className="text-xl font-bold mb-4">🍔 Menu</h2>

        <div className="grid grid-cols-3 gap-4">
          {menu.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow">

              {item.imageUrl && (
                <img
                  src={`http://127.0.0.1:3001${item.imageUrl}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              )}

              <h3 className="font-bold mt-2">{item.name}</h3>

              {/* PRICE */}
              <div className="flex gap-2 items-center">
                {item.discountPrice ? (
                  <>
                    <span className="line-through text-gray-400">
                      ${item.price}
                    </span>
                    <span className="text-green-600 font-bold">
                      ${item.discountPrice}
                    </span>
                  </>
                ) : (
                  <span>${item.price}</span>
                )}
              </div>

              {/* CATEGORY */}
              <p className="text-sm text-gray-500">
                {item.category || "General"}
              </p>

              {/* STATUS */}
              <p
                className={`text-sm ${
                  item.available ? "text-green-600" : "text-red-500"
                }`}
              >
                {item.available ? "Available" : "Out of stock"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 📊 STAT CARD
function Card({ title, value, color }: any) {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className={`text-2xl font-bold text-${color}-600`}>
        ${value?.toFixed?.(2) || 0}
      </h2>
    </div>
  )
}