"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Signup() {
  const [storeCode, setStoreCode] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleSignup = async () => {
    await fetch("http://localhost:3001/business/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storeCode, email, password }),
    })

    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center gap-4">
      <h1 className="text-2xl">Create Owner Account</h1>

      <input
        placeholder="Store Code"
        className="p-2 bg-gray-800"
        onChange={(e) => setStoreCode(e.target.value)}
      />

      <input
        placeholder="Email"
        className="p-2 bg-gray-800"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        className="p-2 bg-gray-800"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleSignup}
        className="bg-green-500 px-4 py-2"
      >
        Signup
      </button>
    </div>
  )
}