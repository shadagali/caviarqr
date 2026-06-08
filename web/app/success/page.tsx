"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"

export default function SuccessPage() {
  const params = useSearchParams()
  const router = useRouter()

  const [status, setStatus] = useState("Checking payment...")

  useEffect(() => {
    const checkPayment = async () => {
      const clientSecret = params.get("payment_intent_client_secret")

      if (!clientSecret) {
        setStatus("Invalid payment session")
        return
      }

      const stripe = await loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_KEY!
      )

      if (!stripe) {
        setStatus("Stripe failed to load")
        return
      }

      const { paymentIntent } =
        await stripe.retrievePaymentIntent(clientSecret)

      if (!paymentIntent) {
        setStatus("Payment not found")
        return
      }

      switch (paymentIntent.status) {
        case "succeeded":
          setStatus("Payment successful ✅")
          break
        case "processing":
          setStatus("Payment processing…")
          break
        case "requires_payment_method":
          setStatus("Payment failed ❌")
          break
        default:
          setStatus("Unknown status")
      }
    }

    checkPayment()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <h1 className="text-3xl mb-4">{status}</h1>

      <button
        onClick={() => router.push("/store/cafe1")}
        className="mt-6 bg-white text-black px-6 py-2 rounded"
      >
        Back to Menu
      </button>
    </div>
  )
}