"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"
import axios from "axios"
import { io } from "socket.io-client"

export default function KitchenPage() {
  const [orders, setOrders] =
    useState<any[]>([])

  const [pastOrders, setPastOrders] =
    useState<any[]>([])

  const [showHistory, setShowHistory] = useState(false)

  const [tab, setTab] =
    useState<'orders' | 'menu'>(
      'orders',
    )

  const [menuItems, setMenuItems] =
    useState<any[]>([])

  const [isOpen, setIsOpen] =
    useState<boolean | null>(
      null,
    )

  const [refundOrderId, setRefundOrderId] = useState<number | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])

  const [search, setSearch] =
    useState('')

  const [showAddModal,
    setShowAddModal] =
    useState(false)

  const [newName,
    setNewName] =
    useState('')

  const [newPrice,
    setNewPrice] =
    useState('')

  const [newDiscount,
    setNewDiscount] =
    useState('0')

  const [newCategory,
    setNewCategory] =
    useState('food')

  const [newImage,
    setNewImage] =
    useState<File | null>(
      null,
    )

  const [newDescription,
    setNewDescription] =
    useState('')

  const socketRef = useRef<any>(null)

  const storeCode = "cafe1"
  const businessId = 3

  // ─────────────────────────────────────
  // LOAD ORDERS
  // ─────────────────────────────────────
  const load = async () => {
    try {
      const activeRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/order/${storeCode}`,
        )

      const historyRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/order/history/${storeCode}`,
        )

      let activeData: any[] = []
      let historyData: any[] = []

      if (
        Array.isArray(
          activeRes.data,
        )
      ) {
        activeData =
          activeRes.data
      } else if (
        Array.isArray(
          activeRes.data.orders,
        )
      ) {
        activeData =
          activeRes.data.orders
      }

      if (
        Array.isArray(
          historyRes.data,
        )
      ) {
        historyData =
          historyRes.data
      } else if (
        Array.isArray(
          historyRes.data.orders,
        )
      ) {
        historyData =
          historyRes.data.orders
      }

      activeData.sort(
        (a, b) =>
          b.id - a.id,
      )

      historyData.sort(
        (a, b) =>
          b.id - a.id,
      )

      const businessRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/public/store/${storeCode}`,
        )

      const latestOpen =
        businessRes.data
          ?.business
          ?.isOpen === true

      setIsOpen(
        latestOpen,
      )

      setOrders(
        activeData,
      )

      setPastOrders(
        historyData,
      )
    } catch (err) {
      console.log(err)

      setOrders([])

      setPastOrders([])
    }
  }

  // ─────────────────────────────────────
  // LOAD MENU
  // ─────────────────────────────────────
  const loadMenu =
    async () => {
      try {
        const res =
          await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/menu/${businessId}`,
          )

        console.log(
          "MENU ITEMS",
          res.data,
        )

        setMenuItems(
          res.data || [],
        )
      } catch (err) {
        console.log(err)
      }
    }

  // ─────────────────────────────────────
  // TOGGLE KITCHEN OPEN/CLOSED
  // ─────────────────────────────────────
  const toggleKitchen = async () => {
    try {
      const res = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/business/toggle-open/${businessId}`,
      )

      setIsOpen(
        res.data?.isOpen === true,
      )
    } catch (err) {
      console.log(err)
    }
  }

  // ─────────────────────────────────────
  // SOCKET + POLLING FALLBACK
  // ─────────────────────────────────────
  useEffect(() => {
    let poll: any

    const startPolling = () => {
      if (poll) return

      poll = setInterval(() => {
        if (tab === 'orders') {
          load()
        }
      }, 3000)
    }

    const stopPolling = () => {
      if (poll) {
        clearInterval(poll)
        poll = null
      }
    }

    const socket = io(
      process.env.NEXT_PUBLIC_API_URL!,
      {
        transports: [
          "websocket",
          "polling",
        ],

        reconnection: true,

        reconnectionAttempts:
          Infinity,

        reconnectionDelay: 1000,
      },
    )

    socketRef.current = socket

    // 🔥 CONNECT
    socket.on("connect", () => {
      console.log(
        "🔥 SOCKET CONNECTED",
      )

      socket.emit(
        "join",
        businessId,
      )

      stopPolling()

      // 🔥 FORCE LOAD
      load()
    })

    // 🔥 RECONNECT
    socket.on(
      "reconnect",
      () => {
        console.log(
          "🔥 SOCKET RECONNECTED",
        )

        socket.emit(
          "join",
          businessId,
        )

        stopPolling()

        load()
      },
    )

    // 🔥 DISCONNECT
    socket.on(
      "disconnect",
      () => {
        console.log(
          "🔥 SOCKET DISCONNECTED",
        )

        startPolling()
      },
    )

    // 🔥 SOCKET ERROR
    socket.on(
      "connect_error",
      () => {
        console.log(
          "🔥 SOCKET ERROR",
        )

        startPolling()
      },
    )

    // 🔥 NEW ORDER
    socket.on(
      "newOrder",
      (order: any) => {
        console.log(
          "🔥 NEW ORDER",
          order,
        )

        setOrders((prev) => {
          const exists =
            prev.find(
              (o) =>
                o.id ===
                order.id,
            )

          if (exists) {
            return prev
          }

          return [
            order,
            ...prev,
          ]
        })

        // 🔥 HARD SYNC
        setTimeout(() => {
          load()
          loadMenu()
        }, 500)
      },
    )

    // 🔥 ORDER UPDATE
    socket.on(
      "orderUpdate",
      (order: any) => {
        console.log(
          "🔥 ORDER UPDATE",
          order,
        )

        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? order
              : o,
          ),
        )

        setTimeout(() => {
          load()
          loadMenu()
        }, 500)
      },
    )

    // 🔥 INITIAL LOAD
    load()
    loadMenu()

    // 🔥 SAFETY POLL
    startPolling()

    return () => {
      stopPolling()

      socket.off("connect")
      socket.off("disconnect")
      socket.off("reconnect")
      socket.off("connect_error")
      socket.off("newOrder")
      socket.off(
        "orderUpdate",
      )

      socket.disconnect()
    }
  }, [])

  // ─────────────────────────────────────
  // COMPLETE ORDER
  // ─────────────────────────────────────
  const completeOrder = async (
    id: number,
  ) => {
    if (
      !confirm(
        "Mark order as completed?",
      )
    )
      return

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/order/${id}`,
        {
          status: "DONE",
        },
      )

      load()
    } catch (err) {
      console.log(err)
    }
  }

  // ─────────────────────────────────────
  // TOGGLE STOCK
  // ─────────────────────────────────────
  const toggleStock =
    async (id: number) => {
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/stock/${id}`,
        )

        loadMenu()
      } catch (err) {
        console.log(err)
      }
    }

  // ─────────────────────────────────────
  // TOGGLE HIDE
  // ─────────────────────────────────────
  const toggleHide =
    async (id: number) => {
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/hide/${id}`,
        )

        loadMenu()
      } catch (err) {
        console.log(err)
      }
    }

  const createItem =
    async () => {
      if (!newName.trim()) {
        alert("Name required")
        return
      }

      if (
        !newPrice ||
        Number(newPrice) <= 0
      ) {
        alert("Valid price required")
        return
      }

      try {
        let imageUrl = ''

        if (newImage) {
          const fd =
            new FormData()

          fd.append(
            'file',
            newImage,
          )

          const upload =
            await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/menu/upload`,
              fd,
            )

          imageUrl =
            upload.data.url
        }

        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/create`,
          {
            businessId,
            name: newName,
            price:
              Number(
                newPrice,
              ),
            category:
              newCategory,
            discount:
              Number(
                newDiscount,
              ),
            description:
              newDescription,
            imageUrl,
          },
        )

        setShowAddModal(
          false,
        )

        setNewName('')
        setNewPrice('')
        setNewDiscount('0')
        setNewDescription('')
        setNewCategory('food')
        setNewImage(null)

        await Promise.all([
          loadMenu(),
          load(),
        ])
      } catch (err) {
        console.log(err)
        alert(
          'Failed to create item',
        )
      }
    }

  // ─────────────────────────────────────
  // REFUND
  // ─────────────────────────────────────
  const openRefund = (
    id: number,
  ) => {
    setRefundOrderId(id)

    setSelectedItems([])
  }

  const toggleItem = (
    index: number,
  ) => {
    setSelectedItems((prev) =>
      prev.includes(index)
        ? prev.filter(
            (i) => i !== index,
          )
        : [...prev, index],
    )
  }

  const submitRefund = async () => {
    if (!refundOrder) return

    if (
      !confirm(
        "Issue full refund?",
      )
    )
      return

    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/order/refund/${refundOrder.stripePaymentIntentId}`,
      )

      // 🔥 INSTANT UI UPDATE
      setOrders((prev) =>
        prev.map((o) =>
          o.id === refundOrder.id
            ? {
                ...o,
                status:
                  "REFUNDED",
              }
            : o,
        ),
      )

      setRefundOrderId(null)

      load()
    } catch (err) {
      console.log(err)
      alert("Refund failed")
    }
  }

  // ─────────────────────────────────────
  // FILTERS
  // ─────────────────────────────────────
  const currentOrders =
    orders.filter(
      (o) =>
        o.status !== "DONE" &&
        o.status !== "REFUNDED",
    )

  const historyOrders =
    pastOrders

  const visible = showHistory
    ? historyOrders
    : currentOrders

  const refundOrder = orders.find(
    (o) => o.id === refundOrderId,
  )

  // ─────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────
  const elapsed = (
    iso: string,
  ) => {
    const created =
      new Date(iso)

    // 🔥 FIX UTC → LOCAL
    const local =
      new Date(
        created.toLocaleString(
          "en-US",
          {
            timeZone:
              "Asia/Kolkata",
          },
        ),
      )

    const mins = Math.max(
      0,
      Math.floor(
        (Date.now() -
          local.getTime()) /
          60000,
      ),
    )

    if (mins < 1)
      return "just now"

    if (mins === 1)
      return "1 min ago"

    if (mins < 60)
      return `${mins} mins ago`

    const hours =
      Math.floor(mins / 60)

    if (hours === 1)
      return "1 hour ago"

    return `${hours} hours ago`
  }

  const statusConfig: Record<
    string,
    {
      dot: string
      label: string
    }
  > = {
    NEW: {
      dot: "#EF9F27",
      label: "New",
    },

    PREPARING: {
      dot: "#378ADD",
      label: "Preparing",
    },

    READY: {
      dot: "#7B61FF",
      label: "Ready",
    },

    DONE: {
      dot: "#639922",
      label: "Completed",
    },

    REFUNDED: {
      dot: "#A32D2D",
      label: "Refunded",
    },
  }

  // ─────────────────────────────────────
  // UI
  // ─────────────────────────────────────
  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: "#f4f2ed",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <h1
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing:
                "-0.3px",
            }}
          >
            Kitchen
          </h1>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              onClick={() =>
                setTab('orders')
              }
            >
              Orders
            </button>

            <button
              onClick={() =>
                setTab('menu')
              }
            >
              Menu
            </button>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "3px 10px",
              borderRadius: 20,
              background:
                showHistory
                  ? "#E6F1FB"
                  : "#EAF3DE",
              color:
                showHistory
                  ? "#185FA5"
                  : "#3B6D11",
            }}
          >
            {showHistory
              ? `${visible.length} past`
              : `${currentOrders.length} active`}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "#888",
              letterSpacing:
                "0.3px",
            }}
          >
            {showHistory
              ? "Past orders (24h)"
              : "Current orders"}
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: isOpen
                  ? "#4D7A19"
                  : "#A32D2D",
                minWidth: 52,
                textAlign: "right",
              }}
            >
              {isOpen
                ? "OPEN"
                : "CLOSED"}
            </span>

            <button
              onClick={toggleKitchen}
              style={{
                width: 48,
                height: 28,
                borderRadius: 999,
                border: "none",
                background: isOpen
                  ? "#7BC043"
                  : "#D6D3CD",
                position: "relative",
                cursor: "pointer",
                transition:
                  "background 0.18s ease",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 3,
                  left: isOpen
                    ? 23
                    : 3,
                  transition:
                    "left 0.18s ease",
                  boxShadow:
                    "0 1px 4px rgba(0,0,0,0.18)",
                }}
              />
            </button>
          </div>

          <button
            onClick={() =>
              setShowHistory(
                !showHistory,
              )
            }
            style={{
              fontSize: 13,
              padding:
                "7px 16px",
              borderRadius: 8,
              border:
                "0.5px solid #d0cec8",
              background: "white",
              color: "#222",
              cursor: "pointer",
              fontFamily:
                "inherit",
            }}
          >
            {showHistory
              ? "View current"
              : "View past"}
          </button>
        </div>
      </div>

      {tab === 'orders' && (
        <>
          {/* ORDERS */}
          <div
            style={{
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            {visible.length === 0 ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#aaa",
                  fontSize: 14,
                  padding:
                    "60px 0",
                }}
              >
                {showHistory
                  ? "No completed orders in the last 24 hours."
                  : "No active orders right now."}
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: 12,
                }}
              >
                {visible.map((o) => {
                  console.log(
                    "ORDER TIME",
                    o.createdAt,
                  )

                  const sc =
                    statusConfig[
                      o.status
                    ] ?? {
                      dot: "#aaa",
                      label:
                        o.status,
                    }

                  return (
                    <div
                      key={o.id}
                      style={{
                        background:
                          "white",
                        borderRadius: 12,
                        border:
                          "0.5px solid #e0ddd7",
                        padding:
                          "14px 16px",
                        display: "flex",
                        flexDirection:
                          "column",
                        gap: 10,
                        opacity:
                          o.status ===
                            "DONE" ||
                          o.status ===
                            "REFUNDED"
                            ? 0.7
                            : 1,
                      }}
                    >
                      {/* HEADER */}
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          #{o.id}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            padding:
                              "2px 8px",
                            borderRadius: 20,
                            background:
                              "#f4f2ed",
                            color: "#666",
                            border:
                              "0.5px solid #e0ddd7",
                          }}
                        >
                          Table{" "}
                          {o.tableNumber ??
                            "?"}
                        </span>
                      </div>

                      {/* TIME */}
                      {o.createdAt && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#aaa",
                          }}
                        >
                          {elapsed(
                            o.createdAt,
                          )}
                        </span>
                      )}

                      {/* ITEMS */}
                      <div
                        style={{
                          borderTop:
                            "0.5px solid #f0ede8",
                          paddingTop: 10,
                          display: "flex",
                          flexDirection:
                            "column",
                          gap: 5,
                        }}
                      >
                        {o.items?.map(
                          (
                            item: any,
                            idx: number,
                          ) => (
                            <div
                              key={idx}
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                alignItems:
                                  "center",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                }}
                              >
                                {
                                  item.name
                                }
                              </span>

                              <span
                                style={{
                                  fontSize: 11,
                                  padding:
                                    "1px 7px",
                                  borderRadius: 20,
                                  background:
                                    "#f4f2ed",
                                  color:
                                    "#888",
                                }}
                              >
                                x
                                {item.qty ||
                                  1}
                              </span>
                            </div>
                          ),
                        )}
                      </div>

                      {/* STATUS */}
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius:
                              "50%",
                            background:
                              sc.dot,
                            flexShrink: 0,
                          }}
                        />

                        <span
                          style={{
                            fontSize: 12,
                            color: "#888",
                          }}
                        >
                          {sc.label}
                        </span>
                      </div>

                      {/* ACTIONS */}
                      {!showHistory && (
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            marginTop: 2,
                          }}
                        >
                          <button
                            onClick={() =>
                              completeOrder(
                                o.id,
                              )
                            }
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontWeight: 500,
                              padding:
                                "8px 0",
                              borderRadius: 8,
                              border:
                                "none",
                              background:
                                "#639922",
                              color:
                                "#EAF3DE",
                              cursor:
                                "pointer",
                              fontFamily:
                                "inherit",
                            }}
                          >
                            Mark done
                          </button>

                          <button
                            onClick={() =>
                              openRefund(
                                o.id,
                              )
                            }
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontWeight: 500,
                              padding:
                                "8px 0",
                              borderRadius: 8,
                              border:
                                "0.5px solid #e0ddd7",
                              background:
                                "white",
                              color:
                                "#A32D2D",
                              cursor:
                                "pointer",
                              fontFamily:
                                "inherit",
                            }}
                          >
                            Refund
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'menu' && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              marginBottom: 16,
            }}
          >
            <h2>Menu</h2>

            <button
              onClick={() =>
                setShowAddModal(
                  true,
                )
              }
            >
              + Add Item
            </button>
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value,
              )
            }
            placeholder="Search menu..."
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border:
                '1px solid #ddd',
              marginBottom: 16,
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fill,minmax(250px,1fr))',
              gap: 12,
              marginTop: 20,
            }}
          >
          {menuItems
            .filter((item) => {
              const q =
                search.toLowerCase()

              return (
                item.name
                  ?.toLowerCase()
                  .includes(q) ||
                item.category
                  ?.toLowerCase()
                  .includes(q) ||
                item.description
                  ?.toLowerCase()
                  .includes(q)
              )
            })
            .map(
            (item: any) => (
              <div
                key={item.id}
                style={{
                  background:
                    'white',
                  padding: 16,
                  borderRadius: 12,
                  border:
                    '1px solid #eee',
                }}
              >
                {item.imageUrl && (
                  <>
                  {(() => {
                    console.log(
                      "IMAGE URL",
                      `${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`,
                    )
                    return null
                  })()}
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL}${item.imageUrl}`}
                    onError={(e) => {
                      ;(
                        e.target as HTMLImageElement
                      ).src =
                        "/placeholder-food.png"
                    }}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  />
                  </>
                )}

                <h3>
                  {item.name}
                </h3>

                {item.description && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 4,
                      marginBottom: 8,
                    }}
                  >
                    {item.description}
                  </p>
                )}

                <p>
                  ${item.price}
                </p>

                {item.discount > 0 && (
                  <div
                    style={{
                      color: '#4D7A19',
                      fontWeight: 600,
                    }}
                  >
                    {item.discount}% OFF
                  </div>
                )}

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color:
                      item.isOutOfStock
                        ? "#A32D2D"
                        : "#4D7A19",
                  }}
                >
                  {item.isOutOfStock
                    ? "OUT OF STOCK"
                    : "AVAILABLE"}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color:
                      item.isHidden
                        ? "#A32D2D"
                        : "#888",
                  }}
                >
                  {item.isHidden
                    ? "Hidden from customers"
                    : "Visible to customers"}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <button
                    onClick={() =>
                      toggleStock(
                        item.id,
                      )
                    }
                  >
                    {item.isOutOfStock
                      ? 'In Stock'
                      : 'Out Of Stock'}
                  </button>

                  <button
                    onClick={() =>
                      toggleHide(
                        item.id,
                      )
                    }
                  >
                    {item.isHidden
                      ? 'Show'
                      : 'Hide'}
                  </button>
                </div>
              </div>
            ),
          )}
          </div>
        </>
      )}

      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,.4)',
            display: 'flex',
            justifyContent:
              'center',
            alignItems:
              'center',
            zIndex: 999,
          }}
        >
          <div
            style={{
              background:
                'white',
              padding: 20,
              borderRadius: 12,
              width: 400,
              display: 'flex',
              flexDirection:
                'column',
              gap: 10,
            }}
          >
            <h3>
              Add Menu Item
            </h3>

            <input
              placeholder="Name"
              value={newName}
              onChange={(e) =>
                setNewName(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Price"
              value={newPrice}
              onChange={(e) =>
                setNewPrice(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Discount %"
              value={
                newDiscount
              }
              onChange={(e) =>
                setNewDiscount(
                  e.target.value,
                )
              }
            />

            <input
              placeholder="Category"
              value={
                newCategory
              }
              onChange={(e) =>
                setNewCategory(
                  e.target.value,
                )
              }
            />

            <textarea
              placeholder="Description"
              value={newDescription}
              onChange={(e) =>
                setNewDescription(
                  e.target.value,
                )
              }
            />

            <input
              type="file"
              onChange={(e) =>
                setNewImage(
                  e.target
                    .files?.[0] ||
                    null,
                )
              }
            />

            {newImage && (
              <p>
                {newImage.name}
              </p>
            )}

            <button
              onClick={
                createItem
              }
            >
              Create Item
            </button>

            <button
              onClick={() =>
                setShowAddModal(
                  false,
                )
              }
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* REFUND MODAL */}
      {refundOrderId && (
        <div
          onClick={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setRefundOrderId(
                null,
              )
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background:
                "white",
              borderRadius: 12,
              border:
                "0.5px solid #d0cec8",
              padding:
                "20px 22px",
              width: 300,
              display: "flex",
              flexDirection:
                "column",
              gap: 14,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                Select items to refund
              </h3>

              <p
                style={{
                  fontSize: 12,
                  color: "#888",
                  marginTop: 4,
                }}
              >
                Order #
                {
                  refundOrderId
                }{" "}
                · Table{" "}
                {refundOrder?.tableNumber ??
                  "?"}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 6,
              }}
            >
              {refundOrder?.items?.map(
                (
                  item: any,
                  idx: number,
                ) => {
                  const checked =
                    selectedItems.includes(
                      idx,
                    )

                  return (
                    <label
                      key={idx}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 10,
                        padding:
                          "8px 10px",
                        borderRadius: 8,
                        cursor:
                          "pointer",
                        border: `0.5px solid ${
                          checked
                            ? "#97C459"
                            : "#e0ddd7"
                        }`,
                        background:
                          checked
                            ? "#EAF3DE"
                            : "white",
                        transition:
                          "background 0.12s, border-color 0.12s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          checked
                        }
                        onChange={() =>
                          toggleItem(
                            idx,
                          )
                        }
                        style={{
                          accentColor:
                            "#639922",
                          width: 15,
                          height: 15,
                          cursor:
                            "pointer",
                        }}
                      />

                      <span
                        style={{
                          fontSize: 13,
                        }}
                      >
                        {
                          item.name
                        }{" "}
                        <span
                          style={{
                            color:
                              "#aaa",
                            fontSize: 12,
                          }}
                        >
                          x
                          {item.qty ||
                            1}
                        </span>
                      </span>
                    </label>
                  )
                },
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                onClick={() =>
                  setRefundOrderId(
                    null,
                  )
                }
                style={{
                  flex: 1,
                  fontSize: 13,
                  padding:
                    "9px 0",
                  borderRadius: 8,
                  border:
                    "0.5px solid #d0cec8",
                  background:
                    "white",
                  color: "#555",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                }}
              >
                Cancel
              </button>

              <button
                onClick={
                  submitRefund
                }
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  padding:
                    "9px 0",
                  borderRadius: 8,
                  border:
                    "none",
                  background:
                    "#A32D2D",
                  color:
                    "#FCEBEB",
                  cursor:
                    "pointer",
                  fontFamily:
                    "inherit",
                }}
              >
                Issue refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}