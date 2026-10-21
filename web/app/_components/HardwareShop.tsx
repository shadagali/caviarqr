'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

const API =
  (
    process.env
      .NEXT_PUBLIC_API_URL ||
    'https://api.caviarqr.com'
  ).replace(/\/+$/, '')

type Product = {
  id: number
  name: string
  description: string
  priceCents: number
  imageUrl: string | null
  inventory: number
  active: boolean
}

function money(
  cents: number,
) {
  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
    },
  ).format(
    Number(cents || 0) / 100,
  )
}

function imageUrl(
  value: string | null,
) {
  if (!value) {
    return ''
  }

  if (
    value.startsWith(
      'http://',
    ) ||
    value.startsWith(
      'https://',
    )
  ) {
    return value
  }

  return `${API}${
    value.startsWith('/')
      ? value
      : `/${value}`
  }`
}

function clampQuantity(
  value: number,
  inventory: number,
) {
  const maximum =
    Math.max(
      1,
      Math.min(
        1000,
        Number(inventory || 0),
      ),
    )

  if (
    !Number.isFinite(value)
  ) {
    return 1
  }

  return Math.max(
    1,
    Math.min(
      maximum,
      Math.floor(value),
    ),
  )
}

export default function ShopPage() {
  const router = useRouter()

  const [
    products,
    setProducts,
  ] = useState<Product[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    loadError,
    setLoadError,
  ] = useState('')

  const [
    quantityByProduct,
    setQuantityByProduct,
  ] = useState<
    Record<number, number>
  >({})

  const [
    cart,
    setCart,
  ] = useState<
    Record<number, number>
  >({})

  const [
    checkingOut,
    setCheckingOut,
  ] = useState(false)

  const [
    checkoutError,
    setCheckoutError,
  ] = useState('')

  const [
    salesCode,
    setSalesCode,
  ] = useState('')

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('')

  const [
    canceledMessage,
    setCanceledMessage,
  ] = useState('')

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      )

    /*
     * Sales Partners may share:
     * /shop?sales=THEIRCODE
     *
     * This only pre-fills the code.
     * Partner identity and any discount
     * are still resolved by the backend.
     */
    const referralCode =
      String(
        params.get('sales') || '',
      )
        .trim()
        .toUpperCase()
        .slice(0, 32)

    if (referralCode) {
      setSalesCode(
        referralCode,
      )
    }

    if (
      params.get('success') === '1'
    ) {
      const order =
        params.get('order')

      setSuccessMessage(
        order
          ? `Thank you. Your order ${order} has been received.`
          : 'Thank you. Your order has been received.',
      )

      setCart({})
    }

    if (
      params.get('canceled') === '1'
    ) {
      setCanceledMessage(
        'Checkout was canceled. Your cart is still here.',
      )
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadProducts() {
      try {
        setLoading(true)
        setLoadError('')

        const response =
          await fetch(
            `${API}/shop/products`,
            {
              cache: 'no-store',
            },
          )

        if (!response.ok) {
          throw new Error(
            'Products could not be loaded.',
          )
        }

        const data =
          (await response.json()) as Product[]

        if (!active) {
          return
        }

        const list =
          Array.isArray(data)
            ? data
            : []

        setProducts(list)

        const next:
          Record<number, number> =
          {}

        for (
          const product of list
        ) {
          next[product.id] = 1
        }

        setQuantityByProduct(
          next,
        )
      } catch (error) {
        if (!active) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Products could not be loaded.',
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [])

  const cartLines =
    useMemo(
      () =>
        products
          .map(
            (product) => ({
              product,
              quantity:
                Number(
                  cart[
                    product.id
                  ] || 0,
                ),
            }),
          )
          .filter(
            (line) =>
              line.quantity > 0,
          ),
      [
        products,
        cart,
      ],
    )

  const cartCount =
    cartLines.reduce(
      (
        total,
        line,
      ) =>
        total +
        line.quantity,
      0,
    )

  const subtotalCents =
    cartLines.reduce(
      (
        total,
        line,
      ) =>
        total +
        line.product
          .priceCents *
          line.quantity,
      0,
    )

  function setProductQuantity(
    product: Product,
    rawValue: number,
  ) {
    const quantity =
      clampQuantity(
        rawValue,
        product.inventory,
      )

    setQuantityByProduct(
      (current) => ({
        ...current,
        [product.id]:
          quantity,
      }),
    )
  }

  function addToCart(
    product: Product,
  ) {
    if (
      product.inventory < 1
    ) {
      return
    }

    const quantity =
      clampQuantity(
        quantityByProduct[
          product.id
        ] || 1,
        product.inventory,
      )

    setCart(
      (current) => {
        const currentQuantity =
          Number(
            current[
              product.id
            ] || 0,
          )

        const next =
          Math.min(
            1000,
            product.inventory,
            currentQuantity +
              quantity,
          )

        return {
          ...current,
          [product.id]:
            next,
        }
      },
    )

    setCheckoutError('')
  }

  function changeCartQuantity(
    product: Product,
    rawValue: number,
  ) {
    if (rawValue <= 0) {
      setCart(
        (current) => {
          const next = {
            ...current,
          }

          delete next[
            product.id
          ]

          return next
        },
      )

      return
    }

    const quantity =
      clampQuantity(
        rawValue,
        product.inventory,
      )

    setCart(
      (current) => ({
        ...current,
        [product.id]:
          quantity,
      }),
    )
  }

  async function checkout() {
    if (
      cartLines.length < 1
    ) {
      setCheckoutError(
        'Your cart is empty.',
      )

      return
    }

    try {
      setCheckingOut(true)
      setCheckoutError('')

      const response =
        await fetch(
          `${API}/shop/checkout`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                items:
                  cartLines.map(
                    ({
                      product,
                      quantity,
                    }) => ({
                      productId:
                        product.id,

                      quantity,
                    }),
                  ),

                /*
                 * The backend resolves this
                 * to an ACTIVE Sales Partner
                 * and calculates any discount.
                 */
                salesCode:
                  salesCode
                    .trim()
                    .toUpperCase() ||
                  undefined,
              }),
          },
        )

      const data =
        (await response.json()) as {
          url?: string
          message?: string
        }

      if (
        !response.ok ||
        !data.url
      ) {
        throw new Error(
          data.message ||
            'Checkout could not be started.',
        )
      }

      window.location.href =
        data.url
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Checkout could not be started.',
      )

      setCheckingOut(false)
    }
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f7f7f5;
          color: #161616;
          font-family:
            Inter,
            ui-sans-serif,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        .shop-root {
          min-height: 100vh;
          background:
            linear-gradient(
              180deg,
              #ffffff 0%,
              #f7f7f5 100%
            );
        }

        .shop-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 74px;
          padding: 0 5vw;
          background:
            rgba(
              255,
              255,
              255,
              0.94
            );
          border-bottom:
            1px solid #e8e8e5;
          backdrop-filter:
            blur(14px);
        }

        .brand {
          border: 0;
          background: transparent;
          cursor: pointer;
          color: #171717;
          font-family:
            Georgia,
            serif;
          font-size: 1.35rem;
          letter-spacing: 0.08em;
        }

        .brand span {
          color: #8b7355;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .home-link {
          border: 0;
          background: transparent;
          cursor: pointer;
          color: #666;
          font-size: 0.88rem;
        }

        .cart-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 999px;
          background: #171717;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .hero {
          max-width: 1240px;
          margin: 0 auto;
          padding:
            78px
            32px
            48px;
          text-align: center;
        }

        .eyebrow {
          margin-bottom: 16px;
          color: #8b7355;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .hero h1 {
          max-width: 830px;
          margin:
            0 auto
            20px;
          font-family:
            Georgia,
            serif;
          font-size:
            clamp(
              2.5rem,
              6vw,
              5rem
            );
          font-weight: 400;
          line-height: 0.98;
          letter-spacing: -0.035em;
        }

        .hero p {
          max-width: 630px;
          margin: 0 auto;
          color: #676767;
          font-size: 1rem;
          line-height: 1.7;
        }

        .notice {
          max-width: 900px;
          margin:
            0 auto
            28px;
          padding:
            14px
            18px;
          border-radius: 12px;
          font-size: 0.9rem;
          text-align: center;
        }

        .notice.success {
          background: #eef7ef;
          color: #245f2e;
          border:
            1px solid #d6ead8;
        }

        .notice.canceled {
          background: #f7f4ed;
          color: #6f5938;
          border:
            1px solid #e8dfce;
        }

        .shop-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            370px;
          gap: 34px;
          max-width: 1240px;
          margin: 0 auto;
          padding:
            20px
            32px
            90px;
        }

        .products {
          display: grid;
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );
          gap: 24px;
          align-content: start;
        }

        .loading-card,
        .empty-card {
          grid-column: 1 / -1;
          padding: 60px 30px;
          background: white;
          border:
            1px solid #e7e7e3;
          border-radius: 18px;
          color: #666;
          text-align: center;
        }

        .product {
          overflow: hidden;
          background: white;
          border:
            1px solid #e6e6e2;
          border-radius: 18px;
          box-shadow:
            0 10px 40px
            rgba(
              0,
              0,
              0,
              0.035
            );
        }

        .product-image {
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          background:
            linear-gradient(
              145deg,
              #f0eee8,
              #faf9f6
            );
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .image-placeholder {
          color: #9a8a75;
          font-family:
            Georgia,
            serif;
          font-size: 1.2rem;
          letter-spacing: 0.06em;
        }

        .product-body {
          padding: 24px;
        }

        .product-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .product h2 {
          margin: 0;
          font-family:
            Georgia,
            serif;
          font-size: 1.65rem;
          font-weight: 400;
          line-height: 1.15;
        }

        .price {
          white-space: nowrap;
          font-size: 1.04rem;
          font-weight: 700;
        }

        .description {
          min-height: 50px;
          margin:
            14px 0
            20px;
          color: #696969;
          font-size: 0.92rem;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .stock {
          margin-bottom: 12px;
          color: #757575;
          font-size: 0.78rem;
        }

        .stock.out {
          color: #9a3232;
        }

        .buy-row {
          display: grid;
          grid-template-columns:
            125px
            minmax(0, 1fr);
          gap: 10px;
        }

        .qty-control {
          display: grid;
          grid-template-columns:
            34px
            1fr
            34px;
          min-height: 46px;
          border:
            1px solid #d9d9d5;
          border-radius: 10px;
          overflow: hidden;
          background: white;
        }

        .qty-control button {
          border: 0;
          background: #f7f7f5;
          cursor: pointer;
          font-size: 1rem;
        }

        .qty-control input {
          width: 100%;
          border: 0;
          outline: 0;
          text-align: center;
          appearance:
            textfield;
          -moz-appearance:
            textfield;
        }

        .qty-control input::-webkit-inner-spin-button,
        .qty-control input::-webkit-outer-spin-button {
          margin: 0;
          appearance: none;
        }

        .add-button {
          min-height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 10px;
          background: #171717;
          color: white;
          cursor: pointer;
          font-size: 0.88rem;
          font-weight: 700;
        }

        .add-button:disabled {
          cursor: not-allowed;
          opacity: 0.4;
        }

        .cart {
          position: sticky;
          top: 100px;
          align-self: start;
          overflow: hidden;
          background: white;
          border:
            1px solid #e5e5e1;
          border-radius: 18px;
          box-shadow:
            0 14px 50px
            rgba(
              0,
              0,
              0,
              0.05
            );
        }

        .cart-head {
          padding:
            22px
            22px
            18px;
          border-bottom:
            1px solid #eeeeeb;
        }

        .cart-head small {
          display: block;
          margin-bottom: 6px;
          color: #8b7355;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .cart-head h3 {
          margin: 0;
          font-family:
            Georgia,
            serif;
          font-size: 1.5rem;
          font-weight: 400;
        }

        .cart-empty {
          padding: 34px 22px;
          color: #777;
          font-size: 0.88rem;
          line-height: 1.6;
        }

        .cart-lines {
          display: flex;
          flex-direction: column;
          max-height: 390px;
          overflow: auto;
        }

        .cart-line {
          padding:
            18px
            22px;
          border-bottom:
            1px solid #efefec;
        }

        .cart-line-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
        }

        .cart-line strong {
          font-size: 0.9rem;
        }

        .cart-line-price {
          white-space: nowrap;
          font-size: 0.86rem;
          font-weight: 700;
        }

        .cart-line-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mini-qty {
          display: grid;
          grid-template-columns:
            30px
            55px
            30px;
          height: 36px;
          border:
            1px solid #dfdfdb;
          border-radius: 8px;
          overflow: hidden;
        }

        .mini-qty button {
          border: 0;
          background: #f7f7f5;
          cursor: pointer;
        }

        .mini-qty input {
          width: 100%;
          border: 0;
          outline: 0;
          text-align: center;
        }

        .remove {
          border: 0;
          background: transparent;
          color: #999;
          cursor: pointer;
          font-size: 0.77rem;
          text-decoration: underline;
        }

        .cart-summary {
          padding: 22px;
        }

        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          color: #636363;
          font-size: 0.87rem;
        }

        .summary-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin:
            18px 0;
          padding-top: 18px;
          border-top:
            1px solid #e8e8e5;
          font-size: 1.05rem;
          font-weight: 700;
        }

        .sales-code {
          margin:
            4px 0
            18px;
          padding:
            14px 0
            18px;
          border-bottom:
            1px solid #e8e8e5;
        }

        .sales-code label {
          display: block;
          margin-bottom: 7px;
          color: #636363;
          font-size: 0.78rem;
          font-weight: 650;
        }

        .sales-code input {
          width: 100%;
          min-height: 44px;
          padding:
            0 12px;
          border:
            1px solid #d9d9d5;
          border-radius: 9px;
          outline: none;
          background: white;
          color: #171717;
          text-transform: uppercase;
        }

        .sales-code input:focus {
          border-color: #8b7355;
        }

        .sales-code small {
          display: block;
          margin-top: 7px;
          color: #8a8a8a;
          font-size: 0.71rem;
          line-height: 1.45;
        }

        .checkout {
          width: 100%;
          min-height: 52px;
          border: 0;
          border-radius: 10px;
          background: #171717;
          color: white;
          cursor: pointer;
          font-weight: 750;
          letter-spacing: 0.01em;
        }

        .checkout:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .checkout-error {
          margin:
            12px 0
            0;
          color: #a33434;
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .secure-note {
          margin:
            13px 0
            0;
          color: #8a8a8a;
          font-size: 0.73rem;
          line-height: 1.5;
          text-align: center;
        }

        .footer {
          padding:
            28px
            32px
            45px;
          border-top:
            1px solid #e7e7e3;
          color: #888;
          font-size: 0.78rem;
          text-align: center;
        }

        @media (
          max-width: 900px
        ) {
          .shop-layout {
            grid-template-columns:
              1fr;
          }

          .cart {
            position: static;
          }
        }

        @media (
          max-width: 680px
        ) {
          .shop-header {
            min-height: 64px;
            padding: 0 18px;
          }

          .home-link {
            display: none;
          }

          .hero {
            padding:
              56px
              20px
              32px;
          }

          .shop-layout {
            padding:
              10px
              16px
              60px;
          }

          .products {
            grid-template-columns:
              1fr;
          }

          .buy-row {
            grid-template-columns:
              1fr;
          }

          .product-body {
            padding: 20px;
          }
        }
      `}</style>

      <main className="shop-root">
        <header className="shop-header">
          <button
            className="brand"
            onClick={() =>
              router.push('/')
            }
          >
            Caviar
            <span>QR</span>
          </button>

          <div className="header-right">
            <button
              className="home-link"
              onClick={() =>
                router.push('/')
              }
            >
              Back to CaviarQR
            </button>

            <div className="cart-pill">
              Cart
              <span>
                {cartCount}
              </span>
            </div>
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            CaviarQR Hardware
          </div>

          <h1>
            QR stands built for
            modern restaurants.
          </h1>

          <p>
            Order your CaviarQR
            table stands, choose
            the quantity you need,
            and checkout securely
            with Stripe.
          </p>
        </section>

        {successMessage && (
          <div className="notice success">
            {successMessage}
          </div>
        )}

        {canceledMessage && (
          <div className="notice canceled">
            {canceledMessage}
          </div>
        )}

        <div className="shop-layout">
          <section className="products">
            {loading && (
              <div className="loading-card">
                Loading products…
              </div>
            )}

            {!loading &&
              loadError && (
                <div className="empty-card">
                  {loadError}
                </div>
              )}

            {!loading &&
              !loadError &&
              products.length ===
                0 && (
                <div className="empty-card">
                  Products are
                  coming soon.
                </div>
              )}

            {products.map(
              (product) => {
                const available =
                  product.inventory >
                  0

                const maximum =
                  Math.min(
                    1000,
                    product.inventory,
                  )

                const quantity =
                  quantityByProduct[
                    product.id
                  ] || 1

                return (
                  <article
                    className="product"
                    key={
                      product.id
                    }
                  >
                    <div className="product-image">
                      {product.imageUrl ? (
                        <img
                          src={imageUrl(
                            product.imageUrl,
                          )}
                          alt={
                            product.name
                          }
                        />
                      ) : (
                        <div className="image-placeholder">
                          CaviarQR
                        </div>
                      )}
                    </div>

                    <div className="product-body">
                      <div className="product-top">
                        <h2>
                          {
                            product.name
                          }
                        </h2>

                        <div className="price">
                          {money(
                            product.priceCents,
                          )}
                        </div>
                      </div>

                      <div className="description">
                        {
                          product.description
                        }
                      </div>

                      <div
                        className={`stock ${
                          available
                            ? ''
                            : 'out'
                        }`}
                      >
                        {available
                          ? `${product.inventory.toLocaleString()} available`
                          : 'Sold out'}
                      </div>

                      <div className="buy-row">
                        <div className="qty-control">
                          <button
                            type="button"
                            disabled={
                              !available
                            }
                            onClick={() =>
                              setProductQuantity(
                                product,
                                quantity -
                                  1,
                              )
                            }
                          >
                            −
                          </button>

                          <input
                            type="number"
                            min={1}
                            max={
                              maximum
                            }
                            value={
                              quantity
                            }
                            disabled={
                              !available
                            }
                            onChange={(
                              event,
                            ) =>
                              setProductQuantity(
                                product,
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                              )
                            }
                            aria-label={`Quantity for ${product.name}`}
                          />

                          <button
                            type="button"
                            disabled={
                              !available
                            }
                            onClick={() =>
                              setProductQuantity(
                                product,
                                quantity +
                                  1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="add-button"
                          disabled={
                            !available
                          }
                          onClick={() => {
                            addToCart(
                              product,
                            )

                            requestAnimationFrame(() => {
                              document
                                .getElementById(
                                  'shopping-cart',
                                )
                                ?.scrollIntoView({
                                  behavior:
                                    'smooth',
                                  block:
                                    'start',
                                })
                            })
                          }}
                        >
                          {available
                            ? 'Add to cart'
                            : 'Sold out'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              },
            )}
          </section>

          <aside
            id="shopping-cart"
            className="cart"
          >
            <div className="cart-head">
              <small>
                Your order
              </small>

              <h3>
                Shopping cart
              </h3>
            </div>

            {cartLines.length ===
            0 ? (
              <div className="cart-empty">
                Your cart is
                empty. Choose a
                stand and enter
                any quantity from
                1 to 1,000.
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartLines.map(
                    ({
                      product,
                      quantity,
                    }) => (
                      <div
                        className="cart-line"
                        key={
                          product.id
                        }
                      >
                        <div className="cart-line-top">
                          <strong>
                            {
                              product.name
                            }
                          </strong>

                          <span className="cart-line-price">
                            {money(
                              product
                                .priceCents *
                                quantity,
                            )}
                          </span>
                        </div>

                        <div className="cart-line-controls">
                          <div className="mini-qty">
                            <button
                              type="button"
                              onClick={() =>
                                changeCartQuantity(
                                  product,
                                  quantity -
                                    1,
                                )
                              }
                            >
                              −
                            </button>

                            <input
                              type="number"
                              min={1}
                              max={Math.min(
                                1000,
                                product.inventory,
                              )}
                              value={
                                quantity
                              }
                              onChange={(
                                event,
                              ) =>
                                changeCartQuantity(
                                  product,
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                changeCartQuantity(
                                  product,
                                  quantity +
                                    1,
                                )
                              }
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            className="remove"
                            onClick={() =>
                              changeCartQuantity(
                                product,
                                0,
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="cart-summary">
                  <div className="summary-row">
                    <span>
                      Items
                    </span>

                    <strong>
                      {cartCount.toLocaleString()}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {money(
                        subtotalCents,
                      )}
                    </strong>
                  </div>

                  <div className="sales-code">
                    <label
                      htmlFor="sales-partner-code"
                    >
                      Sales Partner code
                      {' '}
                      (optional)
                    </label>

                    <input
                      id="sales-partner-code"
                      type="text"
                      value={salesCode}
                      maxLength={32}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Enter code"
                      disabled={
                        checkingOut
                      }
                      onChange={(
                        event,
                      ) => {
                        const next =
                          event
                            .target
                            .value
                            .toUpperCase()
                            .replace(
                              /[^A-Z0-9_-]/g,
                              '',
                            )
                            .slice(
                              0,
                              32,
                            )

                        setSalesCode(
                          next,
                        )

                        setCheckoutError(
                          '',
                        )
                      }}
                    />

                    <small>
                      If this code has an
                      active hardware
                      promotion, the
                      discount is
                      calculated securely
                      by CaviarQR and
                      shown at Stripe
                      checkout.
                    </small>
                  </div>

                  <div className="summary-total">
                    <span>
                      {salesCode.trim()
                        ? 'Total before discount'
                        : 'Total'}
                    </span>

                    <span>
                      {money(
                        subtotalCents,
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="checkout"
                    disabled={
                      checkingOut ||
                      cartLines.length <
                        1
                    }
                    onClick={() =>
                      void checkout()
                    }
                  >
                    {checkingOut
                      ? 'Opening Stripe…'
                      : 'Checkout'}
                  </button>

                  {checkoutError && (
                    <p className="checkout-error">
                      {
                        checkoutError
                      }
                    </p>
                  )}

                  <p className="secure-note">
                    Secure payment
                    and U.S.
                    shipping address
                    collection are
                    handled by
                    Stripe.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>

        <footer className="footer">
          © CaviarQR, Inc. ·
          Questions?{' '}
          <a href="mailto:caviarqr@gmail.com">
            caviarqr@gmail.com
          </a>
        </footer>
      </main>
    </>
  )
}
