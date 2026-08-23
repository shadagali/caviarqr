"use client"

import {
  useEffect,
  useRef,
  useState,
} from "react"
import axios from "axios"
import { io } from "socket.io-client"
import { useRouter } from "next/navigation"

export default function KitchenPage() {
  const router = useRouter()

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

  const ackedOrdersRef =
    useRef<Set<number>>(
      new Set(),
    )

  const [storeCode, setStoreCode] =
    useState('')

  const [businessId, setBusinessId] =
    useState<number | null>(null)

  const [sessionReady, setSessionReady] =
    useState(false)

  const [sessionToken, setSessionToken] =
    useState('')

  useEffect(() => {
    const savedRole =
      localStorage.getItem('role')

    const savedToken =
      String(
        localStorage.getItem('token') ||
          '',
      ).trim()

    const clearSession = () => {
      localStorage.removeItem('businessId')
      localStorage.removeItem('storeCode')
      localStorage.removeItem('role')
      localStorage.removeItem('token')
    }

    if (
      savedRole !== 'kitchen' ||
      !savedToken
    ) {
      clearSession()
      router.replace('/login')
      return
    }

    const initialize = async () => {
      try {
        /*
         * The server is authoritative. Never trust a stale
         * storeCode/businessId left in localStorage.
         */
        const response =
          await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${savedToken}`,
              },
            },
          )

        const authoritativeStoreCode =
          String(
            response.data?.storeCode ||
              '',
          ).trim()

        const authoritativeBusinessId =
          Number(
            response.data?.businessId,
          )

        if (
          !authoritativeStoreCode ||
          !Number.isInteger(
            authoritativeBusinessId,
          ) ||
          authoritativeBusinessId < 1
        ) {
          throw new Error(
            'Invalid kitchen session response.',
          )
        }

        localStorage.setItem(
          'storeCode',
          authoritativeStoreCode,
        )
        localStorage.setItem(
          'businessId',
          String(
            authoritativeBusinessId,
          ),
        )
        localStorage.setItem(
          'role',
          'kitchen',
        )

        setStoreCode(
          authoritativeStoreCode,
        )
        setBusinessId(
          authoritativeBusinessId,
        )
        setSessionToken(
          savedToken,
        )
        setIsOpen(
          response.data?.isOpen ===
            true,
        )
        setSessionReady(true)
      } catch (error) {
        console.error(
          'KITCHEN SESSION ERROR',
          error,
        )
        clearSession()
        router.replace('/login')
      }
    }

    void initialize()
  }, [router])

  const authConfig = () => {
    const token =
      typeof window !== 'undefined'
        ? sessionToken || localStorage.getItem('token')
        : null

    return token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : {}
  }

  const acknowledgeOrder = (
    order: any,
  ) => {
    if (!order?.id) return

    if (
      order.status === "DONE" ||
      order.status === "REFUNDED"
    ) {
      return
    }

    if (
      order.kitchenAcknowledged === true
    ) {
      return
    }

    if (
      ackedOrdersRef.current.has(
        order.id,
      )
    ) {
      return
    }

    const socket =
      socketRef.current

    if (
      !socket ||
      socket.connected !== true
    ) {
      return
    }

    ackedOrdersRef.current.add(
      order.id,
    )

    console.log(
      "SENDING KITCHEN ACK:",
      order.id,
    )

    socket.emit(
      "kitchenAck",
      {
        orderId: order.id,
      },
    )
  }

  const load = async () => {
    try {
      const activeRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders`,
          authConfig(),
        )

      const historyRes =
        await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders/history`,
          authConfig(),
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

      // Defense in depth: even if a server regression ever
      // returned the wrong tenant, never render it here.
      activeData = activeData.filter(
        (order) =>
          Number(order?.businessId) === businessId &&
          String(order?.storeCode || '') === storeCode,
      )

      historyData = historyData.filter(
        (order) =>
          Number(order?.businessId) === businessId &&
          String(order?.storeCode || '') === storeCode,
      )

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
          `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/me`,
          authConfig(),
        )

      const latestOpen =
        businessRes.data
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

      activeData.forEach(
        (order) => {
          acknowledgeOrder(order)
        },
      )
    } catch (err) {
      console.log(err)

      setOrders([])

      setPastOrders([])
    }
  }

  const loadMenu =
    async () => {
      try {
        const res =
          await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/menu/${businessId}`,
            authConfig(),
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

  const toggleKitchen = async () => {
    try {
      const res = await axios.patch(
        `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/toggle-open`,
        {},
        authConfig(),
      )

      setIsOpen(
        res.data?.isOpen === true,
      )
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    if (
      !sessionReady ||
      !storeCode ||
      !businessId
    ) {
      return
    }

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

        auth: {
          token:
            localStorage.getItem('token') ||
            '',
        },
      },
    )

    socketRef.current = socket

    socket.on("connect", () => {
      console.log(
        "SOCKET CONNECTED",
      )

      socket.emit(
        "join",
      )

      stopPolling()

      load()
    })

    socket.on(
      "reconnect",
      () => {
        console.log(
          "SOCKET RECONNECTED",
        )

        socket.emit(
          "join",
        )

        stopPolling()

        load()
      },
    )

    socket.on(
      "disconnect",
      () => {
        console.log(
          "SOCKET DISCONNECTED",
        )

        startPolling()
      },
    )

    socket.on(
      "connect_error",
      () => {
        console.log(
          "SOCKET ERROR",
        )

        startPolling()
      },
    )

    socket.on(
      "kitchenAuthFailed",
      () => {
        localStorage.removeItem('businessId')
        localStorage.removeItem('storeCode')
        localStorage.removeItem('role')
        localStorage.removeItem('token')
        router.replace('/login')
      },
    )

    socket.on(
      "kitchenAckSuccess",
      (data: any) => {
        console.log(
          "KITCHEN ACK SUCCESS",
          data,
        )

        setOrders((prev) =>
          prev.map((o) =>
            o.id === data.orderId
              ? {
                  ...o,
                  kitchenAcknowledged:
                    true,
                  kitchenAcknowledgedAt:
                    new Date().toISOString(),
                }
              : o,
          ),
        )
      },
    )

    socket.on(
      "kitchenAckFailed",
      (data: any) => {
        console.log(
          "KITCHEN ACK FAILED",
          data,
        )

        if (data?.orderId) {
          ackedOrdersRef.current.delete(
            data.orderId,
          )
        }
      },
    )

    socket.on(
      "newOrder",
      (order: any) => {
        console.log(
          "NEW ORDER",
          order,
        )

        if (
          Number(order?.businessId) !== businessId ||
          String(order?.storeCode || '') !== storeCode
        ) {
          console.error(
            'BLOCKED CROSS-TENANT SOCKET ORDER',
            order?.id,
          )
          return
        }

        acknowledgeOrder(order)

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

        setTimeout(() => {
          load()
          loadMenu()
        }, 500)
      },
    )

    socket.on(
      "orderUpdate",
      (order: any) => {
        console.log(
          "ORDER UPDATE",
          order,
        )

        if (
          Number(order?.businessId) !== businessId ||
          String(order?.storeCode || '') !== storeCode
        ) {
          console.error(
            'BLOCKED CROSS-TENANT SOCKET UPDATE',
            order?.id,
          )
          return
        }

        acknowledgeOrder(order)

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

    load()
    loadMenu()

    startPolling()

    return () => {
      stopPolling()

      socket.off("connect")
      socket.off("disconnect")
      socket.off("reconnect")
      socket.off("connect_error")
      socket.off("kitchenAuthFailed")
      socket.off("kitchenAckSuccess")
      socket.off("kitchenAckFailed")
      socket.off("newOrder")
      socket.off(
        "orderUpdate",
      )

      socket.disconnect()
    }
  }, [sessionReady, storeCode, businessId, sessionToken, router])

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
        `${process.env.NEXT_PUBLIC_API_URL}/kitchen-auth/orders/${id}/status`,
        {
          status: "DONE",
        },
        authConfig(),
      )

      load()
    } catch (err) {
      console.log(err)
    }
  }

  const toggleHide =
    async (id: number) => {
      try {
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_URL}/menu/hide/${id}`,
          {},
          authConfig(),
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
              authConfig(),
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
          authConfig(),
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
    alert(
      'Refunds are handled from the CaviarQR Action Center so they stay audited and cannot be triggered by a kitchen device.',
    )
    setRefundOrderId(null)
  }

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

  const elapsed = (
    iso: string,
  ) => {
    const created =
      new Date(iso)

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

  if (
    !sessionReady ||
    !storeCode ||
    !businessId
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f2ed',
          color: '#666',
          fontSize: 14,
        }}
      >
        Loading kitchen…
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: "#f4f2ed",
      }}
    >
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
                          ) => {
                            const customerNote =
                              String(
                                item.note ||
                                  item.notes ||
                                  '',
                              ).trim()

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  flexDirection:
                                    'column',
                                  gap: 5,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent:
                                      'space-between',
                                    alignItems:
                                      'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                    }}
                                  >
                                    {item.name}
                                  </span>

                                  <span
                                    style={{
                                      fontSize: 11,
                                      padding:
                                        '1px 7px',
                                      borderRadius: 20,
                                      background:
                                        '#f4f2ed',
                                      color: '#888',
                                    }}
                                  >
                                    x{item.qty || 1}
                                  </span>
                                </div>

                                {customerNote && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      lineHeight: 1.4,
                                      padding:
                                        '7px 9px',
                                      borderRadius: 8,
                                      background:
                                        '#FFF4D8',
                                      color: '#6B4F00',
                                      border:
                                        '0.5px solid #E8D59B',
                                      whiteSpace:
                                        'pre-wrap',
                                      overflowWrap:
                                        'anywhere',
                                    }}
                                  >
                                    <strong>
                                      Note:
                                    </strong>{' '}
                                    {customerNote}
                                  </div>
                                )}
                              </div>
                            )
                          },
                        )}
                      </div>

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

                      {!showHistory && (
                        <div
                          style={{
                            fontSize: 11,
                            color:
                              o.kitchenAcknowledged
                                ? "#4D7A19"
                                : "#A36A00",
                            background:
                              o.kitchenAcknowledged
                                ? "#EAF3DE"
                                : "#FFF4D8",
                            border:
                              "0.5px solid #e0ddd7",
                            padding:
                              "4px 8px",
                            borderRadius: 8,
                          }}
                        >
                          {o.kitchenAcknowledged
                            ? "Kitchen received"
                            : "Sending kitchen confirmation..."}
                        </div>
                      )}

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