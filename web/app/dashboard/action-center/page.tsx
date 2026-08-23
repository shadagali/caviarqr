'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import axios from 'axios'

const API =
  (
    process.env
      .NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  ).replace(
    /\/+$/,
    '',
  )

type Order = {
  id: number
  customerName: string | null
  customerEmail: string | null
  tableNumber: number | null
  total: number
  status: string
  issueType: string | null
  issueResolved: boolean
  stripePaymentIntentId:
    | string
    | null
  createdAt: string
  items: any[]
  requiresOwnerAction: boolean
  ownerIssueType:
    | string
    | null
  ownerIssueSeverity:
    | string
    | null
  ownerActionMessage:
    | string
    | null
  ownerActionId:
    | string
    | null

  hasSupport?: boolean
  supportStatus?: string | null
  supportUnreadCount?: number
  supportLatestMessage?: string | null
  supportLastMessageAt?: string | null
}

type SupportThreadSummary = {
  id: string
  orderId: number
  businessId: number
  storeCode: string | null
  customerEmail: string | null
  customerName: string | null

  status:
    | 'AVAILABLE'
    | 'AWAITING_RESTAURANT'
    | 'AWAITING_CUSTOMER'
    | 'RESOLVED'
    | 'REFUNDED'

  restaurantUnreadCount: number
  customerUnreadCount: number
  lastMessageAt: string | null

  latestMessage: {
    id: number
    senderType:
      | 'CUSTOMER'
      | 'RESTAURANT'
      | 'CAVIARQR'
      | 'SYSTEM'
    senderName: string | null
    message: string
    createdAt: string
  } | null

  order: {
    id: number
    total: number
    currency: string
    tableNumber: number | null
    status: string
    stripePaymentIntentId:
      | string
      | null
    refundProcessed: boolean
    refundAmount:
      | number
      | null
    createdAt: string
  }
}

type SupportMessage = {
  id: number
  senderType:
    | 'CUSTOMER'
    | 'RESTAURANT'
    | 'CAVIARQR'
    | 'SYSTEM'
  senderName: string | null
  message: string
  metadata:
    | Record<string, unknown>
    | null
  createdAt: string
}

type SupportThreadDetail = {
  id: string
  orderId: number
  businessId: number
  storeCode: string | null
  customerEmail: string | null
  customerName: string | null

  status:
    | 'AVAILABLE'
    | 'AWAITING_RESTAURANT'
    | 'AWAITING_CUSTOMER'
    | 'RESOLVED'
    | 'REFUNDED'

  restaurantUnreadCount: number
  customerUnreadCount: number
  lastMessageAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string

  order: {
    id: number
    items: any[]
    total: number
    currency: string
    tableNumber: number | null
    status: string
    customerEmail: string | null
    customerName: string | null
    refundProcessed: boolean
    refundAmount:
      | number
      | null
    stripePaymentIntentId:
      | string
      | null
    createdAt: string
  }

  messages: SupportMessage[]
}

function getAxiosErrorMessage(
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
        '\n',
      )
    }

    if (
      typeof responseMessage ===
        'string' &&
      responseMessage.trim()
    ) {
      return responseMessage
    }

    if (error.message) {
      return error.message
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message
  }

  return 'Something went wrong.'
}

function normalizeIssues(
  data: any,
): Order[] {
  if (
    Array.isArray(data)
  ) {
    return data
  }

  if (
    Array.isArray(
      data?.issues,
    )
  ) {
    return data.issues
  }

  return []
}

function normalizeSupportThreads(
  data: any,
): SupportThreadSummary[] {
  if (
    Array.isArray(data)
  ) {
    return data
  }

  if (
    Array.isArray(
      data?.threads,
    )
  ) {
    return data.threads
  }

  return []
}

function isOpenSupportThread(
  thread:
    SupportThreadSummary,
) {
  if (
    !thread.latestMessage
  ) {
    return false
  }

  return (
    thread.status !==
      'RESOLVED' &&
    thread.status !==
      'REFUNDED'
  )
}

function mergeIssuesWithSupport(
  issues: Order[],
  supportThreads:
    SupportThreadSummary[],
) {
  const map =
    new Map<
      number,
      Order
    >()

  for (
    const issue of
    issues
  ) {
    if (
      issue
        .requiresOwnerAction !==
      true
    ) {
      continue
    }

    map.set(
      Number(issue.id),
      {
        ...issue,

        total:
          Number(
            issue.total ||
              0,
          ),

        items:
          Array.isArray(
            issue.items,
          )
            ? issue.items
            : [],
      },
    )
  }

  for (
    const thread of
    supportThreads
  ) {
    if (
      !isOpenSupportThread(
        thread,
      )
    ) {
      continue
    }

    const orderId =
      Number(
        thread.orderId,
      )

    const existing =
      map.get(orderId)

    if (existing) {
      map.set(
        orderId,
        {
          ...existing,

          hasSupport:
            true,

          supportStatus:
            thread.status,

          supportUnreadCount:
            Number(
              thread
                .restaurantUnreadCount ||
                0,
            ),

          supportLatestMessage:
            thread
              .latestMessage
              ?.message ||
            null,

          supportLastMessageAt:
            thread
              .lastMessageAt ||
            null,
        },
      )

      continue
    }

    /*
     * A support request must still surface even
     * if the Order currently has another issue
     * state or no Order-based owner alert.
     */
    map.set(
      orderId,
      {
        id:
          orderId,

        customerName:
          thread
            .customerName,

        customerEmail:
          thread
            .customerEmail,

        tableNumber:
          thread.order
            .tableNumber,

        total:
          Number(
            thread.order
              .total ||
              0,
          ),

        status:
          thread.order
            .status,

        issueType:
          'CUSTOMER_SUPPORT_REQUEST',

        issueResolved:
          false,

        stripePaymentIntentId:
          thread.order
            .stripePaymentIntentId,

        createdAt:
          thread.order
            .createdAt,

        items:
          [],

        requiresOwnerAction:
          true,

        ownerIssueType:
          'CUSTOMER_SUPPORT_REQUEST',

        ownerIssueSeverity:
          'WARNING',

        ownerActionMessage:
          thread
            .latestMessage
            ?.message ||
          'Customer sent a help request.',

        ownerActionId:
          `SUP-${String(
            orderId,
          ).padStart(
            6,
            '0',
          )}`,

        hasSupport:
          true,

        supportStatus:
          thread.status,

        supportUnreadCount:
          Number(
            thread
              .restaurantUnreadCount ||
              0,
          ),

        supportLatestMessage:
          thread
            .latestMessage
            ?.message ||
          null,

        supportLastMessageAt:
          thread
            .lastMessageAt ||
          null,
      },
    )
  }

  return Array.from(
    map.values(),
  ).sort(
    (
      left,
      right,
    ) =>
      new Date(
        right
          .supportLastMessageAt ||
          right.createdAt,
      ).getTime() -
      new Date(
        left
          .supportLastMessageAt ||
          left.createdAt,
      ).getTime(),
  )
}

export default function ActionCenter() {
  const [orders, setOrders] =
    useState<Order[]>([])

  const [loading, setLoading] =
    useState(true)

  const [search, setSearch] =
    useState('')

  const [selected, setSelected] =
    useState<Order | null>(
      null,
    )

  const [filter, setFilter] =
    useState('ALL')

  const [
    autoRefresh,
    setAutoRefresh,
  ] =
    useState(true)

  const [
    supportOrder,
    setSupportOrder,
  ] =
    useState<Order | null>(
      null,
    )

  const [
    supportThread,
    setSupportThread,
  ] =
    useState<
      SupportThreadDetail | null
    >(null)

  const [
    supportLoading,
    setSupportLoading,
  ] =
    useState(false)

  const [
    replyText,
    setReplyText,
  ] =
    useState('')

  const [
    sendingReply,
    setSendingReply,
  ] =
    useState(false)

  const [
    supportActioning,
    setSupportActioning,
  ] =
    useState(false)

  async function loadIssues() {
    try {
      const [
        issuesResult,
        supportResult,
      ] =
        await Promise.allSettled(
          [
            axios.get(
              `${API}/maintenance/issues`,
            ),

            axios.get(
              `${API}/maintenance/support/threads`,
            ),
          ],
        )

      let issues:
        Order[] = []

      let supportThreads:
        SupportThreadSummary[] = []

      if (
        issuesResult.status ===
        'fulfilled'
      ) {
        issues =
          normalizeIssues(
            issuesResult
              .value.data,
          )
      } else {
        console.log(
          issuesResult.reason,
        )
      }

      if (
        supportResult.status ===
        'fulfilled'
      ) {
        supportThreads =
          normalizeSupportThreads(
            supportResult
              .value.data,
          )
      } else {
        /*
         * Do not take the existing Action Center
         * offline just because the new support
         * endpoint has a temporary problem.
         */
        console.log(
          supportResult.reason,
        )
      }

      setOrders(
        mergeIssuesWithSupport(
          issues,
          supportThreads,
        ),
      )
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
    }
  }

  async function loadSupportThread(
    orderId: number,
    quiet = false,
  ) {
    if (!quiet) {
      setSupportLoading(
        true,
      )
    }

    try {
      const res =
        await axios.get(
          `${API}/maintenance/support/order/${encodeURIComponent(
            String(
              orderId,
            ),
          )}`,
        )

      const thread =
        res.data
          ?.thread as
          | SupportThreadDetail
          | undefined

      if (!thread) {
        throw new Error(
          'Support conversation not found.',
        )
      }

      setSupportThread(
        thread,
      )

      return thread
    } catch (error) {
      if (!quiet) {
        alert(
          getAxiosErrorMessage(
            error,
          ),
        )
      }

      return null
    } finally {
      if (!quiet) {
        setSupportLoading(
          false,
        )
      }
    }
  }

  async function openSupport(
    order: Order,
  ) {
    setSupportOrder(
      order,
    )

    setSupportThread(
      null,
    )

    setReplyText('')

    const thread =
      await loadSupportThread(
        order.id,
      )

    if (!thread) {
      setSupportOrder(
        null,
      )
      return
    }

    try {
      await axios.patch(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(
            order.id,
          ),
        )}/read`,
      )

      await loadIssues()
    } catch (error) {
      console.log(error)
    }
  }

  function closeSupport() {
    setSupportOrder(
      null,
    )

    setSupportThread(
      null,
    )

    setReplyText('')
  }

  useEffect(() => {
    loadIssues()

    if (!autoRefresh) {
      return
    }

    const timer =
      setInterval(
        loadIssues,
        5000,
      )

    return () =>
      clearInterval(
        timer,
      )
  }, [
    autoRefresh,
  ])

  useEffect(() => {
    const orderId =
      supportOrder?.id

    if (!orderId) {
      return
    }

    const timer =
      setInterval(
        () => {
          void loadSupportThread(
            orderId,
            true,
          )
        },
        5000,
      )

    return () =>
      clearInterval(
        timer,
      )
  }, [
    supportOrder?.id,
  ])

  const filtered =
    useMemo(() => {
      const q =
        search
          .toLowerCase()
          .trim()

      return orders.filter(
        (o) => {
          const matchesSearch =
            !q ||
            o.customerName
              ?.toLowerCase()
              .includes(q) ||
            o.customerEmail
              ?.toLowerCase()
              .includes(q) ||
            String(o.id)
              .includes(q) ||
            o.stripePaymentIntentId
              ?.toLowerCase()
              .includes(q) ||
            o.supportLatestMessage
              ?.toLowerCase()
              .includes(q)

          if (
            !matchesSearch
          ) {
            return false
          }

          if (
            filter ===
            'ALL'
          ) {
            return true
          }

          if (
            filter ===
            'SUPPORT'
          ) {
            return Boolean(
              o.hasSupport,
            )
          }

          if (
            filter ===
            'PAYMENT'
          ) {
            return (
              o.issueType
                ?.includes(
                  'PAY',
                ) ||
              o.ownerIssueType
                ?.includes(
                  'PAY',
                ) ||
              false
            )
          }

          if (
            filter ===
            'KITCHEN'
          ) {
            return (
              o.issueType
                ?.includes(
                  'KITCHEN',
                ) ||
              o.ownerIssueType
                ?.includes(
                  'KITCHEN',
                ) ||
              false
            )
          }

          if (
            filter ===
            'REFUNDS'
          ) {
            return (
              o.status ===
              'REFUNDED'
            )
          }

          if (
            filter ===
            'COMPLETED'
          ) {
            return (
              o.issueResolved
            )
          }

          return true
        },
      )
    }, [
      orders,
      search,
      filter,
    ])

  async function refund(
    order: Order,
  ) {
    if (
      order.status ===
      'REFUNDED'
    ) {
      return false
    }

    if (
      !confirm(
        `Refund order #${order.id}?`,
      )
    ) {
      return false
    }

    try {
      await axios.patch(
        `${API}/maintenance/refund/${encodeURIComponent(
          String(
            order.id,
          ),
        )}`,
        {
          reason:
            order.hasSupport
              ? 'Customer support request refunded from the CaviarQR Action Center.'
              : 'Refunded from the CaviarQR Action Center.',
        },
      )

      /*
       * When the refund came from a support conversation,
       * close the thread as REFUNDED after Stripe/order
       * state has been updated by MaintenanceService.
       */
      if (
        order.hasSupport
      ) {
        try {
          await axios.patch(
            `${API}/maintenance/support/order/${encodeURIComponent(
              String(
                order.id,
              ),
            )}/resolve`,
          )
        } catch (
          supportError
        ) {
          console.log(
            supportError,
          )
        }
      }

      await loadIssues()

      if (
        supportOrder?.id ===
        order.id
      ) {
        await loadSupportThread(
          order.id,
          true,
        )
      }

      if (
        selected?.id ===
        order.id
      ) {
        setSelected(null)
      }

      return true
    } catch (error) {
      alert(
        getAxiosErrorMessage(
          error,
        ),
      )

      return false
    }
  }

  async function resolve(
    order: Order,
  ) {
    try {
      if (
        order.hasSupport &&
        order.ownerIssueType ===
          'CUSTOMER_SUPPORT_REQUEST'
      ) {
        await axios.patch(
          `${API}/maintenance/support/order/${encodeURIComponent(
            String(
              order.id,
            ),
          )}/resolve`,
        )
      } else {
        await axios.patch(
          `${API}/maintenance/resolve/${encodeURIComponent(
            String(
              order.id,
            ),
          )}`,
        )
      }

      await loadIssues()

      if (
        selected?.id ===
        order.id
      ) {
        setSelected(null)
      }
    } catch (error) {
      alert(
        getAxiosErrorMessage(
          error,
        ),
      )
    }
  }

  async function sendReply() {
    const order =
      supportOrder

    const message =
      replyText.trim()

    if (
      !order ||
      !message ||
      sendingReply
    ) {
      return
    }

    if (
      message.length >
      2000
    ) {
      alert(
        'Reply must be 2,000 characters or less.',
      )
      return
    }

    try {
      setSendingReply(
        true,
      )

      await axios.post(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(
            order.id,
          ),
        )}/reply`,
        {
          message,
          senderName:
            'Restaurant',
        },
      )

      setReplyText('')

      await Promise.all(
        [
          loadSupportThread(
            order.id,
            true,
          ),

          loadIssues(),
        ],
      )
    } catch (error) {
      alert(
        getAxiosErrorMessage(
          error,
        ),
      )
    } finally {
      setSendingReply(
        false,
      )
    }
  }

  async function resolveSupport() {
    const order =
      supportOrder

    if (
      !order ||
      supportActioning
    ) {
      return
    }

    if (
      !confirm(
        `Resolve customer support for order #${order.id}?`,
      )
    ) {
      return
    }

    try {
      setSupportActioning(
        true,
      )

      await axios.patch(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(
            order.id,
          ),
        )}/resolve`,
      )

      await loadIssues()

      closeSupport()
    } catch (error) {
      alert(
        getAxiosErrorMessage(
          error,
        ),
      )
    } finally {
      setSupportActioning(
        false,
      )
    }
  }

  async function refundFromSupport() {
    const order =
      supportOrder

    if (
      !order ||
      supportActioning
    ) {
      return
    }

    try {
      setSupportActioning(
        true,
      )

      const refunded =
        await refund(
          order,
        )

      if (refunded) {
        closeSupport()
      }
    } finally {
      setSupportActioning(
        false,
      )
    }
  }

  function timeAgo(
    dateString: string,
  ) {
    const seconds =
      Math.floor(
        (
          Date.now() -
          new Date(
            dateString,
          ).getTime()
        ) /
          1000,
      )

    if (
      !Number.isFinite(
        seconds,
      ) ||
      seconds < 60
    ) {
      return 'just now'
    }

    const minutes =
      Math.floor(
        seconds /
          60,
      )

    if (
      minutes < 60
    ) {
      return `${minutes} minute${
        minutes === 1
          ? ''
          : 's'
      } ago`
    }

    const hours =
      Math.floor(
        minutes /
          60,
      )

    if (
      hours < 24
    ) {
      return `${hours} hour${
        hours === 1
          ? ''
          : 's'
      } ago`
    }

    const days =
      Math.floor(
        hours /
          24,
      )

    return `${days} day${
      days === 1
        ? ''
        : 's'
    } ago`
  }

  function supportStatusLabel(
    status:
      | string
      | null
      | undefined,
  ) {
    if (
      status ===
      'AWAITING_RESTAURANT'
    ) {
      return 'Needs reply'
    }

    if (
      status ===
      'AWAITING_CUSTOMER'
    ) {
      return 'Waiting on customer'
    }

    if (
      status ===
      'REFUNDED'
    ) {
      return 'Refunded'
    }

    if (
      status ===
      'RESOLVED'
    ) {
      return 'Resolved'
    }

    return 'Open'
  }

  return (
    <div className="p-8">

      <div className="flex justify-between items-center">

        <div>

          <h1 className="text-4xl font-bold">
            🚨 Action Center
          </h1>

          <div className="text-gray-500 mt-1">
            CaviarQR Operations Dashboard
          </div>

        </div>

        <div className="flex gap-6">

          <div className="bg-white rounded-xl shadow px-6 py-4 text-center">

            <div className="text-3xl font-bold">
              {orders.length}
            </div>

            <div className="text-gray-500">
              Issues
            </div>

          </div>

          <div className="bg-white rounded-xl shadow px-6 py-4 text-center">

            <div className="text-3xl font-bold">

              $
              {orders
                .reduce(
                  (
                    sum,
                    o,
                  ) =>
                    sum +
                    Number(
                      o.total ||
                        0,
                    ),
                  0,
                )
                .toFixed(
                  2,
                )}

            </div>

            <div className="text-gray-500">
              At Risk
            </div>

          </div>

        </div>

      </div>

      <input
        className="mt-6 w-full border rounded-lg p-3"
        placeholder="Search name, email, payment intent, support message..."
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value,
          )
        }
      />

      <div className="flex gap-3 mt-5 flex-wrap">

        <button
          onClick={() =>
            setFilter(
              'ALL',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'ALL'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          All
        </button>

        <button
          onClick={() =>
            setFilter(
              'SUPPORT',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'SUPPORT'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Customer Help
        </button>

        <button
          onClick={() =>
            setFilter(
              'PAYMENT',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'PAYMENT'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Payment
        </button>

        <button
          onClick={() =>
            setFilter(
              'KITCHEN',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'KITCHEN'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Kitchen
        </button>

        <button
          onClick={() =>
            setFilter(
              'REFUNDS',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'REFUNDS'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Refunds
        </button>

        <button
          onClick={() =>
            setFilter(
              'COMPLETED',
            )
          }
          className={`px-4 py-2 rounded-lg ${
            filter ===
            'COMPLETED'
              ? 'bg-red-600 text-white'
              : 'border'
          }`}
        >
          Completed
        </button>

        <label className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm">
          <input
            type="checkbox"
            checked={
              autoRefresh
            }
            onChange={(e) =>
              setAutoRefresh(
                e.target
                  .checked,
              )
            }
          />
          Auto refresh
        </label>

        <button
          onClick={
            loadIssues
          }
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Refresh
        </button>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mt-6">

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            Total Orders
          </div>

          <div className="text-3xl font-bold mt-2">
            {orders.length}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            🚨 Critical
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                (
                  o,
                ) =>
                  o.ownerIssueSeverity ===
                  'CRITICAL',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            ⚠️ Warning
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                (
                  o,
                ) =>
                  o.ownerIssueSeverity ===
                  'WARNING',
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            💬 Customer Help
          </div>

          <div className="text-3xl font-bold mt-2">
            {
              orders.filter(
                (
                  o,
                ) =>
                  o.hasSupport,
              ).length
            }
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <div className="text-gray-500">
            💰 Revenue At Risk
          </div>

          <div className="text-3xl font-bold mt-2">
            $
            {orders
              .reduce(
                (
                  sum,
                  o,
                ) =>
                  sum +
                  Number(
                    o.total ||
                      0,
                  ),
                0,
              )
              .toFixed(
                2,
              )}
          </div>
        </div>

      </div>

      {loading && (
        <div className="mt-8">
          Loading...
        </div>
      )}

      {!loading &&
        filtered.length ===
          0 && (

        <div className="bg-green-50 border border-green-300 rounded-xl p-12 text-center mt-8">

          <div className="text-6xl">
            ✅
          </div>

          <h2 className="text-2xl font-bold mt-4">
            No issues found
          </h2>

          <p className="text-gray-600 mt-2">
            Everything is running normally.
          </p>

        </div>

      )}

      {!loading &&
        filtered.length >
          0 && (
        <div className="grid gap-6 mt-8">

          {filtered.map(
            (
              order,
            ) => (

            <div
              key={
                order.id
              }
              className={`bg-white rounded-xl shadow p-6 border-l-8 ${
                order.ownerIssueSeverity ===
                'CRITICAL'
                  ? 'border-red-600'
                  : order.ownerIssueSeverity ===
                    'WARNING'
                  ? 'border-yellow-500'
                  : 'border-blue-500'
              }`}
            >

              <div className="mb-5 flex flex-wrap items-center gap-2">

                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    order.ownerIssueSeverity ===
                    'CRITICAL'
                      ? 'bg-red-100 text-red-700'
                      : order.ownerIssueSeverity ===
                        'WARNING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {order.ownerIssueSeverity ||
                    'INFO'}
                </span>

                {order.hasSupport && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-700">
                    💬 Customer Help
                    {Number(
                      order.supportUnreadCount ||
                        0,
                    ) > 0
                      ? ` · ${order.supportUnreadCount} unread`
                      : ''}
                  </span>
                )}

                {order.hasSupport && (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700">
                    {supportStatusLabel(
                      order.supportStatus,
                    )}
                  </span>
                )}

              </div>

              <div className="flex justify-between gap-6">

                <div>

                  <div className="font-bold text-xl">

                    {order.customerName ||
                      'Unknown Customer'}

                  </div>

                  <div className="text-gray-500">

                    {order.customerEmail ||
                      'No email'}

                  </div>

                </div>

                <div className="text-right">

                  <div className="font-bold">

                    $
                    {Number(
                      order.total ||
                        0,
                    ).toFixed(
                      2,
                    )}

                  </div>

                  <div>

                    Table{' '}
                    {order.tableNumber ??
                      '—'}

                  </div>

                </div>

              </div>

              {order.hasSupport &&
                order.supportLatestMessage && (
                <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-bold text-purple-900">
                      Customer message
                    </div>

                    {order.supportLastMessageAt && (
                      <div className="text-xs text-purple-700">
                        {timeAgo(
                          order.supportLastMessageAt,
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-purple-900 whitespace-pre-wrap break-words">
                    {order.supportLatestMessage}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4">

                <div>

                  <b>Status</b>

                  <div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        order.status ===
                        'NEW'
                          ? 'bg-blue-100 text-blue-700'
                          : order.status ===
                            'PREPARING'
                          ? 'bg-orange-100 text-orange-700'
                          : order.status ===
                            'READY'
                          ? 'bg-green-100 text-green-700'
                          : order.status ===
                            'REFUNDED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {order.status}
                    </span>

                  </div>

                </div>

                <div>

                  <b>Severity</b>

                  <div
                    className={`font-bold ${
                      order.ownerIssueSeverity ===
                      'CRITICAL'
                        ? 'text-red-600'
                        : order.ownerIssueSeverity ===
                          'WARNING'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {order.ownerIssueSeverity ||
                      'INFO'}
                  </div>

                </div>

                <div className="col-span-2">

                  <div className="text-xl font-bold text-red-600">

                    🚨{' '}
                    {order.ownerActionMessage ||
                      order.supportLatestMessage ||
                      'Owner action required.'}

                  </div>

                  <div className="mt-3 text-gray-500">

                    Issue ID

                    <div className="font-mono text-black">

                      {order.ownerActionId ||
                        `ORDER-${order.id}`}

                    </div>

                  </div>

                </div>

              </div>

              <div className="mt-4 text-sm text-gray-500">

                Payment Intent

                <div className="flex items-center gap-3">

                  <div className="font-mono break-all">

                    {order.stripePaymentIntentId ||
                      'Unavailable'}

                  </div>

                  {order.stripePaymentIntentId && (
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          order.stripePaymentIntentId ||
                            '',
                        )
                      }
                      className="text-blue-600 text-sm"
                    >
                      📋 Copy
                    </button>
                  )}

                </div>

              </div>

              <div className="mt-3 text-sm text-gray-500">

                Created

                <div>
                  {timeAgo(
                    order.createdAt,
                  )}
                </div>

              </div>

              <div className="mt-5 flex gap-3 flex-wrap">

                <button
                  onClick={() =>
                    setSelected(
                      order,
                    )
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  View Details
                </button>

                {order.hasSupport && (
                  <button
                    onClick={() =>
                      openSupport(
                        order,
                      )
                    }
                    className="bg-purple-600 text-white px-4 py-2 rounded font-semibold"
                  >
                    💬 Open Chat
                    {Number(
                      order.supportUnreadCount ||
                        0,
                    ) > 0
                      ? ` (${order.supportUnreadCount})`
                      : ''}
                  </button>
                )}

                {order.status ===
                'REFUNDED' ? (

                  <button
                    disabled
                    className="bg-gray-300 text-gray-600 px-4 py-2 rounded cursor-not-allowed"
                  >
                    Refunded
                  </button>

                ) : (

                  <button
                    onClick={() =>
                      refund(
                        order,
                      )
                    }
                    className="bg-red-600 text-white px-4 py-2 rounded"
                  >
                    Refund Customer
                  </button>

                )}

                {order.issueResolved ? (

                  <button
                    disabled
                    className="bg-gray-300 text-gray-600 px-4 py-2 rounded cursor-not-allowed"
                  >
                    ✔ Resolved
                  </button>

                ) : (

                  <button
                    onClick={() =>
                      resolve(
                        order,
                      )
                    }
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    ✓ Mark as Resolved
                  </button>

                )}

              </div>

            </div>

          ))}

        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-xl shadow-2xl w-[800px] max-w-full max-h-[90vh] overflow-y-auto p-8">

            <div className="flex justify-between items-center">

              <h2 className="text-3xl font-bold">
                Order #{selected.id}
              </h2>

              <button
                onClick={() =>
                  setSelected(
                    null,
                  )
                }
                className="text-2xl"
              >
                ✕
              </button>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">

              <div>
                <div className="font-semibold">
                  Customer
                </div>

                <div>
                  {selected.customerName ||
                    'Unknown'}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Email
                </div>

                <div>
                  {selected.customerEmail ||
                    'None'}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Status
                </div>

                <div>
                  {selected.status}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Table
                </div>

                <div>
                  {selected.tableNumber ??
                    '—'}
                </div>
              </div>

              <div>
                <div className="font-semibold">
                  Total
                </div>

                <div>
                  $
                  {Number(
                    selected.total ||
                      0,
                  ).toFixed(
                    2,
                  )}
                </div>
              </div>

              <div>

                <div>

                  <b>Severity</b>

                  <div
                    className={`font-bold ${
                      selected.ownerIssueSeverity ===
                      'CRITICAL'
                        ? 'text-red-600'
                        : selected.ownerIssueSeverity ===
                          'WARNING'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {selected.ownerIssueSeverity ||
                      'INFO'}
                  </div>

                </div>

                <div className="mt-3">

                  <div className="text-2xl font-bold text-red-600">

                    🚨{' '}
                    {selected.ownerActionMessage ||
                      selected.supportLatestMessage ||
                      'Owner action required.'}

                  </div>

                  <div className="mt-4 text-gray-500">

                    Issue ID

                    <div className="font-mono text-black">

                      {selected.ownerActionId ||
                        `ORDER-${selected.id}`}

                    </div>

                  </div>

                </div>

              </div>

            </div>

            <h3 className="text-2xl font-bold mt-10">
              Ordered Items
            </h3>

            <div className="mt-5 space-y-3">

              {selected.items
                ?.length ? (
                selected.items.map(
                  (
                    item:
                      any,
                    index:
                      number,
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="border rounded-lg p-4"
                    >

                      <div className="font-semibold text-lg">
                        {item.name}
                      </div>

                      <div>
                        Qty:{' '}
                        {Number(
                          item.qty ??
                            item.quantity ??
                            1,
                        )}
                      </div>

                      <div>
                        Price: $
                        {Number(
                          item.price ||
                            0,
                        ).toFixed(
                          2,
                        )}
                      </div>

                      {item.note && (
                        <div className="mt-2 text-sm text-gray-500">
                          Note:{' '}
                          {item.note}
                        </div>
                      )}

                    </div>
                  ),
                )
              ) : (
                <div className="text-gray-500">
                  Item details are available in the support conversation after opening chat.
                </div>
              )}

            </div>

            <div className="flex gap-4 mt-10 flex-wrap">

              {selected.hasSupport && (
                <button
                  onClick={() => {
                    setSelected(
                      null,
                    )

                    void openSupport(
                      selected,
                    )
                  }}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg"
                >
                  💬 Open Chat
                </button>
              )}

              {selected.status ===
              'REFUNDED' ? (
                <button
                  disabled
                  className="bg-gray-300 text-gray-600 px-6 py-3 rounded-lg cursor-not-allowed"
                >
                  Refunded
                </button>
              ) : (
                <button
                  onClick={() =>
                    refund(
                      selected,
                    )
                  }
                  className="bg-red-600 text-white px-6 py-3 rounded-lg"
                >
                  Refund Customer
                </button>
              )}

              <button
                onClick={() =>
                  resolve(
                    selected,
                  )
                }
                disabled={
                  selected.issueResolved
                }
                className={`px-6 py-3 rounded-lg ${
                  selected.issueResolved
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 text-white'
                }`}
              >
                {selected.issueResolved
                  ? '✔ Resolved'
                  : '✓ Mark as Resolved'}
              </button>

            </div>

          </div>

        </div>
      )}

      {supportOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">

          <div className="bg-white rounded-xl shadow-2xl w-[820px] max-w-full max-h-[92vh] overflow-hidden flex flex-col">

            <div className="flex justify-between items-start gap-6 p-6 border-b">

              <div>
                <div className="text-sm font-bold text-purple-700">
                  💬 CUSTOMER HELP REQUEST
                </div>

                <h2 className="text-3xl font-bold mt-1">
                  Order #{supportOrder.id}
                </h2>

                <div className="text-gray-500 mt-1">
                  {supportOrder.customerName ||
                    'Unknown Customer'}
                  {' · '}
                  {supportOrder.customerEmail ||
                    'No email'}
                  {' · '}
                  Table{' '}
                  {supportOrder.tableNumber ??
                    '—'}
                </div>
              </div>

              <button
                onClick={
                  closeSupport
                }
                className="text-2xl"
              >
                ✕
              </button>

            </div>

            {supportLoading ? (
              <div className="p-10 text-center text-gray-500">
                Loading conversation...
              </div>
            ) : !supportThread ? (
              <div className="p-10 text-center text-red-600">
                Could not load this conversation.
              </div>
            ) : (
              <>
                <div className="px-6 py-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-bold">
                      {supportStatusLabel(
                        supportThread.status,
                      )}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-white border text-sm font-semibold">
                      Total $
                      {Number(
                        supportThread
                          .order
                          .total ||
                          0,
                      ).toFixed(
                        2,
                      )}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-white border text-sm font-semibold">
                      Order{' '}
                      {supportThread
                        .order
                        .status}
                    </span>
                  </div>

                  {supportThread
                    .order
                    .refundProcessed && (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-bold">
                      Refund issued
                      {supportThread
                        .order
                        .refundAmount !==
                      null
                        ? ` · $${Number(
                            supportThread
                              .order
                              .refundAmount,
                          ).toFixed(
                            2,
                          )}`
                        : ''}
                    </span>
                  )}

                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

                  {supportThread.messages
                    .length ===
                  0 ? (
                    <div className="border border-dashed rounded-xl p-8 text-center text-gray-500 bg-white">
                      No messages yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {supportThread.messages.map(
                        (
                          message,
                        ) => {
                          const fromCustomer =
                            message.senderType ===
                            'CUSTOMER'

                          return (
                            <div
                              key={
                                message.id
                              }
                              className={`flex ${
                                fromCustomer
                                  ? 'justify-start'
                                  : 'justify-end'
                              }`}
                            >
                              <div
                                className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                                  fromCustomer
                                    ? 'bg-white border border-gray-200'
                                    : 'bg-purple-600 text-white'
                                }`}
                              >
                                <div
                                  className={`text-xs font-bold mb-1 ${
                                    fromCustomer
                                      ? 'text-purple-700'
                                      : 'text-purple-100'
                                  }`}
                                >
                                  {fromCustomer
                                    ? 'Customer'
                                    : message.senderName ||
                                      'Restaurant'}
                                </div>

                                <div className="whitespace-pre-wrap break-words">
                                  {message.message}
                                </div>

                                <div
                                  className={`text-[11px] mt-2 ${
                                    fromCustomer
                                      ? 'text-gray-400'
                                      : 'text-purple-100'
                                  }`}
                                >
                                  {timeAgo(
                                    message.createdAt,
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  )}

                </div>

                {supportThread.status !==
                  'RESOLVED' &&
                supportThread.status !==
                  'REFUNDED' ? (
                  <div className="p-6 border-t bg-white">

                    <textarea
                      className="w-full min-h-[100px] resize-y border rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                      placeholder="Reply to the customer..."
                      value={
                        replyText
                      }
                      maxLength={
                        2000
                      }
                      onChange={(e) =>
                        setReplyText(
                          e.target
                            .value,
                        )
                      }
                      disabled={
                        sendingReply ||
                        supportActioning
                      }
                    />

                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="text-xs text-gray-500">
                        {replyText.length}/2000
                      </div>

                      <button
                        onClick={
                          sendReply
                        }
                        disabled={
                          sendingReply ||
                          supportActioning ||
                          !replyText.trim()
                        }
                        className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingReply
                          ? 'Sending...'
                          : 'Send Reply'}
                      </button>
                    </div>

                    <div className="mt-5 pt-5 border-t flex flex-wrap gap-3">

                      {supportThread
                        .order
                        .status ===
                      'REFUNDED' ? (
                        <button
                          disabled
                          className="bg-gray-300 text-gray-600 px-5 py-2.5 rounded-lg cursor-not-allowed"
                        >
                          Refunded
                        </button>
                      ) : (
                        <button
                          onClick={
                            refundFromSupport
                          }
                          disabled={
                            supportActioning ||
                            sendingReply
                          }
                          className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50"
                        >
                          Refund Order
                        </button>
                      )}

                      <button
                        onClick={
                          resolveSupport
                        }
                        disabled={
                          supportActioning ||
                          sendingReply
                        }
                        className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50"
                      >
                        Resolve Conversation
                      </button>

                    </div>

                  </div>
                ) : (
                  <div className="p-5 border-t bg-green-50 text-green-800 font-semibold text-center">
                    {supportThread.status ===
                    'REFUNDED'
                      ? 'This conversation is closed because the order was refunded.'
                      : 'This customer support conversation has been resolved.'}
                  </div>
                )}
              </>
            )}

          </div>

        </div>
      )}

    </div>
  )
}