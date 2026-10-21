"use client"

import type { ReactNode } from "react"

type Props = {
  items: any[]
  cart: any[]
  isOpen: boolean
  paymentsReady: boolean
  paymentMessage?: string
  onAdd: (item: any) => void
  onRemove: (id: any) => void
  formatPrice: (value: number) => ReactNode
}

export default function RecommendedMenuGrid({
  items,
  cart,
  isOpen,
  paymentsReady,
  paymentMessage,
  onAdd,
  onRemove,
  formatPrice,
}: Props) {
  const seen = new Set<string>()

  // First 10 visible, unique items in the existing menu order.
  const recommended = items
    .filter((item) => {
      if (!item || item.isHidden) return false

      const id = String(item.id)

      if (seen.has(id)) return false

      seen.add(id)
      return true
    })
    .slice(0, 10)

  if (recommended.length === 0) return null

  return (
    <section
      aria-label="Recommended menu items"
      style={{
        padding: "24px 16px 10px",
        background: "#fff",
        color: "#191919",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          margin: "0 0 18px",
          letterSpacing: "-0.3px",
        }}
      >
        Recommended ({recommended.length})
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "24px 14px",
        }}
      >
        {recommended.map((item) => {
          const isOut = item.isOutOfStock === true
          const cartItem = cart.find(
            (entry) => String(entry.id) === String(item.id)
          )

          const hasCustomizations =
            Array.isArray(item.customizations) &&
            item.customizations.length > 0

          const discount = Number(item.discount || 0)
          const originalPrice = Number(item.price)

          const finalPrice =
            discount > 0
              ? originalPrice * (1 - discount / 100)
              : originalPrice

          const imageSrc = item.imageUrl
            ? `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`
            : null

          const addItem = () => {
            if (isOut) return

            if (!paymentsReady) {
              window.alert(
                paymentMessage ||
                  "Online ordering is temporarily unavailable."
              )
              return
            }

            onAdd(item)
          }

          return (
            <article
              key={String(item.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                gap: 8,
                opacity: !isOpen || !paymentsReady ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  overflow: "hidden",
                  borderRadius: 16,
                  background: "#f3f3f3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={String(item.name)}
                    loading="lazy"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ fontSize: 42 }}
                  >
                    🍽️
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  minHeight: "2.7em",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflowWrap: "anywhere",
                }}
              >
                {item.name}
              </div>

              {isOut && (
                <div
                  style={{
                    color: "#b91c1c",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  SOLD OUT
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: "auto",
                  paddingTop: 5,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {discount > 0 && (
                    <span
                      style={{
                        color: "#767676",
                        fontSize: 11,
                        textDecoration: "line-through",
                      }}
                    >
                      {formatPrice(originalPrice)}
                    </span>
                  )}

                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#191919",
                    }}
                  >
                    {formatPrice(finalPrice)}
                  </span>
                </div>

                {isOpen &&
                  (cartItem && !hasCustomizations ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        border: "1px solid #dedede",
                        borderRadius: 9,
                        padding: "3px 5px",
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => onRemove(item.id)}
                        style={{
                          border: "none",
                          background: "#fff",
                          fontSize: 18,
                          cursor: "pointer",
                          minWidth: 22,
                        }}
                      >
                        −
                      </button>

                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {cartItem.qty}
                      </span>

                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={addItem}
                        style={{
                          border: "none",
                          background: "#fff",
                          fontSize: 18,
                          cursor: "pointer",
                          minWidth: 22,
                        }}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Add ${item.name} to cart`}
                      disabled={isOut}
                      onClick={addItem}
                      style={{
                        background: "#fff",
                        color: "#111",
                        border: "1px solid #d8d8d8",
                        borderRadius: 9,
                        padding: "8px 12px",
                        minWidth: 68,
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: isOut
                          ? "not-allowed"
                          : "pointer",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                      }}
                    >
                      ADD
                    </button>
                  ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
