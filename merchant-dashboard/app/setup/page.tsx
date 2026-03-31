"use client"

import { useState } from "react"

export default function SetupPage() {

  const [name, setName] = useState("")
  const [storeCode, setStoreCode] = useState("")
  const [logo, setLogo] = useState<File | null>(null)

  async function createBusiness() {

    const formData = new FormData()

    formData.append("name", name)
    formData.append("storeCode", storeCode)

    if (logo) {
      formData.append("logo", logo)
    }

    const res = await fetch("http://localhost:3001/business/create", {
      method: "POST",
      body: formData
    })

    const data = await res.json()

    alert("Restaurant created!")

    console.log(data)

  }

  return (

    <div className="p-10 max-w-lg mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        Restaurant Setup
      </h1>

      <input
        className="border p-2 w-full mb-4"
        placeholder="Restaurant Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-4"
        placeholder="Store Code (example: ABC123)"
        value={storeCode}
        onChange={(e) => setStoreCode(e.target.value)}
      />

      <input
        type="file"
        className="mb-4"
        onChange={(e) => {
          if (e.target.files) {
            setLogo(e.target.files[0])
          }
        }}
      />

      <button
        onClick={createBusiness}
        className="bg-black text-white px-4 py-2 rounded w-full"
      >
        Create Restaurant
      </button>

    </div>
  )
}