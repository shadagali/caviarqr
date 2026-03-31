"use client"

import { useEffect, useState } from "react"
import api from "@/lib/api"

export default function SuccessPage() {
  const [status, setStatus] = useState("Placing order...")

  useEffect(() => {
    const send = async () => {
      const cart = JSON.parse(localStorage.getItem("tapserve_cart") || "[]")
      const storeCode = localStorage.getItem("tapserve_store")
      const tableNumber = localStorage.getItem("tapserve_table")

      try {
        const res = await api.post("/order", {
          storeCode,
          items: cart,
          tableNumber,
        })

        if (res.data.id) {
          setStatus("✅ Order placed!")
        } else {
          setStatus("❌ Failed")
        }
      } catch (err) {
        console.log(err)
        setStatus("❌ Server error")
      }
    }

    send()
  }, [])

  return (
    <div className="bg-black text-white h-screen flex items-center justify-center">
      {status}
    </div>
  )
}