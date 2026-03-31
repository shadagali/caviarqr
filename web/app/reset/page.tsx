"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function Reset() {
  const params = useSearchParams()
  const token = params.get("token")

  const [password, setPassword] = useState("")

  const reset = async () => {
    await fetch("http://localhost:3001/business/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    })

    alert("Password reset successful")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4">
      <input type="password" placeholder="New Password" onChange={(e) => setPassword(e.target.value)} className="p-2 bg-gray-800" />
      <button onClick={reset} className="bg-blue-500 px-4 py-2">
        Reset Password
      </button>
    </div>
  )
}