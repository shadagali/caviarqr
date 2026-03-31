"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [storeCode, setStoreCode] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  const login = async () => {
    setError("")
    setLoading(true)

    try {
      const res = await fetch("http://127.0.0.1:3001/business/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeCode,
          password,
        }),
      })

      // 🔥 HANDLE NETWORK FAIL
      if (!res.ok) {
        setError("Server not reachable. Is backend running?")
        setLoading(false)
        return
      }

      const data = await res.json()

      console.log("LOGIN RESPONSE:", data)

      if (!data.success) {
        setError(data.message || "Invalid login")
        setLoading(false)
        return
      }

      // ✅ SAVE SESSION
      localStorage.setItem("storeCode", data.storeCode)

      // ✅ REDIRECT
      router.push("/owner")

    } catch (err) {
      console.error("LOGIN ERROR:", err)

      setError("Cannot connect to server. Try disabling antivirus or check backend.")

      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white p-8 rounded-2xl shadow-lg w-96 space-y-5">

        <h1 className="text-2xl font-bold text-center">
          TapServe Owner Login
        </h1>

        {/* STORE CODE */}
        <input
          placeholder="Store Code"
          value={storeCode}
          onChange={(e) => setStoreCode(e.target.value)}
          className="w-full border p-3 rounded-lg"
        />

        {/* PASSWORD */}
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-3 rounded-lg"
        />

        {/* ERROR */}
        {error && (
          <div className="bg-red-100 text-red-600 p-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* BUTTON */}
        <button
          onClick={login}
          disabled={loading}
          className="w-full bg-black text-white py-3 rounded-lg"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* DEBUG INFO (helps you right now) */}
        <p className="text-xs text-gray-400 text-center">
          Backend must be running on 127.0.0.1:3001
        </p>
      </div>
    </div>
  )
}