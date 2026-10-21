"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import axios from "axios"
import html2canvas from "html2canvas"
import MenuCustomizationModal from "../../../components/MenuCustomizationModal"
import MenuDescriptionDetails from "../../../components/MenuDescriptionDetails"
import RecommendedMenuGrid from "../../../components/RecommendedMenuGrid"

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

  /* PHOTO_ON_TOP_MENU_CARDS_20261010 */

  .menu-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 12px;
    row-gap: 14px;
  }

  .menu-row .menu-right {
    display: contents;
  }

  .menu-row .menu-img-wrap {
    grid-column: 1 / -1;
    grid-row: 1;
    width: 100%;
    height: clamp(180px, 58vw, 260px);
    min-width: 0;
    border-radius: 16px;
  }

  .menu-row .menu-img-wrap img {
    display: block;
  }

  .menu-row .menu-info {
    grid-column: 1;
    grid-row: 2;
    align-self: start;
  }

  .menu-row .menu-right > .add-btn,
  .menu-row .menu-right > .qty-control {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
    align-self: start;
  }


  .add-btn {
    background: var(--bg);
    border: 2px solid #e5e5e5;
    border-radius: 50%;
    width: 34px;
    height: 34px;
    font-size: 20px;
    font-weight: 400;
    color: #111;
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
    color: #111;
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
    background: #fff;
    color: #111;
    border: none;
    outline: 1px solid #111;
    outline-offset: -1px;
    border-radius: var(--radius);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    padding: 16px 20px;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
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

function formatMoney(
  amount: number,
  currency?: string | null,
) {
  const normalizedCurrency =
    String(currency || "usd")
      .trim()
      .toUpperCase()

  const supportedCurrency =
    normalizedCurrency === "INR"
      ? "INR"
      : "USD"

  return new Intl.NumberFormat(
    supportedCurrency === "INR"
      ? "en-IN"
      : "en-US",
    {
      style: "currency",
      currency: supportedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(Number(amount || 0))
}

export default function StorePage() {
  const params = useParams()
  const search = useSearchParams()

  const storeCode = params.storeCode as string

  const rawTable =
    Number(search.get("table") || 1)

  const table =
    Number.isInteger(rawTable) &&
    rawTable >= 1
      ? rawTable
      : 1

  const [menu, setMenu] = useState<any[]>([])
  const [business, setBusiness] = useState<any>(null)
  const [stand, setStand] = useState<any>(null)
  const [cart, setCart] = useState<any[]>([])

  const [
    customizationItem,
    setCustomizationItem,
  ] = useState<any | null>(
    null,
  )
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

      setStand(
        res.data?.stand || null,
      )

      setBusiness(
        res.data?.business || null,
      )

      setMenu(
        Array.isArray(res.data?.menu)
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

          if (
            res.data?.mode === "stand"
          ) {
            setStand(
              res.data?.stand || null,
            )

            setBusiness(null)
            setMenu([])

            return
          }

          setStand(null)

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

  const getCartKey = (
    item: any,
  ) =>
    String(
      item?.cartKey ||
        `item:${item?.id}`,
    )

  const addToCart = (
    item: any,
  ) => {
    const key =
      getCartKey(item)

    setCart((prev) => {
      const existing =
        prev.find(
          (candidate) =>
            getCartKey(
              candidate,
            ) === key,
        )

      if (existing) {
        return prev.map(
          (candidate) =>
            getCartKey(
              candidate,
            ) === key
              ? {
                  ...candidate,
                  qty:
                    Number(
                      candidate.qty ||
                        1,
                    ) + 1,
                }
              : candidate,
        )
      }

      return [
        ...prev,
        {
          ...item,
          cartKey: key,
          qty: 1,
        },
      ]
    })
  }

  const removeFromCart = (
    idOrKey: any,
  ) => {
    const targetKey =
      String(
        idOrKey,
      ).startsWith(
        "item:",
      )
        ? String(idOrKey)
        : `item:${idOrKey}`

    setCart((prev) => {
      const existing =
        prev.find(
          (candidate) =>
            getCartKey(
              candidate,
            ) ===
            targetKey,
        )

      if (!existing) {
        return prev
      }

      if (
        Number(
          existing.qty ||
            1,
        ) <= 1
      ) {
        return prev.filter(
          (candidate) =>
            getCartKey(
              candidate,
            ) !==
            targetKey,
        )
      }

      return prev.map(
        (candidate) =>
          getCartKey(
            candidate,
          ) ===
          targetKey
            ? {
                ...candidate,
                qty:
                  Number(
                    candidate.qty ||
                      1,
                  ) - 1,
              }
            : candidate,
      )
    })
  }

  const beginAdd = (
    item: any,
  ) => {
    const groups =
      Array.isArray(
        item?.customizations,
      )
        ? item.customizations
        : []

    /*
     * CRITICAL BACKWARD-COMPATIBILITY RULE:
     * no customization groups = old CaviarQR
     * one-tap Add to Cart behavior.
     */
    if (
      groups.length === 0
    ) {
      addToCart(item)
      return
    }

    setCustomizationItem(
      item,
    )
  }

  const addCustomizedItem = (
    result: {
      selections: Array<{
        groupId: string
        optionIds: string[]
      }>
      summary: string[]
      extraPrice: number
    },
  ) => {
    if (
      !customizationItem
    ) {
      return
    }

    const originalPrice =
      Number(
        customizationItem
          .price ||
          0,
      )

    const discount =
      Number(
        customizationItem
          .discount ||
          0,
      )

    const discountedBase =
      discount > 0
        ? originalPrice *
          (
            1 -
            discount /
              100
          )
        : originalPrice

    const finalUnitPrice =
      Number(
        (
          discountedBase +
          Number(
            result.extraPrice ||
              0,
          )
        ).toFixed(2),
      )

    const selectionSignature =
      JSON.stringify(
        [...result.selections]
          .map(
            (selection) => ({
              groupId:
                selection.groupId,
              optionIds:
                [
                  ...selection
                    .optionIds,
                ].sort(),
            }),
          )
          .sort(
            (left, right) =>
              left.groupId
                .localeCompare(
                  right.groupId,
                ),
          ),
      )

    addToCart({
      ...customizationItem,

      /*
       * Cart displays the final unit
       * price. Checkout still ignores
       * this browser price and
       * recalculates it from PostgreSQL.
       */
      price:
        finalUnitPrice,

      discount:
        0,

      cartKey:
        `item:${customizationItem.id}:${selectionSignature}`,

      customizations:
        result.selections,

      customizationSummary:
        result.summary,
    })

    setCustomizationItem(
      null,
    )
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

  if (
    !loading &&
    stand &&
    !business
  ) {
    const totalTables =
      Number(stand?.tables || 0)

    const tableValid =
      Number.isInteger(table) &&
      table >= 1 &&
      table <= totalTables



    return (
      <>
        <style>{css}</style>

        <div
          style={{
            minHeight: "100vh",
            background: "#f7f7f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            fontFamily:
              '"Plus Jakarta Sans", sans-serif',
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: 28,
              padding: "42px 28px",
              textAlign: "center",
              boxShadow:
                "0 18px 60px rgba(0,0,0,.08)",
              border:
                "1px solid rgba(0,0,0,.06)",
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 22,
                background: "#111",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              C
            </div>

            {!tableValid ? (
              <>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#111",
                    marginBottom: 12,
                  }}
                >
                  Invalid Table
                </div>

                <div
                  style={{
                    color: "#666",
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  This table number is not assigned
                  to this CaviarQR stand set.
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 800,
                    color: "#111",
                    marginBottom: 10,
                    letterSpacing: "-0.5px",
                  }}
                >
                  CaviarQR
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "9px 15px",
                    borderRadius: 999,
                    background: "#f1f1ef",
                    color: "#111",
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 10,
                    marginBottom: 22,
                  }}
                >
                  🪑 Table {table}
                </div>

                <div
                  style={{
                    color: "#666",
                    lineHeight: 1.65,
                    fontSize: 15,
                  }}
                >
                  {null}
                </div>
              </>
            )}

            <div
              style={{
                height: 1,
                background: "#ececea",
                margin: "28px 0 20px",
              }}
            />

            <div
              style={{
                fontSize: 12,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 6,
                fontWeight: 700,
              }}
            >
              Store Code
            </div>

            <div
              style={{
                fontSize: 17,
                color: "#111",
                fontWeight: 700,
              }}
            >
              {stand.storeCode}
            </div>
          </div>
        </div>
      </>
    )
  }

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
              <div className="success-sub">
                Your receipt will be emailed to you.
            </div>

            <div
              className="receipt-box" style={{ display: "none" }}
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
                          {formatMoney(
                            finalPrice *
                              (item.qty ||
                                1),
                            business?.currency,
                          )}
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
                    {formatMoney(
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
                      ),
                      business?.currency,
                    )}
                  </b>
                </div>

                <div className="receipt-row">
                  <span>
                    Service Fee (
                    {business?.serviceFee || 0}%)
                  </span>

                  <b>
                    {formatMoney(
                      receiptServiceFee,
                      business?.currency,
                    )}
                  </b>
                </div>

                <div className="receipt-total">
                  <span>Total</span>

                  <span>
                    {formatMoney(
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
                      receiptServiceFee,
                      business?.currency,
                    )}
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
              className="success-btn receipt-download" style={{ display: "none" }}
              onClick={
                downloadReceipt
              }
            >
              Download JPEG Receipt
            </button>

            <button
              className="success-btn"
                style={{
                  background: "#FFFFFF",
                  color: "#000000",
                  border: "1px solid #000000",
                  boxShadow: "none",
                }}
              onClick={() =>
                setShowSuccess(false)
              }
            >
              Done
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

          <RecommendedMenuGrid
            items={Object.keys(grouped)
              .flatMap((cat) => grouped[cat])
              .filter((i: any) => !i.isHidden)}
            cart={cart}
            isOpen={business?.isOpen !== false}
            paymentsReady={business?.paymentsReady !== false}
            paymentMessage={business?.paymentMessage}
            onAdd={(i: any) => beginAdd(i)}
            onRemove={(id: any) => removeFromCart(id)}
            formatPrice={(amount: number) =>
              formatMoney(amount, business?.currency)
            }
          />

          {Object.keys(grouped).map((cat) => (
            <div
              key={cat}
              className="cat-section"
              ref={(el) => {
                sectionRefs.current[
                  cat
                ] = el
              }}
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
                          <MenuDescriptionDetails
                            description={String(i.description)}
                            name={String(i.name)}
                            imageSrc={
                              i.imageUrl
                                ? `${process.env.NEXT_PUBLIC_API_URL}${i.imageUrl}`
                                : undefined
                            }
                            priceText={formatMoney(
                              Number(discountedPrice ?? i.price),
                              business?.currency,
                            )}
                            showAdd={
                              business?.isOpen !== false && !isOut
                            }
                            onAdd={() => {
                              if (isOut) return
                              if (business?.paymentsReady === false) {
                                alert(
                                  business?.paymentMessage ||
                                    "Online ordering is temporarily unavailable.",
                                )
                                return
                              }
                              beginAdd(i)
                            }}
                          />
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
                              {formatMoney(
                                Number(i.price),
                                business?.currency,
                              )}
                            </span>

                            <span className="price-final">
                              {formatMoney(
                                Number(discountedPrice),
                                business?.currency,
                              )}
                            </span>

                            <span className="discount-tag">
                              {i.discount}% off
                            </span>
                          </>
                        ) : (
                          <span className="price-normal">
                            {formatMoney(
                              Number(i.price),
                              business?.currency,
                            )}
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

                      {business?.isOpen === false ? null : cartItem && !(Array.isArray(i.customizations) && i.customizations.length > 0) ? (
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

                              beginAdd(i)
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

                            beginAdd(i)
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

      {customizationItem && (
        <MenuCustomizationModal
          item={customizationItem}
          currency={business?.currency}
          onClose={() =>
            setCustomizationItem(null)
          }
          onAdd={addCustomizedItem}
        />
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
            View Cart • {formatMoney(
              total,
              business?.currency,
            )}
          </button>
        </div>
      )}
    </>
  )
}