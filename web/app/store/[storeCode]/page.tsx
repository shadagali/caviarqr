"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import axios from "axios"
import html2canvas from "html2canvas"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    --bg: #ffffff;
    --bg2: #f6f6f6;
    --border: #ebebeb;
    --text: #191919;
    --text-muted: #767676;
    --accent: #ff3008;
    --accent-light: #fff1f0;
    --green: #1a8917;
    --radius: 12px;
    --radius-lg: 22px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --shadow-md: 0 10px 30px rgba(0,0,0,0.12);
    --font: 'Plus Jakarta Sans', sans-serif;
  }

  html, body {
    background: #f6f6f6;
    scroll-behavior: smooth;
  }

  .store {
    background: var(--bg);
    min-height: 100vh;
    font-family: var(--font);
    color: var(--text);
    max-width: 430px;
    margin: 0 auto;
    padding-bottom: 140px;
  }

  .store-hero {
    background: var(--bg2);
    height: 210px;
    position: relative;
    overflow: hidden;
  }

  .store-hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .store-hero-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 56px;
    background: linear-gradient(135deg, #fff1f0, #ffe0db);
  }

  .store-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0,0,0,0.05),
      rgba(0,0,0,0.35)
    );
  }

  .sticky-header {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%) translateY(-100%);
    width: 100%;
    max-width: 430px;
    background: rgba(255,255,255,0.94);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 80;
    transition: transform 0.25s ease;
  }

  .sticky-header.visible {
    transform: translateX(-50%) translateY(0);
  }

  .sticky-header-name {
    font-weight: 800;
    font-size: 16px;
    letter-spacing: -0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 240px;
  }

  .sticky-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .store-info {
    padding: 20px 16px 0;
    background: var(--bg);
    position: relative;
    z-index: 2;
    margin-top: -22px;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 -10px 24px rgba(0,0,0,0.03);
  }

  .store-name {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text);
    line-height: 1.15;
  }

  .store-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    margin-bottom: 14px;
  }

  .meta-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .meta-pill.open {
    color: var(--green);
    background: #f0faf0;
    border-color: #dff0df;
  }

  .divider {
    height: 8px;
    background: var(--bg2);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .closed-banner {
    background: linear-gradient(135deg, #fef2f2, #fee2e2);
    color: #b91c1c;
    padding: 16px;
    text-align: center;
    font-weight: 700;
    margin: 14px 16px 0;
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
  }

  .payment-banner {
    background: linear-gradient(135deg, #fff7ed, #ffedd5);
    color: #9a3412;
    padding: 16px;
    text-align: center;
    font-weight: 700;
    margin: 14px 16px 0;
    border-radius: 14px;
    box-shadow: var(--shadow-sm);
    line-height: 1.45;
  }

  .payment-banner-sub {
    font-size: 12px;
    font-weight: 600;
    margin-top: 5px;
    color: #9a3412;
    opacity: 0.85;
  }

  .cat-section {
    padding: 22px 16px 0;
  }

  .cat-label {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: var(--text);
    margin-bottom: 12px;
    text-transform: capitalize;
  }

  .menu-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
    background: var(--bg);
    border-radius: 16px;
    margin-bottom: 10px;
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .menu-row:active {
    transform: scale(0.985);
  }

  .menu-info {
    flex: 1;
    min-width: 0;
  }

  .menu-item-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 3px;
  }

  .price-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .price-normal {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .price-final {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }

  .price-original {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: line-through;
    font-weight: 400;
  }

  .discount-tag {
    background: var(--accent-light);
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .menu-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }

  .menu-img-wrap {
    width: 78px;
    height: 78px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg2);
    box-shadow: var(--shadow-sm);
  }

  .menu-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .add-btn {
    background: var(--bg);
    border: 2px solid var(--accent-light);
    border-radius: 50%;
    width: 34px;
    height: 34px;
    font-size: 20px;
    font-weight: 400;
    color: var(--accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease;
  }

  .add-btn:active {
    transform: scale(0.88);
  }

  .qty-control {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg2);
    border-radius: 20px;
    padding: 4px 6px;
  }

  .qty-btn {
    background: var(--bg);
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    font-size: 16px;
    color: var(--accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s ease;
  }

  .qty-btn:active {
    transform: scale(0.85);
  }

  .qty-num {
    font-size: 14px;
    font-weight: 700;
    min-width: 16px;
    text-align: center;
    color: var(--text);
  }

  .cart-bar {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    padding: 12px 16px 28px;
    background: linear-gradient(to top, #fff 70%, transparent);
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
    padding: 16px 20px;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(255,48,8,0.28);
    transition: transform 0.15s ease;
  }

  .pay-btn:active {
    transform: scale(0.98);
  }

  .success-popup {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .success-card {
    width: 100%;
    max-width: 330px;
    background: white;
    border-radius: 26px;
    padding: 18px;
    text-align: center;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-md);
  }

  .success-title {
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .success-sub {
    font-size: 14px;
    color: #666;
    margin-bottom: 22px;
  }

  .success-btn {
    width: 100%;
    border: none;
    border-radius: 14px;
    padding: 15px;
    background: var(--accent);
    color: white;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    margin-top: 12px;
    transition: transform 0.15s ease;
  }

  .success-btn:active {
    transform: scale(0.97);
  }

  .receipt-download {
    background: #111;
  }

  .receipt-box {
    background: #fff;
    border-radius: 16px;
    padding: 16px;
    margin-top: 10px;
    text-align: left;
    border: 1px solid #eee;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 14px;
  }

  .receipt-total {
    display: flex;
    justify-content: space-between;
    margin-top: 18px;
    font-size: 22px;
    font-weight: 800;
  }

  .menu-nav-fab {
    position: fixed;

    right: calc(
      50% - 215px + 18px
    );

    width: 72px;
    height: 72px;

    border-radius: 50%;

    background: #050505;
    color: white;

    border: none;

    z-index: 90;

    cursor: pointer;

    display: flex;
    flex-direction: column;

    align-items: center;
    justify-content: center;

    font-weight: 800;
    font-size: 13px;

    box-shadow:
      0 10px 30px
      rgba(0,0,0,.25);

    transition: transform 0.15s ease, bottom 0.2s ease;
  }

  .menu-nav-fab:active {
    transform: scale(0.94);
  }

  .loading-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 70vh;
    gap: 14px;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

export default function StorePage() {
  const params = useParams()
  const search = useSearchParams()

  const storeCode = params.storeCode as string
  const table = Number(search.get("table") || 1)

  const [menu, setMenu] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [cart, setCart] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)

  const [receiptItems, setReceiptItems] =
    useState<any[]>([])

  const [receiptServiceFee, setReceiptServiceFee] =
    useState(0)

  const [showSuccess, setShowSuccess] =
    useState(false)

  const receiptRef = useRef<any>(null)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [
    showCategories,
    setShowCategories,
  ] = useState(false)

  const load = async () => {
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/public/store/${storeCode}`,
      )

      setBusiness(res.data.business || null)

      setMenu(
        Array.isArray(res.data.menu)
          ? res.data.menu
          : [],
      )
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (storeCode) {
      load()
    }
  }, [storeCode])

  useEffect(() => {
    const refreshStatus =
      async () => {
        try {
          const res =
            await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL}/public/store/${storeCode}`,
            )

          setBusiness(
            (prev: any) => ({
              ...prev,
              ...res.data?.business,
              isOpen:
                res.data?.business
                  ?.isOpen === true,
              paymentsReady:
                res.data?.business
                  ?.paymentsReady === true,
            }),
          )
        } catch (err) {
          console.log(err)
        }
      }

    refreshStatus()

    const poll =
      setInterval(
        refreshStatus,
        5000,
      )

    return () =>
      clearInterval(poll)
  }, [storeCode])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 170)
    }

    window.addEventListener(
      "scroll",
      onScroll,
    )

    return () =>
      window.removeEventListener(
        "scroll",
        onScroll,
      )
  }, [])

  useEffect(() => {
    const success =
      search.get("success")

    // 🔥 ONLY RUN ONCE
    if (
      success === "1" &&
      !showSuccess
    ) {
      const savedCart =
        localStorage.getItem(
          "cart",
        )

      if (savedCart) {
        const parsed =
          JSON.parse(savedCart)

        setReceiptItems(parsed)

        const subtotal =
          parsed.reduce(
            (
              sum: number,
              item: any,
            ) => {
              const finalPrice =
                Number(
                  item.discount ||
                    0,
                ) > 0
                  ? Number(
                      item.price,
                    ) *
                    (1 -
                      Number(
                        item.discount ||
                          0,
                      ) /
                        100)
                  : Number(
                      item.price,
                    )

              return (
                sum +
                finalPrice *
                  Number(
                    item.qty || 1,
                  )
              )
            },
            0,
          )

        const feePercent =
          Number(
            business?.serviceFee ??
              5,
          )

        const fee = Number(
          (
            subtotal *
            (feePercent / 100)
          ).toFixed(2),
        )

        setReceiptServiceFee(
          fee,
        )
      }

      // 🔥 SHOW ONLY ONCE
      setShowSuccess(true)

      // 🔥 CLEAR CART
      localStorage.removeItem(
        "cart",
      )

      // 🔥 REMOVE success=1
      // prevents reopening forever
      window.history.replaceState(
        {},
        "",
        `/store/${storeCode}?table=${table}`,
      )
    }
  }, [
    search,
    showSuccess,
    storeCode,
    table,
  ])

  const downloadReceipt =
    async () => {
      if (!receiptRef.current)
        return

      const canvas =
        await html2canvas(
          receiptRef.current,
        )

      const image =
        canvas.toDataURL(
          "image/jpeg",
          1,
        )

      const link =
        document.createElement(
          "a",
        )

      link.href = image

      link.download =
        `receipt-${Date.now()}.jpg`

      link.click()
    }

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.id === item.id,
      )

      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                qty: (i.qty || 1) + 1,
              }
            : i,
        )
      }

      return [...prev, { ...item, qty: 1 }]
    })
  }

  const removeFromCart = (id: any) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.id === id,
      )

      if (!existing) return prev

      if ((existing.qty || 1) <= 1) {
        return prev.filter((i) => i.id !== id)
      }

      return prev.map((i) =>
        i.id === id
          ? {
              ...i,
              qty: i.qty - 1,
            }
          : i,
      )
    })
  }

  const total = cart.reduce((sum, i) => {
    const finalPrice =
      Number(i.discount || 0) > 0
        ? Number(i.price) *
          (1 - Number(i.discount || 0) / 100)
        : Number(i.price)

    return (
      sum + finalPrice * Number(i.qty || 1)
    )
  }, 0)

  const grouped = menu.reduce((acc: any, item: any) => {
    const key = item.category || "Other"

    if (!acc[key]) {
      acc[key] = []
    }

    acc[key].push(item)

    return acc
  }, {})

  const jumpToCategory = (
    category: string,
  ) => {
    const el =
      sectionRefs.current[
        category
      ]

    if (!el) return

    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })

    setShowCategories(false)
  }

  const goToCart = () => {
    if (
      business?.isOpen === false
    ) {
      alert(
        "Restaurant is currently closed",
      )
      return
    }

    if (
      business?.paymentsReady === false
    ) {
      alert(
        business?.paymentMessage ||
          "Online ordering is temporarily unavailable.",
      )
      return
    }

    localStorage.setItem(
      "cart",
      JSON.stringify(cart),
    )

    window.location.href =
      `/cart?storeCode=${storeCode}&table=${table}`
  }

  const showCartBar =
    cart.length > 0 &&
    business?.isOpen === true &&
    business?.paymentsReady !== false

  return (
    <>
      <style>{css}</style>

      <div
        className={`sticky-header ${
          scrolled ? "visible" : ""
        }`}
      >
        <div className="sticky-header-name">
          {business?.cafeName ||
            business?.name ||
            storeCode}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            className="sticky-status-dot"
            style={{
              background:
                business?.isOpen === true
                  ? "#639922"
                  : "#C23B3B",
            }}
          />

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color:
                business?.isOpen === true
                  ? "#639922"
                  : "#C23B3B",
            }}
          >
            {business?.isOpen === true
              ? "Open"
              : "Closed"}
          </span>
        </div>
      </div>

      {showSuccess && (
        <div className="success-popup">
          <div className="success-card">
            <div className="success-title">
              ✅ Order Placed
            </div>

            <div className="success-sub">
              Your order has been sent to the kitchen.
            </div>

            <div
              className="receipt-box"
              ref={receiptRef}
            >
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 18,
                  borderBottom:
                    "1px dashed #ccc",
                  paddingBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    marginBottom: 4,
                  }}
                >
                  {business?.cafeName ||
                    "CaviarQR"}
                </div>

                <div
                  style={{
                    color: "#666",
                    fontSize: 13,
                  }}
                >
                  Digital Receipt
                </div>
              </div>

              <div className="receipt-row">
                <span>Order</span>

                <b>
                  #
                  {Math.floor(
                    Math.random() *
                      100000,
                  )}
                </b>
              </div>

              <div className="receipt-row">
                <span>Table</span>

                <b>{table}</b>
              </div>

              <div className="receipt-row">
                <span>Date</span>

                <b>
                  {new Date().toLocaleString()}
                </b>
              </div>

              <div
                style={{
                  borderTop:
                    "1px dashed #ccc",
                  marginTop: 16,
                  paddingTop: 16,
                }}
              >
                {receiptItems.map(
                  (
                    item: any,
                    i: number,
                  ) => {
                    const finalPrice =
                      Number(
                        item.discount ||
                          0,
                      ) > 0
                        ? Number(
                            item.price,
                          ) *
                          (1 -
                            Number(
                              item.discount ||
                                0,
                            ) /
                              100)
                        : Number(
                            item.price,
                          )

                    return (
                      <div
                        className="receipt-row"
                        key={i}
                        style={{
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                            }}
                          >
                            {item.name}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#777",
                              marginTop: 2,
                            }}
                          >
                            Qty{" "}
                            {item.qty ||
                              1}
                          </div>
                        </div>

                        <b>
                          $
                          {(
                            finalPrice *
                            (item.qty ||
                              1)
                          ).toFixed(2)}
                        </b>
                      </div>
                    )
                  },
                )}
              </div>

              <div
                style={{
                  borderTop:
                    "1px dashed #ccc",
                  marginTop: 16,
                  paddingTop: 16,
                }}
              >
                <div className="receipt-row">
                  <span>
                    Subtotal
                  </span>

                  <b>
                    $
                    {receiptItems
                      .reduce(
                        (
                          sum,
                          item,
                        ) => {
                          const finalPrice =
                            Number(
                              item.discount ||
                                0,
                            ) > 0
                              ? Number(
                                  item.price,
                                ) *
                                (1 -
                                  Number(
                                    item.discount ||
                                      0,
                                  ) /
                                    100)
                              : Number(
                                  item.price,
                                )

                          return (
                            sum +
                            finalPrice *
                              (item.qty ||
                                1)
                          )
                        },
                        0,
                      )
                      .toFixed(2)}
                  </b>
                </div>

                <div className="receipt-row">
                  <span>
                    Service Fee (
                    {business?.serviceFee || 0}%)
                  </span>

                  <b>
                    $
                    {receiptServiceFee.toFixed(
                      2,
                    )}
                  </b>
                </div>

                <div className="receipt-total">
                  <span>Total</span>

                  <span>
                    $
                    {(
                      receiptItems.reduce(
                        (
                          sum,
                          item,
                        ) => {
                          const finalPrice =
                            Number(
                              item.discount ||
                                0,
                            ) > 0
                              ? Number(
                                  item.price,
                                ) *
                                (1 -
                                  Number(
                                    item.discount ||
                                      0,
                                  ) /
                                    100)
                              : Number(
                                  item.price,
                                )

                          return (
                            sum +
                            finalPrice *
                              (item.qty ||
                                1)
                          )
                        },
                        0,
                      ) +
                      receiptServiceFee
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: 26,
                  textAlign: "center",
                  color: "#777",
                  fontSize: 12,
                  borderTop:
                    "1px dashed #ccc",
                  paddingTop: 16,
                }}
              >
                Thank you for dining with us ❤️
                <br />
                Powered by CaviarQR
              </div>
            </div>

            <button
              className="success-btn receipt-download"
              onClick={
                downloadReceipt
              }
            >
              Download JPEG Receipt
            </button>

            <button
              className="success-btn"
              onClick={() =>
                setShowSuccess(false)
              }
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showCategories && (
        <div
          onClick={() =>
            setShowCategories(false)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,.45)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 320,
              background: "#111",
              color: "#fff",
              borderRadius: 24,
              padding: 24,
              maxHeight: "70vh",
              overflowY: "auto",
            }}
          >
            {Object.keys(grouped).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    jumpToCategory(
                      cat,
                    )
                  }
                  style={{
                    width: "100%",
                    background:
                      "transparent",
                    border: "none",
                    color: "#fff",
                    display: "flex",
                    justifyContent:
                      "space-between",
                    padding:
                      "14px 0",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                >
                  <span>
                    {cat}
                  </span>

                  <span>
                    {
                      grouped[
                        cat
                      ].length
                    }
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-wrap">
          <div className="spinner" />
          <div>Loading menu…</div>
        </div>
      ) : (
        <div className="store">
          <div className="store-hero">
            {business?.coverUrl ||
            business?.logoUrl ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL}/${
                  (
                    business?.coverUrl ||
                    business?.logoUrl
                  ).replace(/^\/+/g, "")
                }`}
                alt="Cover"
              />
            ) : (
              <div className="store-hero-placeholder">
                🍽️
              </div>
            )}

            <div className="store-hero-overlay" />
          </div>

          <div className="store-info">
            <div className="store-name">
              {business?.cafeName ||
                business?.name ||
                storeCode}
            </div>

            <div className="store-meta">
              <span className="meta-pill open">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background:
                        business?.isOpen === true
                          ? "#639922"
                          : "#C23B3B",
                    }}
                  />

                  <span
                    style={{
                      color:
                        business?.isOpen === true
                          ? "#639922"
                          : "#C23B3B",
                      fontWeight: 500,
                    }}
                  >
                    {business?.isOpen === true
                      ? "Open"
                      : "Closed"}
                  </span>
                </div>
              </span>

              <span className="meta-pill">
                🪑 Table {table}
              </span>
            </div>
          </div>

          <div className="divider" />

          {business?.isOpen === false && (
            <div className="closed-banner">
              🔒 Restaurant Closed
              <br />
              Ordering is currently unavailable.
            </div>
          )}

          {business?.isOpen === true &&
            business?.paymentsReady === false && (
              <div className="payment-banner">
                ⚠️ Online ordering is temporarily unavailable.
                <div className="payment-banner-sub">
                  {business?.paymentMessage ||
                    "The restaurant is finishing payment setup."}
                </div>
              </div>
            )}

          {Object.keys(grouped).map((cat) => (
            <div
              key={cat}
              className="cat-section"
              ref={(el) =>
                (sectionRefs.current[
                  cat
                ] = el)
              }
            >
              <div className="cat-label">
                {cat}
              </div>

              {grouped[cat].map((i: any) => {
                if (i.isHidden) return null

                const isOut =
                  i.isOutOfStock === true

                const cartItem = cart.find(
                  (c) => c.id === i.id,
                )

                const discountedPrice =
                  i.discount > 0
                    ? (
                        i.price *
                        (1 - i.discount / 100)
                      ).toFixed(2)
                    : null

                return (
                  <div
                    key={i.id}
                    className="menu-row"
                    style={{
                      opacity:
                        business?.isOpen === false ||
                        business?.paymentsReady === false
                          ? 0.45
                          : 1,
                    }}
                  >
                    <div className="menu-info">
                      <div className="menu-item-name">
                        {i.name}
                      </div>

                      {i.description && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "#666",
                            marginTop: 4,
                            marginBottom: 6,
                          }}
                        >
                          {i.description}
                        </div>
                      )}

                      <div className="price-row">
                        {isOut && (
                          <span
                            style={{
                              background: "#fee2e2",
                              color: "#b91c1c",
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              marginRight: 8,
                            }}
                          >
                            SOLD OUT
                          </span>
                        )}                        {discountedPrice ? (
                          <>
                            <span className="price-original">
                              ${i.price}
                            </span>

                            <span className="price-final">
                              ${discountedPrice}
                            </span>

                            <span className="discount-tag">
                              {i.discount}% off
                            </span>
                          </>
                        ) : (
                          <span className="price-normal">
                            ${i.price}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="menu-right">
                      <div className="menu-img-wrap">
                        <img
                          src={
                            i.imageUrl
                              ? `${process.env.NEXT_PUBLIC_API_URL}${i.imageUrl}`
                              : "https://via.placeholder.com/80"
                          }
                          alt={i.name}
                        />
                      </div>

                      {business?.isOpen === false ? null : cartItem ? (
                        <div className="qty-control">
                          <button
                            className="qty-btn"
                            onClick={() =>
                              removeFromCart(i.id)
                            }
                          >
                            −
                          </button>

                          <span className="qty-num">
                            {cartItem.qty}
                          </span>

                          <button
                            className="qty-btn"
                            onClick={() => {
                              if (isOut) return

                              if (business?.paymentsReady === false) {
                                alert(
                                  business?.paymentMessage ||
                                    "Online ordering is temporarily unavailable.",
                                )
                                return
                              }

                              addToCart(i)
                            }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-btn"
                          onClick={() => {
                            if (isOut) return

                            if (business?.paymentsReady === false) {
                              alert(
                                business?.paymentMessage ||
                                  "Online ordering is temporarily unavailable.",
                              )
                              return
                            }

                            addToCart(i)
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <button
          className="menu-nav-fab"
          onClick={() =>
            setShowCategories(true)
          }
          style={{
            bottom: showCartBar
              ? 175
              : 95,
          }}
        >
          <div
            style={{
              fontSize: 22,
              marginBottom: 2,
            }}
          >
            ☰
          </div>

          ITEMS
        </button>
      )}

      {showCartBar && (
        <div className="cart-bar">
          <button
            className="pay-btn"
            onClick={goToCart}
          >
            View Cart • $
            {total.toFixed(2)}
          </button>
        </div>
      )}
    </>
  )
}