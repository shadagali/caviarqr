"use client"

import {
  Suspense,
  useState,
} from "react"

import {
  useSearchParams,
} from "next/navigation"

function ResetContent() {
  const params =
    useSearchParams()

  const token =
    params.get("token")

  const [password, setPassword] =
    useState("")

  const reset = async () => {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/business/reset-password`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      },
    )

    alert(
      "Password reset successful",
    )
  }

  return (
    <div>
      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) =>
          setPassword(
            e.target.value,
          )
        }
        className="p-2 bg-gray-800"
      />

      <button
        type="button"
        onClick={() => {
          void reset()
        }}
      >
        Reset Password
      </button>
    </div>
  )
}

export default function Reset() {
  return (
    <Suspense
      fallback={
        <div>
          Loading...
        </div>
      }
    >
      <ResetContent />
    </Suspense>
  )
}