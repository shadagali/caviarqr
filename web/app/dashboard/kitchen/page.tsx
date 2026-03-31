"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import io from "socket.io-client"

const socket = io("http://localhost:3001")

export default function KitchenPage() {
  const searchParams = useSearchParams()
  const storeCode = searchParams.get("storeCode") || "cafe1"

  const [orders, setOrders] = useState<any[]>([])
  const [now, setNow] = useState(Date.now())

  // 🔥 LIVE TIMER
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 🚀 INITIAL FETCH + SOCKET SETUP
  useEffect(() => {
    const fetchOrders = async () => {
      const res = await api.get(`/order/${storeCode}`)
      setOrders(res.data || [])
    }

    fetchOrders()

    // ✅ JOIN ROOM
    socket.emit("joinStore", storeCode)

    // ✅ NEW ORDER
    socket.on("newOrder", (order) => {
      setOrders(prev => [order, ...prev])
      playSound()
    })

    // ✅ STATUS UPDATE
    socket.on("orderUpdate", (updated) => {
      setOrders(prev =>
        prev.map(o => (o.id === updated.id ? updated : o))
      )
    })

    return () => {
      socket.off("newOrder")
      socket.off("orderUpdate")
    }
  }, [storeCode])

  const updateStatus = async (id: number, status: string) => {
    await api.patch(`/order/${id}/status`, { status })
  }

  // 🔥 TIME FORMAT
  const getTimeAgo = (createdAt: string) => {
    const diff = Math.floor((now - new Date(createdAt).getTime()) / 1000)

    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    return `${Math.floor(diff / 3600)}h`
  }

  const playSound = () => {
    const audio = new Audio("/alert.mp3")
    audio.play()
  }

  const activeOrders = orders.filter(o => o.status !== "DONE")
  const completedOrders = orders.filter(o => o.status === "DONE")

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-6">
        🍳 Kitchen — {storeCode}
      </h1>

      <div className="grid grid-cols-3 gap-4">
        {/* ACTIVE ORDERS */}
        <div className="col-span-2 space-y-4">
          {activeOrders.map(order => (
            <div
              key={order.id}
              className={`rounded-2xl shadow-md p-4 border ${
                order.status === "NEW"
                  ? "bg-red-100 border-red-400 animate-pulse"
                  : "bg-white"
              }`}
            >
              {/* HEADER */}
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h2 className="text-lg font-bold">
                    Order #{order.id}
                  </h2>

                  <p className="text-sm text-gray-500">
                    Table #{order.tableNumber || "1"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-red-500 font-bold text-lg">
                    {getTimeAgo(order.createdAt)}
                  </p>
                  <p className="text-xs text-gray-400">ago</p>
                </div>
              </div>

              {/* ITEMS */}
              <div className="mb-3 space-y-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-bold">x{item.qty}</span>
                  </div>
                ))}
              </div>

              {/* STATUS */}
              <div className="flex gap-2">
                {order.status === "NEW" && (
                  <button
                    onClick={() => updateStatus(order.id, "PREPARING")}
                    className="flex-1 bg-yellow-400 py-2 rounded-lg font-semibold"
                  >
                    Start
                  </button>
                )}

                {order.status === "PREPARING" && (
                  <button
                    onClick={() => updateStatus(order.id, "READY")}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold"
                  >
                    Ready
                  </button>
                )}

                {order.status === "READY" && (
                  <button
                    onClick={() => updateStatus(order.id, "DONE")}
                    className="flex-1 bg-black text-white py-2 rounded-lg font-semibold"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* COMPLETED */}
        <div className="bg-white rounded-2xl p-3 shadow-md h-fit">
          <h2 className="font-bold mb-3">✅ Completed</h2>

          {completedOrders.length === 0 && (
            <p className="text-gray-400 text-sm">
              No completed orders
            </p>
          )}

          {completedOrders.map(order => (
            <div key={order.id} className="border-b py-2 text-sm">
              <p className="font-semibold">
                #{order.id} — Table {order.tableNumber || "1"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}