"use client"

import { useState } from "react"

export default function Forgot() {
  const [email, setEmail] = useState("")
  const [msg, setMsg] = useState("")

  const send = async () => {
    console.log("🔥 BUTTON CLICK")

    try {
      const res = await fetch("/api/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const text = await res.text()
      console.log("📩 FRONTEND RESPONSE:", text)

      if (res.ok) {
        setMsg("Email sent ✅")
      } else {
        setMsg("Failed ❌")
      }

    } catch (err) {
      console.log("❌ FETCH ERROR:", err)
      setMsg("Network error ❌")
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4">
      <h2>Forgot Password</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 bg-gray-800"
      />

      <button onClick={send} className="bg-green-500 px-4 py-2">
        Send Reset Link
      </button>

      <p>{msg}</p>
    </div>
  )
}