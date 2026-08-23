"use client"

import {
  Suspense,
  useState,
} from "react"

import {
  useSearchParams,
} from "next/navigation"

import axios from "axios"

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001"

function ResetPasswordContent() {
  const params =
    useSearchParams()

  const token =
    params.get("token")

  const [password, setPassword] =
    useState("")

  const [msg, setMsg] =
    useState("")

  const save = async () => {
    if (!password) {
      setMsg("Enter password")
      return
    }

    if (!token) {
      setMsg(
        "Reset token is missing",
      )
      return
    }

    try {
      await axios.post(
        `${API}/business/reset-password`,
        {
          token,
          password,
        },
      )

      setMsg(
        "Password updated ✅",
      )
    } catch {
      setMsg("Failed ❌")
    }
  }

  return (
    <div>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) =>
          setPassword(
            e.target.value,
          )
        }
        style={{
          display: "block",
          marginBottom: 10,
        }}
      />

      <button
        type="button"
        onClick={() => {
          void save()
        }}
      >
        Save
      </button>

      {msg && (
        <div
          style={{
            marginTop: 10,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  )
}

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <div>
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}