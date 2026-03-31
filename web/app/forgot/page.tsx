"use client"

import { useState } from "react"

export default function Forgot() {
  const [email, setEmail] = useState("")

  const send = async () => {
    await fetch("http://localhost:3001/business/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })

    alert("Email sent")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4">
      <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="p-2 bg-gray-800" />
      <button onClick={send} className="bg-green-500 px-4 py-2">
        Send Reset Link
      </button>
    </div>
  )
}