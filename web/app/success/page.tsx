"use client"

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useRouter,
  useSearchParams,
} from "next/navigation"

import { loadStripe } from "@stripe/stripe-js"

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()

  const [status, setStatus] =
    useState("Checking payment...")

  const storeCode = useMemo(() => {
    const value = params.get("storeCode")

    if (!value) {
      return null
    }

    const normalized = value.trim().toLowerCase()

    if (!/^[a-z0-9_-]{1,64}$/.test(normalized)) {
      return null
    }

    return normalized
  }, [params])

  const table = useMemo(() => {
    const value = params.get("table")

    if (!value) {
      return null
    }

    const normalized = value.trim()

    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(normalized)) {
      return null
    }

    return normalized
  }, [params])

  useEffect(() => {
    const checkPayment = async () => {
      const clientSecret =
        params.get(
          "payment_intent_client_secret",
        )

      if (!clientSecret) {
        setStatus("Invalid payment session")
        return
      }

      const publishableKey =
        process.env.NEXT_PUBLIC_STRIPE_KEY

      if (!publishableKey) {
        setStatus("Payment configuration error")
        return
      }

      const stripe =
        await loadStripe(publishableKey)

      if (!stripe) {
        setStatus("Stripe failed to load")
        return
      }

      const {
        paymentIntent,
        error,
      } =
        await stripe.retrievePaymentIntent(
          clientSecret,
        )

      if (error) {
        setStatus("Unable to verify payment")
        return
      }

      if (!paymentIntent) {
        setStatus("Payment not found")
        return
      }

      switch (paymentIntent.status) {
        case "succeeded":
          setStatus("Payment successful ✅")
          break

        case "processing":
          setStatus("Payment processing...")
          break

        case "requires_payment_method":
          setStatus("Payment failed ❌")
          break

        case "requires_action":
          setStatus(
            "Payment requires additional confirmation",
          )
          break

        case "canceled":
          setStatus("Payment canceled")
          break

        default:
          setStatus("Payment status unavailable")
      }
    }

    void checkPayment()
  }, [params])

  const handleBackToMenu = () => {
    if (!storeCode) {
      router.push("/")
      return
    }

    const query = table
      ? `?table=${encodeURIComponent(table)}`
      : ""

    router.push(
      `/store/${encodeURIComponent(
        storeCode,
      )}${query}`,
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <h1 className="text-3xl mb-4">
        {status}
      </h1>

      <button
        onClick={handleBackToMenu}
        className="mt-6 bg-white text-black px-6 py-2 rounded"
      >
        Back to Menu
      </button>
    </div>
  )
}

function SuccessFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <h1 className="text-3xl mb-4">
        Checking payment...
      </h1>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessContent />
    </Suspense>
  )
}