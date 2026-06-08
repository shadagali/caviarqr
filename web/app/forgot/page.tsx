"use client"

import { useState } from "react"

export default function Forgot() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  const send = async () => {
    if (!email) {
      setMsg("Enter your email")
      return
    }

    try {
      setLoading(true)
      setMsg("Sending...")

      const res = await fetch("http://localhost:3001/business/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (res.ok) {
        setMsg("Reset link sent to your email ✅")
      } else {
        setMsg(data.message || "Failed ❌")
      }

    } catch (err) {
      setMsg("Server error ❌")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4 px-4">
      
      <h2 className="text-2xl font-semibold">Forgot Password</h2>

      <input
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-3 bg-gray-800 rounded w-64 outline-none"
      />

      <button
        onClick={send}
        disabled={loading}
        className="bg-green-500 px-6 py-2 rounded hover:bg-green-600 transition"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      {msg && <p className="text-sm text-gray-300">{msg}</p>}

    </div>
  )
}