"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

export default function StorePage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const storeCode = params.storeCode as string
  const tableNumber = searchParams.get("table") || "1"

  const [menu, setMenu] = useState<any[]>([])
  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 📦 FETCH MENU
  useEffect(() => {
    fetchMenu()
  }, [])

  const fetchMenu = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:3001/store/${storeCode}`
      )
      const data = await res.json()

      if (!data.menu || !Array.isArray(data.menu)) {
        setMenu([])
        return
      }

      setMenu(data.menu)
    } catch (err) {
      console.error("Menu fetch error:", err)
    }

    setLoading(false)
  }

  // ➕ ADD TO CART
  const addToCart = (item: any) => {
    const existing = cart.find((c) => c.id === item.id)

    if (existing) {
      setCart(
        cart.map((c) =>
          c.id === item.id ? { ...c, qty: c.qty + 1 } : c
        )
      )
    } else {
      setCart([
        ...cart,
        {
          ...item,
          qty: 1,
        },
      ])
    }
  }

  // ➖ REMOVE
  const removeFromCart = (id: number) => {
    setCart(cart.filter((c) => c.id !== id))
  }

  // 💳 CHECKOUT (SAFE)
  const checkout = async () => {
    try {
      const res = await fetch("http://127.0.0.1:3001/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeCode,
          items: cart,
          tableNumber,
        }),
      })

      if (!res.ok) {
        alert("Server error. Please try again.")
        return
      }

      const data = await res.json()

      if (!data.success) {
        alert("Order failed. Please try again.")
        return
      }

      // 🔥 REDIRECT TO STRIPE
      window.location.href = data.url

    } catch (err) {
      console.error(err)
      alert("Network issue. Please inform staff.")
    }
  }

  if (loading) {
    return <div className="p-6">Loading menu...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24">

      {/* HEADER */}
      <div className="p-4 bg-white shadow">
        <h1 className="text-xl font-bold">
          🍽 {storeCode}
        </h1>
        <p className="text-sm text-gray-500">
          Table {tableNumber}
        </p>
      </div>

      {/* MENU GRID */}
      <div className="grid grid-cols-2 gap-4 p-4">
        {menu.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow p-3"
          >
            {item.imageUrl && (
              <img
                src={`http://127.0.0.1:3001${item.imageUrl}`}
                className="w-full h-32 object-cover rounded-lg"
              />
            )}

            <h3 className="font-bold mt-2">{item.name}</h3>

            <p className="text-sm text-gray-500">
              {item.description}
            </p>

            {/* PRICE */}
            <div className="flex gap-2 items-center mt-1">
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

            <button
              onClick={() => addToCart(item)}
              className="mt-2 w-full bg-black text-white py-1 rounded"
            >
              Add
            </button>
          </div>
        ))}
      </div>

      {/* CART BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow p-4">

          <div className="flex justify-between mb-2">
            <span>{cart.length} items</span>

            <span>
              $
              {cart
                .reduce(
                  (sum, i) =>
                    sum +
                    (i.discountPrice || i.price) * i.qty,
                  0
                )
                .toFixed(2)}
            </span>
          </div>

          <button
            onClick={checkout}
            className="w-full bg-black text-white py-3 rounded"
          >
            Checkout
          </button>
        </div>
      )}
    </div>
  )
}