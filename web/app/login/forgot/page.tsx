"use client"

import { useState } from "react"

export default function Forgot() {
  const [email, setEmail] =
    useState("")

  const [msg, setMsg] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const send = async () => {
    const cleanEmail =
      email.trim().toLowerCase()

    if (!cleanEmail) {
      setMsg("Enter your email")
      return
    }

    try {
      setLoading(true)
      setMsg("")

      const res = await fetch(
        "/api/forgot",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        },
      )

      const text =
        await res.text()

      let data: any = null

      try {
        data =
          text
            ? JSON.parse(text)
            : null
      } catch {
        data = null
      }

      console.log(
        "📩 FORGOT RESPONSE:",
        {
          status: res.status,
          data,
          text,
        },
      )

      if (res.ok) {
        setMsg(
          data?.message ||
            "Email sent ✅",
        )
      } else {
        setMsg(
          data?.message ||
            data?.error ||
            "Failed ❌",
        )
      }
    } catch (err) {
      console.error(
        "❌ FORGOT ERROR:",
        err,
      )

      setMsg("Network error ❌")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* BRAND */}
      <h1 style={styles.heading}>
        Forgot Password
      </h1>

      {/* CARD */}
      <div style={styles.card}>
        <input
          type="email"
          placeholder="Email"
          style={styles.input}
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <button
          type="button"
          onClick={send}
          disabled={loading}
          style={{
            ...styles.button,
            ...(loading
              ? styles.buttonDisabled
              : {}),
          }}
        >
          {loading
            ? "Sending..."
            : "Send Reset Link"}
        </button>

        {msg && (
          <p style={styles.message}>
            {msg}
          </p>
        )}
      </div>
    </div>
  )
}

const styles: {
  [key: string]: React.CSSProperties
} = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f2f5",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  heading: {
    color: "#000",
    fontSize: "2.25rem",
    fontWeight: 700,
    marginBottom: "1.5rem",
  },
  card: {
    backgroundColor: "#fff",
    padding: "1.5rem",
    borderRadius: "0.75rem",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
    width: "20rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  input: {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    fontSize: "1rem",
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    width: "100%",
    backgroundColor: "#000",
    color: "#fff",
    padding: "0.75rem",
    borderRadius: "0.375rem",
    border: "none",
    fontSize: "1rem",
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  message: {
    fontSize: "0.875rem",
    textAlign: "center",
    color: "#4b5563",
    margin: 0,
  },
}