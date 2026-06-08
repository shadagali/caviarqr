"use client"

import { useState } from "react"
import axios from "axios"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"

// 🔒 SAFE STRIPE INIT (prevents crash if env missing)
const stripePromise =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_STRIPE_PK
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK)
    : null

function CheckoutForm({
  cart,
  storeCode,
  tableNumber,
  clearCart,
}: {
  cart: any[]
  storeCode: string
  tableNumber: number
  clearCart: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const payNow = async () => {
    console.log("🔥 PAY CLICKED")

    if (!stripe) {
      console.log("❌ Stripe NULL")
      alert("Stripe not loaded")
      return
    }

    if (!elements) {
      console.log("❌ Elements NULL")
      alert("Payment form not ready")
      return
    }

    const card = elements.getElement(CardElement)

    if (!card) {
      console.log("❌ CardElement NULL")
      alert("Card input not ready")
      return
    }

    setLoading(true)

    try {
      console.log("➡️ Calling backend...")

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stripe/payment-intent`,
        {
          storeCode,
          tableNumber,
          items: cart,
        },
      )

      console.log("✅ Backend response:", res.data)

      const clientSecret = res.data.clientSecret

      if (!clientSecret) {
        throw new Error("No clientSecret returned")
      }

      console.log("➡️ Confirming payment...")

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        },
      })

      console.log("✅ Stripe result:", result)

      if (result.error) {
        console.log("❌ Stripe error:", result.error)
        alert(result.error.message)
      } else if (result.paymentIntent?.status === "succeeded") {
        console.log("🎉 PAYMENT SUCCESS")
        alert("Payment successful!")
        clearCart()
      } else {
        alert("Payment not completed")
      }
    } catch (err) {
      console.log("❌ ERROR:", err)
      alert("Payment failed")
    }

    setLoading(false)
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          background: "white",
          padding: 10,
          borderRadius: 6,
        }}
      >
        <CardElement />
      </div>

      <button
        onClick={payNow}
        disabled={loading}
        style={{
          marginTop: 10,
          width: "100%",
          background: loading ? "gray" : "white",
          color: "black",
          padding: 10,
          borderRadius: 6,
        }}
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>
    </div>
  )
}

export default function CheckoutWrapper({
  cart,
  storeCode,
  tableNumber,
  clearCart,
}: {
  cart: any[]
  storeCode: string
  tableNumber: number
  clearCart: () => void
}) {
  if (!stripePromise) {
    return (
      <div style={{ color: "red", marginTop: 10 }}>
        Stripe not configured (missing publishable key)
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        cart={cart}
        storeCode={storeCode}
        tableNumber={tableNumber}
        clearCart={clearCart}
      />
    </Elements>
  )
}