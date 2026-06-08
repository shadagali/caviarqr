import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log("🔥 PROXY HIT:", body)

    const res = await fetch("http://127.0.0.1:3001/business/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    console.log("📩 BACKEND RESPONSE:", text)

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.log("❌ PROXY ERROR:", err)
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 })
  }
}