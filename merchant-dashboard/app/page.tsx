"use client"

import { useState, useEffect } from "react"
import MenuTable from "@/components/MenuTable"

export default function MenuPage() {

  const [items, setItems] = useState<any[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")

  async function loadMenu() {
    try {

      const res = await fetch("http://localhost:3001/menu/1")

      const data = await res.json()

      setItems(data)

    } catch (err) {
      console.error("Load menu error:", err)
    }
  }

  async function addMenuItem() {

    try {

      await fetch("http://localhost:3001/menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          price: Number(price),
          businessId: 1
        }),
      })

      setName("")
      setPrice("")

      loadMenu()

    } catch (err) {
      console.error("Add menu item error:", err)
    }

  }

  useEffect(() => {
    loadMenu()
  }, [])

  return (
    <div>

      <h1 className="text-2xl font-bold mb-6">
        Menu Manager
      </h1>

      <div className="bg-white p-6 rounded-xl border max-w-md mb-8">

        <input
          className="border p-2 w-full mb-4"
          placeholder="Food name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="border p-2 w-full mb-4"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <button
          onClick={addMenuItem}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Add Menu Item
        </button>

      </div>

      <MenuTable items={items} reload={loadMenu} />

    </div>
  )
}
