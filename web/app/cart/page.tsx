"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #ffffff;
    --bg2: #f6f6f6;
    --border: #ebebeb;
    --text: #191919;
    --text-muted: #767676;
    --accent: #ff3008;
    --accent-light: #fff1f0;
    --font: 'Plus Jakarta Sans', sans-serif;
    --radius: 12px;
  }

  html, body { background: var(--bg2); }

  .cart-page {
    background: var(--bg);
    min-height: 100vh;
    max-width: 430px;
    margin: 0 auto;
    font-family: var(--font);
    color: var(--text);
    padding-bottom: 140px;
  }

  /* HEADER */
  .cart-header {
    padding: 52px 16px 16px;
    border-bottom: 1px solid var(--border);
  }
  .cart-header h2 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }
  .cart-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 3px;
    font-weight: 500;
  }

  /* SECTION LABEL */
  .section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 18px 16px 10px;
  }

  /* CART ITEM */
  .cart-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    animation: fadeIn 0.25s ease both;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cart-item-img {
    width: 60px;
    height: 60px;
    border-radius: 10px;
    object-fit: cover;
    background: var(--bg2);
    flex-shrink: 0;
  }

  .cart-item-info {
    flex: 1;
    min-width: 0;
  }
  .cart-item-name {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 3px;
  }
  .cart-item-unit {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .cart-item-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }
  .cart-item-price {
    font-size: 14px;
    font-weight: 700;
  }
  .qty-badge {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
  }

  /* EMPTY STATE */
  .empty {
    text-align: center;
    padding: 60px 24px;
    color: var(--text-muted);
  }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 17px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
  .empty-sub { font-size: 14px; }

  /* BILL SUMMARY */
  .summary-card {
    margin: 16px;
    background: var(--bg2);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 13px 16px;
    font-size: 14px;
    border-bottom: 1px solid var(--border);
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-row.total {
    font-size: 16px;
    font-weight: 800;
    background: var(--bg);
  }
  .summary-label { color: var(--text-muted); font-weight: 500; }
  .summary-value { font-weight: 700; }
  .summary-value.red { color: var(--accent); }

  /* TABLE BADGE */
  .table-badge {
    margin: 0 16px 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f0faf0;
    color: #1a8917;
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
  }

  /* FOOTER / PAY */
  .cart-footer {
    position: fixed;
    bottom: 0; left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    padding: 12px 16px 28px;
    background: linear-gradient(to top, #fff 65%, transparent);
    z-index: 50;
  }
  .pay-btn {
    width: 100%;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    padding: 17px 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 20px rgba(255,48,8,0.28);
    transition: background 0.15s;
  }
  .pay-btn:disabled { background: #ccc; box-shadow: none; cursor: not-allowed; }
  .pay-btn:active:not(:disabled) { background: #e02500; }
  .pay-label { flex: 1; text-align: center; }
  .pay-total {
    background: rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 3px 10px;
    font-size: 14px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto;
  }
`

export default function CartPage() {
  const search = useSearchParams()

  const storeCode = search.get("storeCode") || ""
  const table = Number(search.get("table") || 0)

  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [serviceFeeValue, setServiceFeeValue] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem("cart")
    if (saved) setCart(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const loadBusiness = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/public/store/${storeCode}`
        )
        setServiceFeeValue(Number(res.data?.business?.serviceFee || 0))
      } catch (err) {
        console.log("SERVICE FEE ERROR", err)
      }
    }

    if (storeCode) loadBusiness()
  }, [storeCode])

  // Total with discount applied per item
  const total = cart.reduce((sum, i) => {
    const finalPrice =
      i.discount && i.discount > 0
        ? i.price * (1 - i.discount / 100)
        : i.price

    return sum + finalPrice * (i.qty || 1)
  }, 0)

  const serviceFee = (total * serviceFeeValue) / 100
  const finalTotal = total + serviceFee

  const payNow = async () => {
    setLoading(true)
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stripe/checkout`,
        { storeCode, tableNumber: table, items: cart }
      )
      window.location.href = res.data.url
    } catch {
      alert("Payment failed")
      setLoading(false)
    }
  }

  const itemCount = cart.reduce((s, i) => s + (i.qty || 1), 0)

  return (
    <>
      <style>{css}</style>
      <div className="cart-page">

        {/* HEADER */}
        <div className="cart-header">
          <h2>Your Order</h2>
          {cart.length > 0 && (
            <div className="cart-subtitle">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🛒</div>
            <div className="empty-title">Your cart is empty</div>
            <div className="empty-sub">Go back and add some items</div>
          </div>
        ) : (
          <>
            {/* TABLE */}
            <div style={{ padding: "14px 16px 0" }}>
              <span className="table-badge">🪑 Table {table}</span>
            </div>

            {/* ITEMS */}
            <div className="section-label">Items</div>

            {cart.map((i, idx) => {
              const finalPrice =
                i.discount && i.discount > 0
                  ? i.price * (1 - i.discount / 100)
                  : i.price

              return (
                <div
                  key={i.id}
                  className="cart-item"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <img
                    className="cart-item-img"
                    src={
                      i.imageUrl
                        ? i.imageUrl.startsWith("http")
                          ? i.imageUrl
                          : `${process.env.NEXT_PUBLIC_API_URL}${i.imageUrl}`
                        : "https://via.placeholder.com/60"
                    }
                    alt={i.name}
                  />

                  <div className="cart-item-info">
                    <div className="cart-item-name">{i.name}</div>
                    <div className="cart-item-unit">
                      ${finalPrice.toFixed(2)} each
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <span className="cart-item-price">
                      ${(finalPrice * (i.qty || 1)).toFixed(2)}
                    </span>
                    <span className="qty-badge">×{i.qty || 1}</span>
                  </div>
                </div>
              )
            })}

            {/* BILL SUMMARY */}
            <div className="section-label">Bill Summary</div>

            <div className="summary-card">
              <div className="summary-row">
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">${total.toFixed(2)}</span>
              </div>

              <div className="summary-row">
                <span className="summary-label">Service fee</span>
                <span className="summary-value">
                  ${serviceFee.toFixed(2)}
                </span>
              </div>

              <div className="summary-row total">
                <span>Total</span>
                <span className="summary-value red">
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        )}

        {/* PAY BUTTON */}
        {cart.length > 0 && (
          <div className="cart-footer">
            <button className="pay-btn" onClick={payNow} disabled={loading}>
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  <span>Pay Now</span>
                  <span className="pay-label" />
                  <span className="pay-total">
                    ${finalTotal.toFixed(2)}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </>
  )
}