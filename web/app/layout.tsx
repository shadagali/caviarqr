import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* ✅ CRITICAL: load Stripe globally */}
        <script src="https://js.stripe.com/v3"></script>
      </head>
      <body>{children}</body>
    </html>
  )
}