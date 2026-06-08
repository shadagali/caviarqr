import { loadStripe } from "@stripe/stripe-js"

// 🔒 HARD GUARANTEE STRIPE LOADS
const STRIPE_PK =
  process.env.NEXT_PUBLIC_STRIPE_PK ||
  "pk_test_REPLACE_THIS_WITH_YOURS"

if (!STRIPE_PK) {
  throw new Error("Stripe key missing")
}

export const stripePromise = loadStripe(STRIPE_PK)