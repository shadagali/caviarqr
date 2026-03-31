"use client"

import { useState, useEffect } from "react"
import MenuGrid from "@/components/MenuGrid"

export default function MenuPage() {

  const [items, setItems] = useState<any[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("General")
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function loadMenu() {
    const res = await fetch("http://localhost:3001/menu/1")
    const data = await res.json()
    setItems(data)
  }

  async function addMenuItem() {

    const formData = new FormData()

    formData.append("name", name)
    formData.append("price", price)
    formData.append("businessId", "1")
    formData.append("category", category)

    if (image) {
      formData.append("image", image)
    }

    await fetch("http://localhost:3001/menu/upload", {
      method: "POST",
      body: formData
    })

    setName("")
    setPrice("")
    setImage(null)
    setPreview(null)

    loadMenu()
  }

  useEffect(() => {
    loadMenu()
  }, [])

  return (
    <div>

      <h1 className="text-2xl font-bold mb-6">
        Menu Manager
      </h1>

      <div className="bg-white p-6 rounded-xl border max-w-md mb-10">

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

        <select
          className="border p-2 w-full mb-4"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>Burgers</option>
          <option>Pizza</option>
          <option>Drinks</option>
          <option>Desserts</option>
          <option>General</option>
        </select>

        <input
          type="file"
          className="mb-4"
          onChange={(e) => {
            if (e.target.files) {
              const file = e.target.files[0]
              setImage(file)
              setPreview(URL.createObjectURL(file))
            }
          }}
        />

        {preview && (
          <img
            src={preview}
            className="w-full h-40 object-cover rounded mb-4"
          />
        )}

        <button
          onClick={addMenuItem}
          className="bg-black text-white px-4 py-2 rounded w-full"
        >
          Add Menu Item
        </button>

      </div>

      <MenuGrid items={items} reload={loadMenu} />

    </div>
  )
}