"use client"

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  useSearchParams,
} from "next/navigation"

import axios from "axios"

type CartItem = {
  id: number | string
  name?: string
  price?: number | string
  discount?: number | string
  qty?: number | string
  imageUrl?: string | null
  category?: string | null
  note?: string
}

type MenuSuggestion = {
  id: number | string
  name?: string
  price?: number | string
  discount?: number | string
  imageUrl?: string | null
  category?: string | null
  isHidden?: boolean
  isOutOfStock?: boolean
}

type CheckoutItem = {
  id: number
  qty: number
  note?: string
}

type StoredCheckoutRequest = {
  id: string
  fingerprint: string
}

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


  .cart-note-btn {
    margin-top: 8px;
    border: none;
    background: transparent;
    color: var(--accent);
    font-family: var(--font);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .cart-note-box {
    margin-top: 8px;
  }

  .cart-note-input {
    width: 100%;
    min-height: 72px;
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 9px 10px;
    font-family: var(--font);
    font-size: 12px;
    color: var(--text);
    background: #fff;
    outline: none;
    resize: vertical;
    line-height: 1.4;
  }

  .cart-note-input:focus {
    border-color: #c8c8c8;
  }

  .cart-note-help {
    margin-top: 5px;
    font-size: 10px;
    line-height: 1.4;
    color: var(--text-muted);
  }

  .cart-note-preview {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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

  .cart-qty-control {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 5px;
  }

  .cart-qty-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: #fff;
    color: var(--accent);
    font-family: var(--font);
    font-size: 17px;
    font-weight: 800;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    transition: transform 0.15s ease, opacity 0.15s ease;
  }

  .cart-qty-btn:active:not(:disabled) {
    transform: scale(0.88);
  }

  .cart-qty-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .cart-qty-num {
    min-width: 16px;
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    color: var(--text);
  }

  /* COMPLETE YOUR MEAL */
  .meal-section {
    margin: 18px 0 4px;
    padding: 18px 0 4px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    background: #fff;
  }

  .meal-heading {
    padding: 0 16px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: var(--text);
  }

  .meal-subtitle {
    padding: 4px 16px 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    font-weight: 500;
  }

  .meal-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 12px 16px 10px;
    scrollbar-width: none;
  }

  .meal-tabs::-webkit-scrollbar {
    display: none;
  }

  .meal-tab {
    flex: 0 0 auto;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg2);
    color: var(--text);
    padding: 8px 13px;
    font-family: var(--font);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .meal-tab.active {
    background: var(--text);
    color: #fff;
    border-color: var(--text);
  }

  .meal-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding: 2px 16px 16px;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }

  .meal-scroll::-webkit-scrollbar {
    display: none;
  }

  .meal-card {
    position: relative;
    flex: 0 0 126px;
    min-width: 126px;
    scroll-snap-align: start;
  }

  .meal-image-wrap {
    position: relative;
    width: 126px;
    height: 96px;
    border-radius: 11px;
    overflow: hidden;
    background: var(--bg2);
    border: 1px solid var(--border);
  }

  .meal-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .meal-add {
    position: absolute;
    right: 7px;
    bottom: 7px;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid #dedede;
    background: #fff;
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font);
    font-size: 25px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .meal-add:active {
    transform: scale(0.96);
  }

  .meal-name {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.3;
    font-weight: 700;
    color: var(--text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 31px;
  }

  .meal-price {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 800;
    color: var(--text);
  }

  .meal-old-price {
    margin-left: 5px;
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    text-decoration: line-through;
  }

  .meal-loading {
    padding: 4px 16px 18px;
    font-size: 12px;
    color: var(--text-muted);
  }

  /* EMPTY STATE */
  .empty {
    text-align: center;
    padding: 60px 24px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }

  .empty-sub {
    font-size: 14px;
  }

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

  .summary-row:last-child {
    border-bottom: none;
  }

  .summary-row.total {
    font-size: 16px;
    font-weight: 800;
    background: var(--bg);
  }

  .summary-label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .summary-value {
    font-weight: 700;
  }

  .summary-value.red {
    color: var(--accent);
  }

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

  .payment-warning {
    margin: 16px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #9a3412;
    border-radius: var(--radius);
    padding: 14px 16px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.45;
  }

  .payment-warning-sub {
    font-size: 12px;
    font-weight: 600;
    margin-top: 4px;
    color: #9a3412;
    opacity: 0.85;
  }

  /* FOOTER / PAY */
  .cart-footer {
    position: fixed;
    bottom: 0;
    left: 50%;
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

  .pay-btn:disabled {
    background: #ccc;
    box-shadow: none;
    cursor: not-allowed;
  }

  .pay-btn:active:not(:disabled) {
    background: #e02500;
  }

  .pay-label {
    flex: 1;
    text-align: center;
  }

  .pay-total {
    background: rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 3px 10px;
    font-size: 14px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin: 0 auto;
  }
`

type SupportedCurrency =
  | "usd"
  | "inr"

function normalizeCurrency(
  value: unknown,
): SupportedCurrency {
  return String(
    value ||
      "",
  ).toLowerCase() ===
    "inr"
    ? "inr"
    : "usd"
}

function formatMoney(
  amount: number,
  currency: SupportedCurrency,
) {
  const safeAmount =
    Number.isFinite(
      Number(amount),
    )
      ? Number(amount)
      : 0

  return new Intl.NumberFormat(
    currency === "inr"
      ? "en-IN"
      : "en-US",
    {
      style: "currency",
      currency:
        currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(safeAmount)
}

function normalizeCustomerNote(
  value: unknown,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return ""
  }

  if (typeof value !== "string") {
    throw new Error(
      "Item note must be text.",
    )
  }

  const note =
    value
      .replace(/\r\n?/g, "\n")
      .trim()

  if (note.length > 300) {
    throw new Error(
      "Item note must be 300 characters or fewer.",
    )
  }

  return note
}

function normalizeCheckoutItems(
  cart: CartItem[],
): CheckoutItem[] {
  const itemById =
    new Map<number, CheckoutItem>()

  for (const item of cart) {
    const id =
      Number(item.id)

    const qty =
      Number(item.qty || 1)

    const note =
      normalizeCustomerNote(
        item.note,
      )

    if (
      !Number.isInteger(id) ||
      id < 1
    ) {
      throw new Error(
        "One of the menu items is invalid.",
      )
    }

    if (
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 50
    ) {
      throw new Error(
        "Item quantity must be between 1 and 50.",
      )
    }

    const existing =
      itemById.get(id)

    if (existing) {
      const existingNote =
        existing.note || ""

      if (existingNote !== note) {
        throw new Error(
          "The same menu item cannot have different notes in one checkout.",
        )
      }

      const combinedQty =
        existing.qty + qty

      if (combinedQty > 50) {
        throw new Error(
          "The quantity for one item cannot exceed 50.",
        )
      }

      existing.qty =
        combinedQty

      continue
    }

    itemById.set(
      id,
      {
        id,
        qty,
        ...(note
          ? {
              note,
            }
          : {}),
      },
    )
  }

  if (itemById.size > 99) {
    throw new Error(
      "Your cart contains too many different items.",
    )
  }

  return Array.from(
    itemById.values(),
  ).sort(
    (left, right) =>
      left.id - right.id,
  )
}

function createCartFingerprint(
  storeCode: string,
  tableNumber: number,
  currency: SupportedCurrency,
  items: CheckoutItem[],
) {
  return JSON.stringify({
    storeCode,
    tableNumber,
    currency,
    items,
  })
}

function getCheckoutErrorMessage(
  error: unknown,
) {
  if (
    axios.isAxiosError(error)
  ) {
    const responseMessage =
      error.response?.data?.message

    if (
      Array.isArray(
        responseMessage,
      )
    ) {
      return responseMessage.join(
        "\n",
      )
    }

    if (
      typeof responseMessage ===
        "string" &&
      responseMessage.trim()
    ) {
      return responseMessage
    }

    const responseError =
      error.response?.data?.error

    if (
      typeof responseError ===
        "string" &&
      responseError.trim()
    ) {
      return responseError
    }

    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Payment failed. Please try again."
}

function CartContent() {
  const search =
    useSearchParams()

  const storeCode =
    search.get("storeCode") ||
    ""

  const table =
    Number(
      search.get("table") ||
        0,
    )

  const [cart, setCart] =
    useState<CartItem[]>([])

  const [
    openNotes,
    setOpenNotes,
  ] = useState<Record<number, boolean>>(
    {},
  )

  const updateItemNote = (
    index: number,
    value: string,
  ) => {
    const safeValue =
      value.slice(0, 300)

    setCart((current) => {
      const updated =
        current.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  note: safeValue,
                }
              : item,
        )

      localStorage.setItem(
        "cart",
        JSON.stringify(updated),
      )

      return updated
    })
  }

  const [loading, setLoading] =
    useState(false)

  const [
    businessLoading,
    setBusinessLoading,
  ] = useState(true)

  const [business, setBusiness] =
    useState<any>(null)

  const [menuSuggestions, setMenuSuggestions] =
    useState<MenuSuggestion[]>([])

  const [suggestionsLoading, setSuggestionsLoading] =
    useState(false)

  const [mealCategory, setMealCategory] =
    useState("Popular")

  const currency =
    normalizeCurrency(
      business?.currency,
    )

  const [
    serviceFeeValue,
    setServiceFeeValue,
  ] = useState(0)

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "cart",
      )

    if (!saved) {
      return
    }

    try {
      const parsed =
        JSON.parse(saved)

      setCart(
        Array.isArray(parsed)
          ? parsed
          : [],
      )
    } catch {
      localStorage.removeItem(
        "cart",
      )

      setCart([])
    }
  }, [])

  useEffect(() => {
    const loadBusiness =
      async () => {
        try {
          setBusinessLoading(
            true,
          )

          const apiUrl =
            process.env
              .NEXT_PUBLIC_API_URL

          if (!apiUrl) {
            throw new Error(
              "NEXT_PUBLIC_API_URL is missing.",
            )
          }

          const response =
            await axios.get(
              `${apiUrl}/public/store/${encodeURIComponent(
                storeCode,
              )}`,
            )

          setBusiness(
            response.data
              ?.business ||
              null,
          )

          setServiceFeeValue(
            Number(
              response.data
                ?.business
                ?.serviceFee ||
                0,
            ),
          )
        } catch (error) {
          console.log(
            "SERVICE FEE ERROR",
            error,
          )

          setBusiness(null)
        } finally {
          setBusinessLoading(
            false,
          )
        }
      }

    if (storeCode) {
      void loadBusiness()
    } else {
      setBusinessLoading(
        false,
      )
    }
  }, [storeCode])

  useEffect(() => {
    const loadSuggestions =
      async () => {
        const businessId =
          Number(business?.id)

        if (
          !Number.isInteger(
            businessId,
          ) ||
          businessId < 1
        ) {
          setMenuSuggestions([])
          return
        }

        const apiUrl =
          process.env
            .NEXT_PUBLIC_API_URL

        if (!apiUrl) {
          setMenuSuggestions([])
          return
        }

        try {
          setSuggestionsLoading(
            true,
          )

          const response =
            await axios.get(
              `${apiUrl}/menu/${businessId}`,
            )

          const items =
            Array.isArray(
              response.data,
            )
              ? response.data
              : []

          setMenuSuggestions(
            items.filter(
              (item: MenuSuggestion) =>
                !item.isHidden &&
                !item.isOutOfStock &&
                Number.isInteger(
                  Number(item.id),
                ) &&
                Number(item.id) > 0 &&
                Number(item.price) > 0,
            ),
          )
        } catch (error) {
          console.log(
            "COMPLETE YOUR MEAL ERROR",
            error,
          )

          setMenuSuggestions([])
        } finally {
          setSuggestionsLoading(
            false,
          )
        }
      }

    void loadSuggestions()
  }, [business?.id])

  const recommendationCategories =
    useMemo(() => {
      const values =
        new Map<string, string>()

      const cartIds =
        new Set(
          cart.map((item) =>
            Number(item.id),
          ),
        )

      for (const item of menuSuggestions) {
        if (
          cartIds.has(
            Number(item.id),
          )
        ) {
          continue
        }

        const raw =
          String(
            item.category || "",
          ).trim()

        if (!raw) continue

        const key =
          raw.toLowerCase()

        if (!values.has(key)) {
          values.set(
            key,
            raw
              .split(/\s+/)
              .map(
                (word) =>
                  word
                    ? word[0].toUpperCase() +
                      word.slice(1)
                    : word,
              )
              .join(" "),
          )
        }
      }

      return [
        "Popular",
        ...Array.from(
          values.values(),
        ).slice(0, 4),
      ]
    }, [
      cart,
      menuSuggestions,
    ])

  useEffect(() => {
    if (
      !recommendationCategories.includes(
        mealCategory,
      )
    ) {
      setMealCategory("Popular")
    }
  }, [
    recommendationCategories,
    mealCategory,
  ])

  const recommendedItems =
    useMemo(() => {
      const cartIds =
        new Set(
          cart.map((item) =>
            Number(item.id),
          ),
        )

      const available =
        menuSuggestions.filter(
          (item) =>
            !cartIds.has(
              Number(item.id),
            ),
        )

      if (mealCategory !== "Popular") {
        return available
          .filter(
            (item) =>
              String(
                item.category || "",
              )
                .trim()
                .toLowerCase() ===
              mealCategory
                .trim()
                .toLowerCase(),
          )
          .slice(0, 10)
      }

      const complementPattern =
        /(drink|beverage|juice|coffee|tea|dessert|sweet|side|snack|starter|appetizer|addon|add-on)/i

      return [...available]
        .sort((left, right) => {
          const leftComplement =
            complementPattern.test(
              String(
                left.category || "",
              ),
            )
              ? 1
              : 0

          const rightComplement =
            complementPattern.test(
              String(
                right.category || "",
              ),
            )
              ? 1
              : 0

          if (
            leftComplement !==
            rightComplement
          ) {
            return (
              rightComplement -
              leftComplement
            )
          }

          return (
            Number(left.id) -
            Number(right.id)
          )
        })
        .slice(0, 10)
    }, [
      cart,
      menuSuggestions,
      mealCategory,
    ])

  const addRecommendedItem = (
    suggestion: MenuSuggestion,
  ) => {
    const id =
      Number(suggestion.id)

    if (
      !Number.isInteger(id) ||
      id < 1
    ) {
      return
    }

    setCart((current) => {
      const existingIndex =
        current.findIndex(
          (item) =>
            Number(item.id) ===
            id,
        )

      let updated: CartItem[]

      if (existingIndex >= 0) {
        updated =
          current.map(
            (item, index) => {
              if (
                index !==
                existingIndex
              ) {
                return item
              }

              const nextQty =
                Math.min(
                  50,
                  Number(
                    item.qty || 1,
                  ) + 1,
                )

              return {
                ...item,
                qty: nextQty,
              }
            },
          )
      } else {
        updated = [
          ...current,
          {
            id,
            name:
              suggestion.name ||
              "Menu item",
            price:
              suggestion.price || 0,
            discount:
              suggestion.discount ||
              0,
            imageUrl:
              suggestion.imageUrl ||
              null,
            category:
              suggestion.category ||
              null,
            qty: 1,
          },
        ]
      }

      localStorage.setItem(
        "cart",
        JSON.stringify(updated),
      )

      sessionStorage.removeItem(
        `checkout-request:${storeCode}:${table}`,
      )

      return updated
    })
  }

  const changeCartQuantity = (
    index: number,
    delta: 1 | -1,
  ) => {
    setCart((current) => {
      const item =
        current[index]

      if (!item) {
        return current
      }

      const currentQty =
        Math.max(
          1,
          Number(item.qty || 1),
        )

      let updated: CartItem[]

      if (
        delta === -1 &&
        currentQty <= 1
      ) {
        updated =
          current.filter(
            (_, itemIndex) =>
              itemIndex !== index,
          )

        setOpenNotes({})
      } else {
        const nextQty =
          delta === 1
            ? Math.min(
                50,
                currentQty + 1,
              )
            : Math.max(
                1,
                currentQty - 1,
              )

        updated =
          current.map(
            (cartItem, itemIndex) =>
              itemIndex === index
                ? {
                    ...cartItem,
                    qty: nextQty,
                  }
                : cartItem,
          )
      }

      localStorage.setItem(
        "cart",
        JSON.stringify(updated),
      )

      sessionStorage.removeItem(
        `checkout-request:${storeCode}:${table}`,
      )

      return updated
    })
  }

  const total =
    useMemo(
      () =>
        cart.reduce(
          (
            sum,
            item,
          ) => {
            const price =
              Number(
                item.price ||
                  0,
              )

            const discount =
              Number(
                item.discount ||
                  0,
              )

            const finalPrice =
              discount > 0
                ? price *
                  (
                    1 -
                    discount /
                      100
                  )
                : price

            return (
              sum +
              finalPrice *
                Number(
                  item.qty ||
                    1,
                )
            )
          },
          0,
        ),
      [cart],
    )

  const serviceFee =
    (
      total *
      serviceFeeValue
    ) / 100

  const finalTotal =
    total +
    serviceFee

  const payNow =
    async () => {
      if (loading) {
        return
      }

      if (businessLoading) {
        alert(
          "Checking restaurant payment status. Please try again.",
        )
        return
      }

      if (!business) {
        alert(
          "Restaurant payment status could not be loaded. Please refresh and try again.",
        )
        return
      }

      if (
        business.isOpen ===
        false
      ) {
        alert(
          "Restaurant is currently closed",
        )
        return
      }

      if (
        business.paymentsReady ===
        false
      ) {
        alert(
          business.paymentMessage ||
            "Online ordering is temporarily unavailable.",
        )
        return
      }

      setLoading(true)

      const storageKey =
        `checkout-request:${storeCode}:${table}`

      try {
        const apiUrl =
          process.env
            .NEXT_PUBLIC_API_URL

        if (!apiUrl) {
          throw new Error(
            "Payment configuration is missing.",
          )
        }

        if (!storeCode) {
          throw new Error(
            "Store code is missing.",
          )
        }

        if (
          !Number.isInteger(
            table,
          ) ||
          table < 0 ||
          table > 100000
        ) {
          throw new Error(
            "Table number is invalid.",
          )
        }

        if (
          cart.length === 0
        ) {
          throw new Error(
            "Your cart is empty.",
          )
        }

        if (
          !globalThis.crypto
            ?.randomUUID
        ) {
          throw new Error(
            "This browser cannot securely start Checkout. Please update your browser.",
          )
        }

        const checkoutItems =
          normalizeCheckoutItems(
            cart,
          )

        const fingerprint =
          createCartFingerprint(
            storeCode,
            table,
            currency,
            checkoutItems,
          )

        let checkoutRequestId:
          string | null = null

        const storedValue =
          sessionStorage.getItem(
            storageKey,
          )

        if (storedValue) {
          try {
            const stored =
              JSON.parse(
                storedValue,
              ) as StoredCheckoutRequest

            if (
              stored.fingerprint ===
                fingerprint &&
              typeof stored.id ===
                "string"
            ) {
              checkoutRequestId =
                stored.id
            }
          } catch {
            sessionStorage.removeItem(
              storageKey,
            )
          }
        }

        if (
          !checkoutRequestId
        ) {
          checkoutRequestId =
            globalThis.crypto
              .randomUUID()

          const storedRequest:
            StoredCheckoutRequest = {
            id:
              checkoutRequestId,

            fingerprint,
          }

          sessionStorage.setItem(
            storageKey,
            JSON.stringify(
              storedRequest,
            ),
          )
        }

        const response =
          await axios.post(
            `${apiUrl}/stripe/checkout`,
            {
              storeCode,

              tableNumber:
                table,

              checkoutRequestId,

              /*
               * Only IDs, quantities and the customer
               * note are sent. The backend still loads
               * trusted names, prices, discounts and
               * availability from PostgreSQL.
               */
              items:
                checkoutItems,
            },
            {
              timeout:
                30_000,
            },
          )

        const checkoutUrl =
          response.data?.url

        if (
          typeof checkoutUrl !==
            "string" ||
          !checkoutUrl
        ) {
          throw new Error(
            "Checkout URL was not returned.",
          )
        }

        window.location.assign(
          checkoutUrl,
        )
      } catch (error: unknown) {
        console.log(
          "PAYMENT ERROR",
          error,
        )

        const message =
          getCheckoutErrorMessage(
            error,
          )

        const normalizedMessage =
          message.toLowerCase()

        /*
         * These errors mean the saved request
         * cannot be reused. The next click will
         * generate a fresh UUID.
         */
        if (
          normalizedMessage.includes(
            "expired",
          ) ||
          normalizedMessage.includes(
            "already been completed",
          ) ||
          normalizedMessage.includes(
            "already used for a different checkout",
          )
        ) {
          sessionStorage.removeItem(
            storageKey,
          )
        }

        alert(message)

        setLoading(false)
      }
    }

  const itemCount =
    cart.reduce(
      (
        sum,
        item,
      ) =>
        sum +
        Number(
          item.qty ||
            1,
        ),
      0,
    )

  const paymentBlocked =
    businessLoading ||
    !business ||
    business.isOpen ===
      false ||
    business.paymentsReady ===
      false

  return (
    <>
      <style>{css}</style>

      <div className="cart-page">
        {/* HEADER */}
        <div className="cart-header">
          <h2>Your Order</h2>

          {cart.length > 0 && (
            <div className="cart-subtitle">
              {itemCount} item
              {itemCount !== 1
                ? "s"
                : ""}
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              🛒
            </div>

            <div className="empty-title">
              Your cart is empty
            </div>

            <div className="empty-sub">
              Go back and add some items
            </div>
          </div>
        ) : (
          <>
            {/* TABLE */}
            <div
              style={{
                padding:
                  "14px 16px 0",
              }}
            >
              <span className="table-badge">
                🪑 Table {table}
              </span>
            </div>

            {/* ITEMS */}
            <div className="section-label">
              Items
            </div>

            {cart.map(
              (
                item,
                index,
              ) => {
                const price =
                  Number(
                    item.price ||
                      0,
                  )

                const discount =
                  Number(
                    item.discount ||
                      0,
                  )

                const finalPrice =
                  discount > 0
                    ? price *
                      (
                        1 -
                        discount /
                          100
                      )
                    : price

                const quantity =
                  Number(
                    item.qty ||
                      1,
                  )

                const imageUrl =
                  item.imageUrl
                    ? item.imageUrl.startsWith(
                        "http",
                      )
                      ? item.imageUrl
                      : `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`
                    : "https://via.placeholder.com/60"

                return (
                  <div
                    key={String(
                      item.id,
                    )}
                    className="cart-item"
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <img
                      className="cart-item-img"
                      src={imageUrl}
                      alt={
                        item.name ||
                        "Menu item"
                      }
                    />

                    <div className="cart-item-info">
                      <div className="cart-item-name">
                        {item.name ||
                          "Menu item"}
                      </div>

                      <div className="cart-item-unit">
                        {formatMoney(
                          finalPrice,
                          currency,
                        )}{" "}
                        each
                      </div>


                      <button
                        type="button"
                        className="cart-note-btn"
                        onClick={() => {
                          setOpenNotes(
                            (current) => ({
                              ...current,
                              [index]:
                                !current[index],
                            }),
                          )
                        }}
                      >
                        {openNotes[index]
                          ? "Done"
                          : String(
                                item.note ||
                                  "",
                              ).trim()
                            ? "Edit note"
                            : "+ Add note"}
                      </button>

                      {openNotes[index] && (
                        <div className="cart-note-box">
                          <textarea
                            className="cart-note-input"
                            value={
                              item.note ||
                              ""
                            }
                            maxLength={300}
                            placeholder="Cooking requests, allergies, dietary requirements..."
                            onChange={(event) => {
                              updateItemNote(
                                index,
                                event.target.value,
                              )
                            }}
                          />

                          <div className="cart-note-help">
                            Please tell the restaurant about any allergies or dietary requirements.
                          </div>
                        </div>
                      )}

                      {!openNotes[index] &&
                        String(
                          item.note ||
                            "",
                        ).trim() && (
                          <div className="cart-note-preview">
                            {item.note}
                          </div>
                        )}                    </div>

                    <div className="cart-item-right">
                      <span className="cart-item-price">
                        {formatMoney(
                          finalPrice *
                            quantity,
                          currency,
                        )}
                      </span>

                      <div className="cart-qty-control">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={
                            quantity <= 1
                              ? `Remove ${item.name || "item"} from cart`
                              : `Decrease ${item.name || "item"} quantity`
                          }
                          onClick={() =>
                            changeCartQuantity(
                              index,
                              -1,
                            )
                          }
                        >
                          −
                        </button>

                        <span className="cart-qty-num">
                          {quantity}
                        </span>

                        <button
                          type="button"
                          className="cart-qty-btn"
                          aria-label={`Increase ${item.name || "item"} quantity`}
                          disabled={quantity >= 50}
                          onClick={() =>
                            changeCartQuantity(
                              index,
                              1,
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )
              },
            )}

            {(suggestionsLoading ||
              recommendedItems.length > 0) && (
              <section className="meal-section">
                <div className="meal-heading">
                  Complete your meal
                </div>

                <div className="meal-subtitle">
                  Add a drink, side or something extra before checkout.
                </div>

                {recommendationCategories.length > 1 && (
                  <div className="meal-tabs">
                    {recommendationCategories.map(
                      (category) => (
                        <button
                          key={category}
                          type="button"
                          className={`meal-tab${
                            mealCategory === category
                              ? " active"
                              : ""
                          }`}
                          onClick={() =>
                            setMealCategory(
                              category,
                            )
                          }
                        >
                          {category}
                        </button>
                      ),
                    )}
                  </div>
                )}

                {suggestionsLoading ? (
                  <div className="meal-loading">
                    Loading suggestions…
                  </div>
                ) : (
                  <div className="meal-scroll">
                    {recommendedItems.map(
                      (item) => {
                        const originalPrice =
                          Number(
                            item.price || 0,
                          )

                        const discount =
                          Number(
                            item.discount ||
                              0,
                          )

                        const itemPrice =
                          discount > 0
                            ? originalPrice *
                              (
                                1 -
                                discount /
                                  100
                              )
                            : originalPrice

                        const imageUrl =
                          item.imageUrl
                            ? String(
                                item.imageUrl,
                              ).startsWith(
                                "http",
                              )
                              ? String(
                                  item.imageUrl,
                                )
                              : `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`
                            : "https://via.placeholder.com/126x96"

                        return (
                          <article
                            className="meal-card"
                            key={String(
                              item.id,
                            )}
                          >
                            <div className="meal-image-wrap">
                              <img
                                className="meal-image"
                                src={imageUrl}
                                alt={
                                  item.name ||
                                  "Suggested menu item"
                                }
                              />

                              <button
                                type="button"
                                className="meal-add"
                                aria-label={`Add ${
                                  item.name ||
                                  "item"
                                } to order`}
                                onClick={() =>
                                  addRecommendedItem(
                                    item,
                                  )
                                }
                              >
                                +
                              </button>
                            </div>

                            <div className="meal-name">
                              {item.name ||
                                "Menu item"}
                            </div>

                            <div className="meal-price">
                              {formatMoney(
                                itemPrice,
                                currency,
                              )}

                              {discount > 0 && (
                                <span className="meal-old-price">
                                  {formatMoney(
                                    originalPrice,
                                    currency,
                                  )}
                                </span>
                              )}
                            </div>
                          </article>
                        )
                      },
                    )}
                  </div>
                )}
              </section>
            )}

            {!businessLoading &&
              !business && (
                <div className="payment-warning">
                  ⚠️ Restaurant payment status could not be loaded.
                  <div className="payment-warning-sub">
                    Refresh this page before trying to pay.
                  </div>
                </div>
              )}

            {business?.paymentsReady ===
              false && (
              <div className="payment-warning">
                ⚠️ Online ordering is temporarily unavailable.
                <div className="payment-warning-sub">
                  {business?.paymentMessage ||
                    "The restaurant is finishing payment setup."}
                </div>
              </div>
            )}

            {business?.isOpen ===
              false && (
              <div className="payment-warning">
                🔒 Restaurant is currently closed.
                <div className="payment-warning-sub">
                  Ordering is currently unavailable.
                </div>
              </div>
            )}

            {/* BILL SUMMARY */}
            <div className="section-label">
              Bill Summary
            </div>

            <div className="summary-card">
              <div className="summary-row">
                <span className="summary-label">
                  Subtotal
                </span>

                <span className="summary-value">
                  {formatMoney(
                    total,
                    currency,
                  )}
                </span>
              </div>

              <div className="summary-row">
                <span className="summary-label">
                  Service fee
                </span>

                <span className="summary-value">
                  {formatMoney(
                    serviceFee,
                    currency,
                  )}
                </span>
              </div>

              <div className="summary-row total">
                <span>Total</span>

                <span className="summary-value red">
                  {formatMoney(
                    finalTotal,
                    currency,
                  )}
                </span>
              </div>
            </div>
          </>
        )}

        {/* PAY BUTTON */}
        {cart.length > 0 && (
          <div className="cart-footer">
            <button
              className="pay-btn"
              onClick={() => {
                void payNow()
              }}
              disabled={
                loading ||
                paymentBlocked
              }
            >
              {loading ? (
                <div className="spinner" />
              ) : businessLoading ? (
                <span
                  style={{
                    width:
                      "100%",
                    textAlign:
                      "center",
                  }}
                >
                  Checking Payments...
                </span>
              ) : !business ? (
                <span
                  style={{
                    width:
                      "100%",
                    textAlign:
                      "center",
                  }}
                >
                  Payment Status Unavailable
                </span>
              ) : business.isOpen ===
                false ? (
                <span
                  style={{
                    width:
                      "100%",
                    textAlign:
                      "center",
                  }}
                >
                  Restaurant Closed
                </span>
              ) : business.paymentsReady ===
                false ? (
                <span
                  style={{
                    width:
                      "100%",
                    textAlign:
                      "center",
                  }}
                >
                  Ordering Unavailable
                </span>
              ) : (
                <>
                  <span>Pay Now</span>

                  <span className="pay-label" />

                  <span className="pay-total">
                    {formatMoney(
                      finalTotal,
                      currency,
                    )}
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

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading cart...
        </div>
      }
    >
      <CartContent />
    </Suspense>
  )
}