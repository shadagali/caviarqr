"use client"

import { useEffect, useState } from "react"
import io from "socket.io-client"

const socket = io("http://localhost:3001")

export default function KitchenPage() {

  const businessId = 1

  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {

    socket.emit("joinRestaurant", businessId)

    socket.on("newOrder", (order) => {
      setOrders(prev => [...prev, order])
    })

    socket.on("orderUpdate", (updatedOrder) => {
      setOrders(prev =>
        prev.map(o =>
          o.id === updatedOrder.id ? updatedOrder : o
        )
      )
    })

  }, [])

  const newOrders = orders.filter(o => o.status === "NEW")
  const preparing = orders.filter(o => o.status === "PREPARING")
  const ready = orders.filter(o => o.status === "READY")
  const completed = orders.filter(o => o.status === "COMPLETED")

  return (

    <div className="grid grid-cols-4 gap-6 p-8">

      <Column title="NEW" orders={newOrders} />
      <Column title="PREPARING" orders={preparing} />
      <Column title="READY" orders={ready} />
      <Column title="COMPLETED" orders={completed} />

    </div>

  )
}

function Column({ title, orders }: any) {

  return (
    <div className="bg-gray-100 p-4 rounded">

      <h2 className="text-xl font-bold mb-4">
        {title}
      </h2>

      {orders.map((order: any) => (
        <div
          key={order.id}
          className="bg-white p-4 rounded shadow mb-3"
        >

          <div className="font-bold">
            Table {order.tableNumber}
          </div>

          {order.items.map((item: any, i: number) => (
            <div key={i}>
              {item.name}
            </div>
          ))}

        </div>
      ))}

    </div>
  )
}