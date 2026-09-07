'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import QRCode from 'qrcode'
import { apiFetch } from '@/lib/api'

const API = (
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : '')
).replace(/\/+$/, '')

const API_CONFIGURED = API.length > 0

const QR_BASE_URL =
  process.env.NEXT_PUBLIC_QR_BASE_URL ||
  'https://caviarqr.com'

type Tab =
  | 'action'
  | 'cafes'
  | 'qr'
  | 'shop'

type Filter =
  | 'OPEN'
  | 'CRITICAL'
  | 'KITCHEN'
  | 'PAYMENT'
  | 'CUSTOMER'
  | 'REFUNDED'
  | 'RESOLVED'
  | 'ALL'

type IssueOrder = {
  id: string | number
  businessId?: number
  storeCode: string
  cafeName?: string | null
  customerName?: string | null
  customerEmail?: string | null
  tableNumber?: number | null
  total: number
  platformFee?: number | null
  status: string
  issueType?: string | null
  issueResolved?: boolean
  requiresOwnerAction?: boolean
  ownerIssueType?: string | null
  ownerIssueSeverity?: string | null
  ownerActionMessage?: string | null
  ownerActionId?: string | null
  ownerActionResolvedBy?: string | null
  ownerActionResolvedAt?: string | null
  ownerActionCreatedAt?: string | null
  stripePaymentIntentId?: string | null
  stripeSessionId?: string | null
  kitchenAcknowledged?: boolean
  kitchenAcknowledgedAt?: string | null
  createdAt?: string
  items?: any[]
  refundProcessed?: boolean
  refundAmount?: number | null
  refundApplicationFee?: boolean
  refundAt?: string | null
  refundRequested?: boolean
  refundId?: string | null
  stripeRefundStatus?: string | null
  refundFailureMessage?: string | null
  refundReason?: string | null

  backendOrderId?: number
  hasSupport?: boolean
  supportThreadId?: string | null
  supportStatus?: string | null
  supportUnreadCount?: number
  supportLatestMessage?: string | null
  supportLastMessageAt?: string | null
}

type SupportMessage = {
  id: number
  senderType: string
  senderName?: string | null
  message: string
  createdAt: string
}

type SupportThreadSummary = {
  id: string
  orderId: number
  businessId: number
  storeCode: string
  customerEmail?: string | null
  customerName?: string | null
  status: string
  restaurantUnreadCount?: number
  customerUnreadCount?: number
  lastMessageAt?: string | null
  latestMessage?: SupportMessage | null
  order?: {
    id: number
    total?: number
    currency?: string | null
    tableNumber?: number | null
    status?: string
    stripePaymentIntentId?: string | null
    refundProcessed?: boolean
    refundAmount?: number | null
    createdAt?: string
  } | null
}

type SupportThreadDetail =
  Omit<SupportThreadSummary, 'order'> & {
    resolvedAt?: string | null
    messages: SupportMessage[]
    order: {
      id: number
      items?: any[]
      total?: number
      currency?: string | null
      tableNumber?: number | null
      status?: string
      customerEmail?: string | null
      customerName?: string | null
      refundProcessed?: boolean
      refundAmount?: number | null
      stripePaymentIntentId?: string | null
      createdAt?: string
    }
  }

type Cafe = {
  storeCode: string
  cafeName: string
  orders: number
  revenue: number
  openIssues: number
  criticalIssues: number
  lastOrderAt?: string | null
}

type TableLink = {
  table: number
  link: string
  qrDataUrl: string
}

type PlatformPayoutRecord = {
  id: string
  amount: number
  currency: string
  status: string
  stripePayoutId?: string | null
  requestedBy?: string | null
  failureMessage?: string | null
  createdAt: string
}

type PlatformRevenue = {
  success?: boolean
  message?: string
  available: number
  pending: number
  reserve: number
  withdrawable: number
  recordedNetFees: number
  currency: string
  payouts: PlatformPayoutRecord[]
}

type ShopProduct = {
  id: number
  name: string
  description: string
  priceCents: number
  priceDraft?: string
  imageUrl: string | null
  inventory: number
  inventoryDraft?: string
  active: boolean
  createdAt?: string
  updatedAt?: string
}

type ShopOrderItem = {
  id: number
  orderId: number
  productId?: number | null
  productName: string
  unitPriceCents: number
  quantity: number
}

type ShopAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

type ShopOrder = {
  id: number
  orderNumber: string
  email?: string | null
  customerName?: string | null
  phone?: string | null
  shippingAddress?: ShopAddress | null
  subtotalCents: number
  shippingCents: number
  totalCents: number
  currency: string
  paymentStatus: string
  fulfillmentStatus: string
  trackingNumber?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  inventoryReserved?: boolean
  paidAt?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  confirmationEmailSentAt?: string | null
  confirmationEmailLastAttemptAt?: string | null
  confirmationEmailAttempts?: number
  confirmationEmailFailureMessage?: string | null
  refundStatus?: string
  stripeRefundId?: string | null
  refundAmountCents?: number | null
  refundReason?: string | null
  refundRequestedAt?: string | null
  refundedAt?: string | null
  refundFailureMessage?: string | null
  createdAt: string
  items: ShopOrderItem[]
}

type ShopOrderView =
  | 'active'
  | 'past'

type ShopOrderPage = {
  view: ShopOrderView
  limit: number
  total: number
  hasMore: boolean
  nextCursor: number | null
}

type ToastKind = 'success' | 'error' | 'info'

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

type ConfirmState = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  tone: 'danger' | 'default'
  onConfirm: (() => void) | null
}

const EMPTY_CONFIRM: ConfirmState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  tone: 'default',
  onConfirm: null,
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`
}

function shopMoney(cents: number) {
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

function shopImageUrl(
  value?: string | null,
) {
  if (!value) return ''

  if (
    value.startsWith('https://') ||
    value.startsWith('http://')
  ) {
    return value
  }

  return `${API}${
    value.startsWith('/')
      ? value
      : `/${value}`
  }`
}

function shopAddressLabel(
  value?: ShopAddress | null,
) {
  if (!value) {
    return 'No shipping address'
  }

  return [
    value.line1,
    value.line2,
    value.city,
    value.state,
    value.postal_code,
    value.country,
  ]
    .filter(Boolean)
    .join(', ')
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function timeLabel(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

function relativeTime(value?: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  const ms = date.getTime()
  if (Number.isNaN(ms)) return 'N/A'
  const diffSec = Math.round((Date.now() - ms) / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function initials(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '?'
  const parts = clean.split(/\s+/).slice(0, 2)
  return parts
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getArray(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.issues)) return data.issues
  if (Array.isArray(data?.orders)) return data.orders
  if (Array.isArray(data?.recentOrders)) return data.recentOrders
  if (Array.isArray(data?.stores)) return data.stores
  if (Array.isArray(data?.data)) return data.data
  return []
}

function getSupportThreads(data: any): SupportThreadSummary[] {
  if (Array.isArray(data)) {
    return data as SupportThreadSummary[]
  }

  if (Array.isArray(data?.threads)) {
    return data.threads as SupportThreadSummary[]
  }

  return []
}

function isTerminalSupportStatus(
  status?: string | null,
) {
  const value =
    String(status || '').toUpperCase()

  return (
    value === 'RESOLVED' ||
    value === 'REFUNDED'
  )
}

function getBackendOrderId(
  order: IssueOrder,
) {
  const value =
    Number(
      order.backendOrderId ??
        order.id,
    )

  return (
    Number.isInteger(value) &&
    value > 0
  )
    ? value
    : null
}

function getDisplayOrderId(
  order: IssueOrder,
) {
  return (
    getBackendOrderId(order) ??
    order.id
  )
}

function supportThreadToIssue(
  thread: SupportThreadSummary,
): IssueOrder {
  const orderId =
    Number(
      thread.order?.id ??
        thread.orderId,
    )

  const terminal =
    isTerminalSupportStatus(
      thread.status,
    )

  return {
    id: `SUPPORT:${orderId}`,
    backendOrderId: orderId,
    businessId: thread.businessId,
    storeCode: thread.storeCode,
    customerEmail:
      thread.customerEmail ||
      null,
    customerName:
      thread.customerName ||
      null,
    tableNumber:
      thread.order?.tableNumber ??
      null,
    total: Number(
      thread.order?.total || 0,
    ),
    status:
      String(
        thread.order?.status ||
          'NEW',
      ),
    issueType:
      'CUSTOMER_SUPPORT_REQUEST',
    issueResolved: terminal,
    requiresOwnerAction:
      !terminal,
    ownerIssueType:
      'CUSTOMER_SUPPORT_REQUEST',
    ownerIssueSeverity:
      'WARNING',
    ownerActionMessage:
      thread.latestMessage?.message ||
      'Customer sent a help request.',
    ownerActionId:
      `SUP-${String(orderId).padStart(
        6,
        '0',
      )}`,
    ownerActionCreatedAt:
      thread.lastMessageAt ||
      thread.order?.createdAt ||
      null,
    stripePaymentIntentId:
      thread.order
        ?.stripePaymentIntentId ||
      null,
    createdAt:
      thread.order?.createdAt,
    refundProcessed:
      Boolean(
        thread.order
          ?.refundProcessed,
      ),
    refundAmount:
      thread.order?.refundAmount ??
      null,
    hasSupport: true,
    supportThreadId:
      thread.id,
    supportStatus:
      thread.status,
    supportUnreadCount:
      Math.max(
        0,
        Number(
          thread
            .restaurantUnreadCount ||
            0,
        ),
      ),
    supportLatestMessage:
      thread.latestMessage?.message ||
      null,
    supportLastMessageAt:
      thread.lastMessageAt ||
      null,
  }
}

function uniqueOrders(list: IssueOrder[]) {
  const map = new Map<string, IssueOrder>()

  list.forEach((order) => {
    const key = String(order.id)
    const existing = map.get(key)

    map.set(
      key,
      existing
        ? {
            ...existing,
            ...order,
          }
        : order,
    )
  })

  return Array.from(map.values())
}

function isOpenIssue(order: IssueOrder) {
  return Boolean(order.requiresOwnerAction && !order.issueResolved)
}

function isCritical(order: IssueOrder) {
  return String(order.ownerIssueSeverity || '').toUpperCase() === 'CRITICAL'
}

function getIssueType(order: IssueOrder) {
  return order.ownerIssueType || order.issueType || 'SYSTEM_ALERT'
}

function getIssueMessage(order: IssueOrder) {
  return (
    order.supportLatestMessage ||
    order.ownerActionMessage ||
    order.ownerIssueType ||
    order.issueType ||
    'This order needs review.'
  )
}

function orderTimestamp(
  order: IssueOrder,
) {
  return (
    order.supportLastMessageAt ||
    order.ownerActionCreatedAt ||
    order.createdAt ||
    0
  )
}

function sortOrders(a: IssueOrder, b: IssueOrder) {
  if (isOpenIssue(a) !== isOpenIssue(b)) return isOpenIssue(a) ? -1 : 1
  if (isCritical(a) !== isCritical(b)) return isCritical(a) ? -1 : 1

  const at = new Date(
    orderTimestamp(a),
  ).getTime()

  const bt = new Date(
    orderTimestamp(b),
  ).getTime()

  return bt - at
}

function Icon({
  path,
  size = 18,
}: {
  path: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

const ICONS = {
  inbox:
    'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z',
  store:
    'M3 9.5 4.5 4h15L21 9.5M3 9.5a2.5 2.5 0 0 0 5 0M3 9.5V19a1 1 0 0 0 1 1h4v-5h8v5h4a1 1 0 0 0 1-1V9.5M8 9.5a2.5 2.5 0 0 0 5 0M13 9.5a2.5 2.5 0 0 0 5 0M18 9.5a2.5 2.5 0 0 0 3-2.4',
  qr:
    'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3h1M14 20h3M20 20h1',
  search: 'm21 21-4.34-4.34M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  refresh:
    'M21 12a9 9 0 0 1-15.3 6.4L3 16M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5M3 21v-5h5',
  chevronLeft: 'm15 18-6-6 6-6',
  x: 'M18 6 6 18M6 6l12 12',
  mail:
    'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M3 6l9 7 9-7',
  check: 'M20 6 9 17l-5-5',
  rotate:
    'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5',
  copy:
    'M9 9h10v10H9zM5 15V5a1 1 0 0 1 1-1h10',
  download:
    'M12 3v12m0 0-4-4m4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  alert:
    'M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  clipboardCheck:
    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9zM9 14l2 2 4-4',
  wallet:
    'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3 M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H8 M17 13h.01',
}

export default function MaintenancePage() {
  const [tab, setTab] = useState<Tab>('action')
  const [issues, setIssues] = useState<IssueOrder[]>([])
  const [orders, setOrders] = useState<IssueOrder[]>([])
  const [supportIssues, setSupportIssues] =
    useState<IssueOrder[]>([])
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [selectedCafe, setSelectedCafe] = useState<string | null>(null)
  const [selectedCafeOrders, setSelectedCafeOrders] = useState<IssueOrder[]>([])
  const [selectedCafeProcessingFee, setSelectedCafeProcessingFee] =
    useState('4.75')
  const [processingFeeSaving, setProcessingFeeSaving] =
    useState(false)

  const [
    selectedCafeEmailMarketingEnabled,
    setSelectedCafeEmailMarketingEnabled,
  ] = useState<boolean | null>(null)

  const [
    emailMarketingSaving,
    setEmailMarketingSaving,
  ] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [backendOnline, setBackendOnline] = useState(true)
  const [backendError, setBackendError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [actioningId, setActioningId] = useState<string | number | null>(null)
  const [emailOrder, setEmailOrder] = useState<IssueOrder | null>(null)
  const [emailNote, setEmailNote] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  const [supportOrder, setSupportOrder] =
    useState<IssueOrder | null>(null)
  const [supportThread, setSupportThread] =
    useState<SupportThreadDetail | null>(null)
  const [supportLoading, setSupportLoading] =
    useState(false)
  const [replyText, setReplyText] =
    useState('')
  const [sendingReply, setSendingReply] =
    useState(false)

  const [platformRevenue, setPlatformRevenue] =
    useState<PlatformRevenue | null>(null)
  const [revenueLoading, setRevenueLoading] =
    useState(false)
  const [revenueError, setRevenueError] =
    useState('')
  const [withdrawing, setWithdrawing] =
    useState(false)
  const [withdrawAmount, setWithdrawAmount] =
    useState('')
  const [qrStoreCode, setQrStoreCode] = useState('')
  const [qrTableCount, setQrTableCount] = useState(50)
  const [tableLinks, setTableLinks] = useState<TableLink[]>([])
  const [generatingQr, setGeneratingQr] = useState(false)

  const [standStatus, setStandStatus] =
    useState('')

  const [
    standAlreadyExists,
    setStandAlreadyExists,
  ] = useState(false)

  const [
    standRegistered,
    setStandRegistered,
  ] = useState(false)

  const [
    shopProducts,
    setShopProducts,
  ] = useState<ShopProduct[]>([])

  const [
    shopOrders,
    setShopOrders,
  ] = useState<ShopOrder[]>([])

  const [
    shopOrderView,
    setShopOrderView,
  ] =
    useState<ShopOrderView>(
      'active',
    )

  const [
    shopOrderSearchDraft,
    setShopOrderSearchDraft,
  ] = useState('')

  const [
    shopOrderSearch,
    setShopOrderSearch,
  ] = useState('')

  const [
    shopOrderPage,
    setShopOrderPage,
  ] =
    useState<ShopOrderPage>({
      view: 'active',
      limit: 50,
      total: 0,
      hasMore: false,
      nextCursor: null,
    })

  const [
    shopOrdersLoadingMore,
    setShopOrdersLoadingMore,
  ] = useState(false)


  const [
    shopRefundOrderId,
    setShopRefundOrderId,
  ] = useState<number | null>(
    null,
  )

  const [
    shopRefundReason,
    setShopRefundReason,
  ] = useState('')

  const [
    shopRefundConfirmed,
    setShopRefundConfirmed,
  ] = useState(false)

  const [
    shopRefundBusyId,
    setShopRefundBusyId,
  ] = useState<number | null>(
    null,
  )

  const [
    shopLoading,
    setShopLoading,
  ] = useState(false)

  const [
    shopError,
    setShopError,
  ] = useState('')

  const [
    newShopName,
    setNewShopName,
  ] = useState('')

  const [
    newShopDescription,
    setNewShopDescription,
  ] = useState('')

  const [
    newShopPrice,
    setNewShopPrice,
  ] = useState('')

  const [
    newShopInventory,
    setNewShopInventory,
  ] = useState('')

  const [
    creatingShopProduct,
    setCreatingShopProduct,
  ] = useState(false)

  const [
    shopProductBusyId,
    setShopProductBusyId,
  ] = useState<number | null>(null)

  const [
    shopOrderBusyId,
    setShopOrderBusyId,
  ] = useState<number | null>(null)

  const [copied, setCopied] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>(EMPTY_CONFIRM)
  const toastCounter = useRef(0)
  const selectedCafeRef = useRef<string | null>(null)
  const payoutRequestInFlight = useRef(false)
  const dashboardRequestInFlight = useRef(false)
  const revenueRequestInFlight = useRef(false)
  const refundRequestInFlight = useRef(false)
  const resolveRequestInFlight = useRef(false)
  const processingFeeRequestInFlight = useRef(false)
  const emailMarketingRequestInFlight = useRef(false)
  const cafeRequestIdRef = useRef(0)

  function pushToast(kind: ToastKind, message: string) {
    toastCounter.current += 1
    const id = toastCounter.current
    setToasts((prev) => [...prev, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function askConfirm(opts: {
    title: string
    message: string
    confirmLabel?: string
    tone?: 'danger' | 'default'
    onConfirm: () => void
  }) {
    setConfirmState({
      open: true,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel || 'Confirm',
      tone: opts.tone || 'default',
      onConfirm: opts.onConfirm,
    })
  }

  function closeConfirm() {
    setConfirmState(EMPTY_CONFIRM)
  }

  function runConfirm() {
    const action = confirmState.onConfirm
    closeConfirm()
    action?.()
  }

  function buildCafeList(
    storeList: any[],
    issueList: IssueOrder[],
    orderList: IssueOrder[],
  ) {
    const map = new Map<string, Cafe>()
    storeList.forEach((store: any) => {
      const storeCode =
        typeof store === 'string'
          ? store
          : store.storeCode || store.code || String(store.id || '')
      if (!storeCode) return
      const cafeName =
        typeof store === 'string'
          ? store
          : store.cafeName || store.name || store.storeCode || storeCode
      map.set(storeCode, {
        storeCode,
        cafeName,
        orders: 0,
        revenue: 0,
        openIssues: 0,
        criticalIssues: 0,
        lastOrderAt: null,
      })
    })

    const all = uniqueOrders([
      ...issueList,
      ...orderList,
    ])
    all.forEach((order) => {
      if (!order.storeCode) return
      const cafe = map.get(order.storeCode) || {
        storeCode: order.storeCode,
        cafeName: order.cafeName || order.storeCode,
        orders: 0,
        revenue: 0,
        openIssues: 0,
        criticalIssues: 0,
        lastOrderAt: null,
      }

      cafe.orders += 1

      const refundedAmount =
        order.status === 'REFUNDED' ||
        order.refundProcessed
          ? Number(
              order.refundAmount ??
                order.total ??
                0,
            )
          : 0

      cafe.revenue +=
        Number(order.total || 0) -
        refundedAmount
      if (isOpenIssue(order)) cafe.openIssues += 1
      if (isOpenIssue(order) && isCritical(order)) cafe.criticalIssues += 1

      const oldTime = cafe.lastOrderAt ? new Date(cafe.lastOrderAt).getTime() : 0
      const newTime = order.createdAt ? new Date(order.createdAt).getTime() : 0
      if (newTime > oldTime) cafe.lastOrderAt = order.createdAt || null

      map.set(order.storeCode, cafe)
    })

    setCafes(
      Array.from(map.values()).sort(
        (a, b) =>
          b.openIssues - a.openIssues ||
          b.criticalIssues - a.criticalIssues ||
          a.storeCode.localeCompare(b.storeCode),
      ),
    )
  }

  async function loadPlatformRevenue() {
    if (!API_CONFIGURED) {
      setRevenueError(
        'NEXT_PUBLIC_API_URL is not configured.',
      )
      return
    }

    if (revenueRequestInFlight.current) {
      return
    }

    revenueRequestInFlight.current = true

    try {
      setRevenueLoading(true)

      const result = (await apiFetch(
        `${API}/maintenance/platform-revenue`,
        {},
      )) as PlatformRevenue

      if (!result?.success) {
        throw new Error(
          result?.message ||
            'Stripe platform balance could not be loaded.',
        )
      }

      const available = Number(
        result?.available || 0,
      )

      const pending = Number(
        result?.pending || 0,
      )

      const reserve = Number(
        result?.reserve || 0,
      )

      const withdrawable = Number(
        result?.withdrawable || 0,
      )

      setPlatformRevenue({
        success: Boolean(result?.success),
        available,
        pending,
        reserve,
        withdrawable,
        recordedNetFees: Number(
          result?.recordedNetFees || 0,
        ),
        currency: String(
          result?.currency || 'usd',
        ).toLowerCase(),
        payouts: Array.isArray(
          result?.payouts,
        )
          ? result.payouts
          : [],
      })

      setWithdrawAmount((current) => {
        if (current.trim()) {
          return current
        }

        return withdrawable > 0
          ? withdrawable.toFixed(2)
          : ''
      })

      setRevenueError('')
    } catch (error: any) {
      setRevenueError(
        error?.message ||
          'Stripe platform balance could not be loaded.',
      )
    } finally {
      revenueRequestInFlight.current = false
      setRevenueLoading(false)
    }
  }

  async function loadData(
    silent = false,
  ) {
    if (!API_CONFIGURED) {
      setBackendOnline(false)
      setBackendError(
        'NEXT_PUBLIC_API_URL is not configured.',
      )
      setLoading(false)
      return
    }

    if (dashboardRequestInFlight.current) {
      return
    }

    dashboardRequestInFlight.current = true

    if (!silent) {
      setLoading(true)
    }

    setRefreshing(true)

    try {
      const [
        issuesRes,
        ordersRes,
        storesRes,
      ] = await Promise.all([
        apiFetch(
          `${API}/maintenance/issues`,
          {},
        ),
        apiFetch(
          `${API}/maintenance/orders`,
          {},
        ),
        apiFetch(
          `${API}/maintenance/stores`,
          {},
        ),
      ])

      const issueList = getArray(
        issuesRes,
      ) as IssueOrder[]

      const orderList = getArray(
        ordersRes,
      ) as IssueOrder[]

      const storeList = getArray(storesRes)

      try {
        const supportRes =
          await apiFetch(
            `${API}/maintenance/support/threads`,
            {},
          )

        const supportIssueList =
          getSupportThreads(
            supportRes,
          ).map(
            supportThreadToIssue,
          )

        setSupportIssues(
          supportIssueList,
        )
      } catch (supportError) {
        console.error(
          'CUSTOMER SUPPORT LOAD FAILED:',
          supportError,
        )
      }

      setIssues(issueList)
      setOrders(orderList)

      buildCafeList(
        storeList,
        issueList,
        orderList,
      )

      setBackendOnline(true)
      setBackendError('')
      setLastUpdated(new Date())

      const activeCafe = selectedCafeRef.current

      if (activeCafe) {
        const requestId =
          cafeRequestIdRef.current + 1

        cafeRequestIdRef.current = requestId

        try {
          const cafeRes = await apiFetch(
            `${API}/maintenance/cafe/${encodeURIComponent(
              activeCafe,
            )}`,
            {},
          )

          if (
            requestId !==
            cafeRequestIdRef.current
          ) {
            return
          }

          const freshProcessingFee = Number(
            (cafeRes as any)?.business?.processingFeePercent,
          )

          if (Number.isFinite(freshProcessingFee)) {
            setSelectedCafeProcessingFee(
              freshProcessingFee.toFixed(2),
            )
          }

          const freshEmailMarketingEnabled =
            (cafeRes as any)?.business
              ?.emailMarketingEnabled

          setSelectedCafeEmailMarketingEnabled(
            typeof freshEmailMarketingEnabled ===
              'boolean'
              ? freshEmailMarketingEnabled
              : true,
          )

          const freshCafeOrders = getArray(
            cafeRes,
          ) as IssueOrder[]

          setSelectedCafeOrders(
            freshCafeOrders.length
              ? uniqueOrders(freshCafeOrders)
              : uniqueOrders([
                  ...issueList,
                  ...orderList,
                ]).filter(
                  (order) =>
                    order.storeCode === activeCafe,
                ),
          )
        } catch {
          if (
            requestId ===
            cafeRequestIdRef.current
          ) {
            setSelectedCafeOrders(
              uniqueOrders([
                ...issueList,
                ...orderList,
              ]).filter(
                (order) =>
                  order.storeCode === activeCafe,
              ),
            )
          }
        }
      }
    } catch (error: any) {
      setBackendOnline(false)

      setBackendError(
        error?.message ||
          'Backend or maintenance endpoints are not reachable.',
      )
    } finally {
      dashboardRequestInFlight.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function openCafe(
    storeCode: string,
  ) {
    const requestId =
      cafeRequestIdRef.current + 1

    cafeRequestIdRef.current = requestId

    selectedCafeRef.current = storeCode
    setSelectedCafe(storeCode)
    setSelectedCafeProcessingFee('')
    setSelectedCafeEmailMarketingEnabled(null)

    try {
      const response = await apiFetch(
        `${API}/maintenance/cafe/${encodeURIComponent(
          storeCode,
        )}`,
        {},
      )

      if (
        requestId !==
        cafeRequestIdRef.current
      ) {
        return
      }

      const processingFee = Number(
        (response as any)?.business?.processingFeePercent,
      )

      setSelectedCafeProcessingFee(
        Number.isFinite(processingFee)
          ? processingFee.toFixed(2)
          : '4.75',
      )

      const emailMarketingEnabled =
        (response as any)?.business
          ?.emailMarketingEnabled

      setSelectedCafeEmailMarketingEnabled(
        typeof emailMarketingEnabled ===
          'boolean'
          ? emailMarketingEnabled
          : true,
      )

      const cafeOrders = getArray(
        response,
      ) as IssueOrder[]

      setSelectedCafeOrders(
        cafeOrders.length
          ? uniqueOrders(cafeOrders)
          : allOrders.filter(
              (order) =>
                order.storeCode === storeCode,
            ),
      )
    } catch {
      if (
        requestId !==
        cafeRequestIdRef.current
      ) {
        return
      }

      setSelectedCafeOrders(
        allOrders.filter(
          (order) =>
            order.storeCode === storeCode,
        ),
      )

      setSelectedCafeProcessingFee('4.75')
      setSelectedCafeEmailMarketingEnabled(null)

      pushToast(
        'error',
        'Cafe details could not be refreshed. Showing cached dashboard data.',
      )
    }
  }

  async function saveProcessingFee() {
    if (!selectedCafe || processingFeeRequestInFlight.current) {
      return
    }

    const processingFee = Number(selectedCafeProcessingFee)

    if (
      !Number.isFinite(processingFee) ||
      processingFee < 0 ||
      processingFee > 10
    ) {
      pushToast(
        'error',
        'Processing fee must be between 0% and 10%.',
      )
      return
    }

    processingFeeRequestInFlight.current = true

    try {
      setProcessingFeeSaving(true)

      const result = (await apiFetch(
        `${API}/maintenance/cafe/${encodeURIComponent(
          selectedCafe,
        )}/processing-fee`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            processingFeePercent: processingFee,
          }),
        },
      )) as {
        success?: boolean
        processingFeePercent?: number
      }

      const savedFee = Number(
        result?.processingFeePercent ?? processingFee,
      )

      setSelectedCafeProcessingFee(
        Number.isFinite(savedFee)
          ? savedFee.toFixed(2)
          : processingFee.toFixed(2),
      )

      pushToast(
        'success',
        `${selectedCafe} processing fee saved at ${
          Number.isFinite(savedFee) ? savedFee : processingFee
        }%.`,
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Processing fee could not be updated.',
      )
    } finally {
      processingFeeRequestInFlight.current = false
      setProcessingFeeSaving(false)
    }
  }

  async function setEmailMarketingEnabled(
    enabled: boolean,
  ) {
    if (
      !selectedCafe ||
      emailMarketingRequestInFlight.current
    ) {
      return
    }

    emailMarketingRequestInFlight.current =
      true

    try {
      setEmailMarketingSaving(true)

      const result =
        (await apiFetch(
          `${API}/maintenance/cafe/${encodeURIComponent(
            selectedCafe,
          )}/email-marketing`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              enabled,
            }),
          },
        )) as {
          success?: boolean
          message?: string
          emailMarketingEnabled?: boolean
        }

      if (
        result?.success ===
        false
      ) {
        throw new Error(
          result?.message ||
            'Email marketing access could not be updated.',
        )
      }

      const savedEnabled =
        typeof result
          ?.emailMarketingEnabled ===
        'boolean'
          ? result.emailMarketingEnabled
          : enabled

      setSelectedCafeEmailMarketingEnabled(
        savedEnabled,
      )

      pushToast(
        'success',
        `${selectedCafe} email marketing ${
          savedEnabled
            ? 'enabled'
            : 'disabled'
        }.`,
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Email marketing access could not be updated.',
      )
    } finally {
      emailMarketingRequestInFlight.current =
        false

      setEmailMarketingSaving(
        false,
      )
    }
  }

  async function loadSupportThread(
    orderId: number,
    quiet = false,
  ) {
    if (!quiet) {
      setSupportLoading(true)
    }

    try {
      const response = (await apiFetch(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(orderId),
        )}`,
        {},
      )) as {
        success?: boolean
        thread?: SupportThreadDetail
      }

      if (!response?.thread) {
        throw new Error(
          'Support conversation not found.',
        )
      }

      setSupportThread(
        response.thread,
      )

      return response.thread
    } catch (error: any) {
      if (!quiet) {
        pushToast(
          'error',
          error?.message ||
            'Support conversation could not be loaded.',
        )
      }

      return null
    } finally {
      if (!quiet) {
        setSupportLoading(false)
      }
    }
  }

  async function openSupport(
    order: IssueOrder,
  ) {
    const orderId =
      getBackendOrderId(order)

    if (!orderId) {
      pushToast(
        'error',
        'This support request is missing its order id.',
      )
      return
    }

    setSupportOrder(order)
    setSupportThread(null)
    setReplyText('')

    const thread =
      await loadSupportThread(
        orderId,
      )

    if (!thread) {
      setSupportOrder(null)
      return
    }

    try {
      await apiFetch(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(orderId),
        )}/read`,
        {
          method: 'PATCH',
        },
      )

      setSupportIssues(
        (current) =>
          current.map(
            (item) =>
              getBackendOrderId(
                item,
              ) === orderId
                ? {
                    ...item,
                    supportUnreadCount:
                      0,
                  }
                : item,
          ),
      )
    } catch (error) {
      console.error(
        'SUPPORT READ ACK FAILED:',
        error,
      )
    }
  }

  function closeSupport() {
    setSupportOrder(null)
    setSupportThread(null)
    setReplyText('')
  }

  async function sendSupportReply() {
    if (
      !supportOrder ||
      sendingReply
    ) {
      return
    }

    const orderId =
      getBackendOrderId(
        supportOrder,
      )

    if (!orderId) {
      pushToast(
        'error',
        'This support request is missing its order id.',
      )
      return
    }

    const message =
      replyText.trim()

    if (!message) {
      pushToast(
        'error',
        'Enter a reply first.',
      )
      return
    }

    if (message.length > 2_000) {
      pushToast(
        'error',
        'Reply must be 2,000 characters or less.',
      )
      return
    }

    try {
      setSendingReply(true)

      await apiFetch(
        `${API}/maintenance/support/order/${encodeURIComponent(
          String(orderId),
        )}/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            message,
          }),
        },
      )

      setReplyText('')

      await loadSupportThread(
        orderId,
        true,
      )

      await loadData(true)

      pushToast(
        'success',
        'Reply saved to the customer conversation.',
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Reply could not be sent.',
      )
    } finally {
      setSendingReply(false)
    }
  }

  useEffect(() => {
    void loadData()
    void loadPlatformRevenue()
  
    const dashboardTimer = autoRefresh
      ? window.setInterval(
          () => void loadData(true),
          20_000,
        )
      : null
  
    const revenueTimer = window.setInterval(
      () => void loadPlatformRevenue(),
      5 * 60 * 1000,
    )
  
    return () => {
      if (dashboardTimer) {
        window.clearInterval(dashboardTimer)
      }
  
      window.clearInterval(revenueTimer)
    }
  
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])
  

  useEffect(() => {
    selectedCafeRef.current = selectedCafe
  }, [selectedCafe])

  useEffect(() => {
    if (!supportOrder) {
      return
    }

    const orderId =
      getBackendOrderId(
        supportOrder,
      )

    if (!orderId) {
      return
    }

    const timer =
      window.setInterval(
        () =>
          void loadSupportThread(
            orderId,
            true,
          ),
        5_000,
      )

    return () =>
      window.clearInterval(
        timer,
      )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportOrder?.id])

  const allOrders = useMemo(
    () =>
      uniqueOrders([
        ...issues,
        ...orders,
      ]),
    [issues, orders],
  )

  const actionCenterOrders =
    useMemo(
      () =>
        uniqueOrders([
          ...allOrders,
          ...supportIssues,
        ]),
      [
        allOrders,
        supportIssues,
      ],
    )

  const openIssues =
    actionCenterOrders.filter(
      isOpenIssue,
    )

  const criticalIssues =
    openIssues.filter(isCritical)

  const refundedOrders =
    allOrders.filter(
      (order) =>
        order.status === 'REFUNDED' ||
        order.refundProcessed,
    )

  const openRiskOrders =
    Array.from(
      openIssues.reduce(
        (
          map,
          order,
        ) => {
          map.set(
            String(
              getBackendOrderId(
                order,
              ) ??
                order.id,
            ),
            order,
          )

          return map
        },
        new Map<
          string,
          IssueOrder
        >(),
      ).values(),
    )

  const atRiskAmount =
    openRiskOrders.reduce(
      (
        sum: number,
        order: IssueOrder,
      ) =>
        sum +
        Number(order.total || 0),
      0,
    )
  
  const grossPlatformFees =
    allOrders.reduce(
      (sum, order) =>
        sum +
        Number(order.platformFee || 0),
      0,
    )
  
  const refundedPlatformFees =
    allOrders
      .filter(
        (order) =>
          (
            order.status === 'REFUNDED' ||
            order.refundProcessed
          ) &&
          order.refundApplicationFee,
      )
      .reduce(
        (sum, order) =>
          sum +
          Number(order.platformFee || 0),
        0,
      )
  
  const netPlatformFees =
    grossPlatformFees -
    refundedPlatformFees

  const filteredIssues = useMemo(() => {
    const q =
      search.trim().toLowerCase()

    return actionCenterOrders
      .filter((order) => {
        const type =
          getIssueType(order).toUpperCase()

        if (
          filter === 'OPEN' &&
          !isOpenIssue(order)
        ) {
          return false
        }

        if (
          filter === 'CRITICAL' &&
          (
            !isOpenIssue(order) ||
            !isCritical(order)
          )
        ) {
          return false
        }

        if (
          filter === 'KITCHEN' &&
          !type.includes('KITCHEN')
        ) {
          return false
        }

        if (
          filter === 'PAYMENT' &&
          !(
            type.includes('PAY') ||
            type.includes('STRIPE') ||
            type.includes('WEBHOOK') ||
            type.includes('CHECKOUT')
          )
        ) {
          return false
        }

        if (
          filter === 'CUSTOMER' &&
          !order.hasSupport
        ) {
          return false
        }

        if (
          filter === 'REFUNDED' &&
          !(
            order.status === 'REFUNDED' ||
            order.refundProcessed
          )
        ) {
          return false
        }

        if (
          filter === 'RESOLVED' &&
          (
            !order.issueResolved ||
            order.status === 'REFUNDED' ||
            order.refundProcessed
          )
        ) {
          return false
        }

        if (!q) {
          return true
        }

        return (
          String(order.id)
            .toLowerCase()
            .includes(q) ||
          String(order.storeCode || '')
            .toLowerCase()
            .includes(q) ||
          String(order.cafeName || '')
            .toLowerCase()
            .includes(q) ||
          String(order.customerName || '')
            .toLowerCase()
            .includes(q) ||
          String(order.customerEmail || '')
            .toLowerCase()
            .includes(q) ||
          String(order.ownerActionId || '')
            .toLowerCase()
            .includes(q) ||
          String(
            order.stripePaymentIntentId || '',
          )
            .toLowerCase()
            .includes(q) ||
          String(order.refundId || '')
            .toLowerCase()
            .includes(q) ||
          String(
            order.supportLatestMessage || '',
          )
            .toLowerCase()
            .includes(q)
        )
      })
      .sort(sortOrders)
  }, [
    actionCenterOrders,
    search,
    filter,
  ])

  const filteredCafes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cafes
    return cafes.filter(
      (cafe) =>
        cafe.cafeName.toLowerCase().includes(q) ||
        cafe.storeCode.toLowerCase().includes(q),
    )
  }, [cafes, search])

  const selectedCafeFinancialOrders =
    useMemo(
      () =>
        uniqueOrders(
          selectedCafeOrders,
        ),
      [selectedCafeOrders],
    )

  const sortedCafeOrders = useMemo(
    () =>
      [
        ...selectedCafeFinancialOrders,
      ].sort(sortOrders),
    [selectedCafeFinancialOrders],
  )

  const vendorUrls = useMemo(() => {
    return tableLinks
      .map((item) => `Table ${item.table}: ${item.link}`)
      .join('\n')
  }, [tableLinks])

  const vendorCsv = useMemo(() => {
    const rows = [
      'Table,URL,NFC URL,QR URL',
      ...tableLinks.map(
        (item) =>
          `${item.table},"${item.link}","${item.link}","${item.link}"`,
      ),
    ]

    return rows.join('\n')
  }, [tableLinks])

  const groupedIssues = useMemo(
    () => ({
      open: filteredIssues.filter(
        isOpenIssue,
      ),

      other: filteredIssues.filter(
        (order) =>
          !isOpenIssue(order),
      ),
    }),
    [filteredIssues],
  )

  async function doRefund(
    order: IssueOrder,
  ) {
    if (refundRequestInFlight.current) {
      return
    }

    const orderId =
      getBackendOrderId(order)

    if (!orderId) {
      pushToast(
        'error',
        'This action is missing its order id.',
      )
      return
    }

    refundRequestInFlight.current = true

    try {
      setActioningId(order.id)

      const result = (await apiFetch(
        `${API}/maintenance/refund/${encodeURIComponent(
          String(orderId),
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            reason: 'ORDER_NOT_DELIVERED',
            note:
              'Refund initiated from the CaviarQR Action Center.',
          }),
        },
      )) as {
        message?: string
        refundId?: string
        stripeRefundStatus?: string
        pending?: boolean
        reconciliationRequired?: boolean
      }

      if (
        order.hasSupport &&
        !result?.pending &&
        !result?.reconciliationRequired
      ) {
        try {
          await apiFetch(
            `${API}/maintenance/support/order/${encodeURIComponent(
              String(orderId),
            )}/resolve`,
            {
              method: 'PATCH',
            },
          )
        } catch (supportError) {
          console.error(
            'SUPPORT REFUND RESOLVE FAILED:',
            supportError,
          )
        }
      }

      await loadData(true)
      await loadPlatformRevenue()

      if (
        supportOrder &&
        getBackendOrderId(
          supportOrder,
        ) === orderId
      ) {
        await loadSupportThread(
          orderId,
          true,
        )
      }

      pushToast(
        result?.pending ||
          result?.reconciliationRequired
          ? 'info'
          : 'success',
        result?.message ||
          `Order #${orderId} refund request processed.`,
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Refund failed. Check Stripe and backend logs.',
      )
    } finally {
      refundRequestInFlight.current = false
      setActioningId(null)
    }
  }

  function refundOrder(order: IssueOrder) {
    const orderId =
      getBackendOrderId(order)

    if (!orderId) {
      pushToast(
        'error',
        'This action is missing its order id.',
      )
      return
    }

    if (!order.stripePaymentIntentId) {
      pushToast('error', 'No Stripe payment found for this order.')
      return
    }

    if (
      order.status === 'REFUNDED' ||
      order.refundProcessed ||
      order.stripeRefundStatus === 'succeeded'
    ) {
      pushToast('info', 'This order is already refunded.')
      return
    }

    if (
      order.refundRequested ||
      order.stripeRefundStatus === 'pending'
    ) {
      pushToast(
        'info',
        'A refund is already being processed for this order.',
      )
      return
    }

    askConfirm({
      title: 'Refund this order?',
      message: `Order #${orderId} · ${money(order.total)} will be refunded through Stripe. This can't be undone.`,
      confirmLabel: 'Refund order',
      tone: 'danger',
      onConfirm: () => doRefund(order),
    })
  }

  async function doResolve(
    order: IssueOrder,
  ) {
    if (resolveRequestInFlight.current) {
      return
    }

    const orderId =
      getBackendOrderId(order)

    if (!orderId) {
      pushToast(
        'error',
        'This action is missing its order id.',
      )
      return
    }

    resolveRequestInFlight.current = true

    try {
      setActioningId(order.id)

      if (order.hasSupport) {
        await apiFetch(
          `${API}/maintenance/support/order/${encodeURIComponent(
            String(orderId),
          )}/resolve`,
          {
            method: 'PATCH',
          },
        )
      } else {
        await apiFetch(
          `${API}/maintenance/resolve/${encodeURIComponent(
            String(orderId),
          )}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              reason: 'MANUALLY_RESOLVED',
              note:
                'Resolved from the CaviarQR operations console.',
            }),
          },
        )
      }

      await loadData(true)

      if (
        supportOrder &&
        getBackendOrderId(
          supportOrder,
        ) === orderId
      ) {
        await loadSupportThread(
          orderId,
          true,
        )
      }

      pushToast(
        'success',
        order.hasSupport
          ? `Customer help request for order #${orderId} resolved.`
          : `Order #${orderId} marked resolved.`,
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Failed to resolve issue.',
      )
    } finally {
      resolveRequestInFlight.current = false
      setActioningId(null)
    }
  }

  function resolveOrder(order: IssueOrder) {
    const orderId =
      getBackendOrderId(order)

    if (!orderId) {
      pushToast(
        'error',
        'This action is missing its order id.',
      )
      return
    }

    askConfirm({
      title: order.hasSupport
        ? 'Resolve customer help request?'
        : 'Mark as resolved?',
      message: order.hasSupport
        ? `Customer conversation for order #${orderId} will be marked resolved.`
        : `Order #${orderId} will be cleared from the action center.`,
      confirmLabel: 'Mark resolved',
      onConfirm: () => doResolve(order),
    })
  }

  function openEmail(order: IssueOrder) {
    setEmailOrder(order)
    setEmailNote(
      `Hi ${order.customerName || 'there'}, we noticed an issue with your CaviarQR order #${getDisplayOrderId(order)}. Our support team is reviewing it now and will help resolve it as quickly as possible.`,
    )
  }

  async function sendEmail() {
    if (!emailOrder) return
    if (!emailOrder.customerEmail) {
      pushToast('error', 'This order has no customer email.')
      return
    }
    try {
      setSendingEmail(true)
      await apiFetch(`${API}/maintenance/email-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: emailOrder.id,
          email: emailOrder.customerEmail,
          name: emailOrder.customerName,
          note: emailNote,
        }),
      })
      pushToast('success', 'Email sent to customer.')
      setEmailOrder(null)
      setEmailNote('')
    } catch {
      pushToast('error', 'Email failed — check backend email settings.')
    } finally {
      setSendingEmail(false)
    }
  }

  function createPayoutIdempotencyKey() {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID()
    }
  
    return `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
  }
  
  function requestPlatformWithdrawal() {
    const amount = Number(withdrawAmount)
  
    const withdrawable = Number(
      platformRevenue?.withdrawable || 0,
    )
  
    const currency = String(
      platformRevenue?.currency || 'usd',
    ).toUpperCase()
  
    if (revenueLoading) {
      pushToast(
        'info',
        'Stripe revenue is still loading.',
      )
      return
    }
  
    if (withdrawable <= 0) {
      const pending = Number(
        platformRevenue?.pending || 0,
      )
  
      pushToast(
        'info',
        pending > 0
          ? `${money(
              pending,
            )} is pending in Stripe and cannot be withdrawn yet.`
          : 'No CaviarQR platform funds are currently available.',
      )
  
      return
    }
  
    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      pushToast(
        'error',
        'Enter a valid withdrawal amount.',
      )
      return
    }
  
    if (amount > withdrawable) {
      pushToast(
        'error',
        `Maximum withdrawal is ${money(
          withdrawable,
        )}.`,
      )
      return
    }
  
    const idempotencyKey =
      createPayoutIdempotencyKey()
  
    askConfirm({
      title:
        'Withdraw CaviarQR platform funds?',
      message: `${money(
        amount,
      )} ${currency} will be sent from the Stripe platform balance to the CaviarQR business bank account. A ${money(
        platformRevenue?.reserve,
      )} safety reserve will remain in Stripe.`,
      confirmLabel: `Withdraw ${money(amount)}`,
      onConfirm: () => {
        void performPlatformWithdrawal(
          amount,
          idempotencyKey,
        )
      },
    })
  }
  
  async function performPlatformWithdrawal(
    amount: number,
    idempotencyKey: string,
  ) {
    if (payoutRequestInFlight.current) {
      return
    }
  
    payoutRequestInFlight.current = true
  
    try {
      setWithdrawing(true)
  
      const result = await apiFetch(
        `${API}/maintenance/platform-withdraw`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            amountCents: Math.round(
              amount * 100,
            ),
            idempotencyKey,
          }),
        },
      ) as {
        success?: boolean
        amount?: number
        payoutId?: string
        status?: string
        message?: string
      }

      if (!result?.success) {
        throw new Error(
          result?.message ||
            'Platform payout failed.',
        )
      }

  
      pushToast(
        'success',
        result?.payoutId
          ? `Stripe payout created: ${result.payoutId}`
          : result?.message ||
              'Platform payout created.',
      )
  
      setWithdrawAmount('')
  
      await loadPlatformRevenue()
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Platform payout failed.',
      )
    } finally {
      payoutRequestInFlight.current = false
      setWithdrawing(false)
    }
  }

  async function generateQrCodes() {
    const storeCode =
      qrStoreCode
        .trim()
        .toLowerCase()

    if (!API_CONFIGURED) {
      pushToast(
        'error',
        'Backend API is not configured.',
      )
      return
    }

    if (
      !/^[a-z0-9_-]{3,40}$/.test(
        storeCode,
      )
    ) {
      pushToast(
        'error',
        'Store code must be 3-40 characters using letters, numbers, underscores or hyphens.',
      )
      return
    }

    if (
      !Number.isInteger(qrTableCount) ||
      qrTableCount < 1 ||
      qrTableCount > 100
    ) {
      pushToast(
        'error',
        'Table count must be between 1 and 100.',
      )
      return
    }

    setGeneratingQr(true)
    setTableLinks([])
    setStandStatus('')
    setStandAlreadyExists(false)
    setStandRegistered(false)

    try {
      const result =
        await apiFetch(
          `${API}/maintenance/create-store`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              storeCode,
              tables: qrTableCount,
            }),
          },
        ) as {
          success?: boolean
          message?: string
          storeCode?: string
          tables?: number
          status?: string
          alreadyExists?: boolean
          registered?: boolean
          links?: {
            table: number
            url: string
          }[]
        }

      if (!result?.success) {
        throw new Error(
          result?.message ||
            'Could not create stand allocation.',
        )
      }

      const backendLinks =
        Array.isArray(result.links)
          ? result.links
          : []

      if (!backendLinks.length) {
        throw new Error(
          'Backend returned no table URLs.',
        )
      }

      const generated:
        TableLink[] = []

      for (
        const item of backendLinks
      ) {
        const table =
          Number(item.table)

        const link =
          String(
            item.url || '',
          ).trim()

        if (
          !Number.isInteger(table) ||
          table < 1 ||
          !link
        ) {
          continue
        }

        const qrDataUrl =
          await QRCode.toDataURL(
            link,
            {
              width: 360,
              margin: 1,
              errorCorrectionLevel:
                'H',
            },
          )

        generated.push({
          table,
          link,
          qrDataUrl,
        })
      }

      if (!generated.length) {
        throw new Error(
          'QR generation failed.',
        )
      }

      setQrStoreCode(
        String(
          result.storeCode ||
            storeCode,
        ),
      )

      setQrTableCount(
        Number(
          result.tables ||
            generated.length,
        ),
      )

      setTableLinks(
        generated,
      )

      setStandStatus(
        String(
          result.status ||
            'UNCLAIMED',
        ),
      )

      setStandAlreadyExists(
        result.alreadyExists ===
          true,
      )

      setStandRegistered(
        result.registered ===
          true,
      )



      pushToast(
        result.alreadyExists
          ? 'info'
          : 'success',
        result.alreadyExists
          ? 'Existing permanent stand allocation loaded.'
          : `Permanent stand set created.`,
      )
    } catch (error: any) {
      pushToast(
        'error',
        error?.message ||
          'Failed to create permanent stand set.',
      )
    } finally {
      setGeneratingQr(false)
    }
  }

  function exportQrPdf() {
    if (tableLinks.length === 0) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      pushToast('error', 'Allow pop-ups to export the PDF.')
      return
    }
    const cells = tableLinks
      .map(
        (t) => `
          <div class="qr-card">
            <img src="${t.qrDataUrl}" />
            <h2>Table ${t.table}</h2>
            <p>${escapeHtml(t.link)}</p>
          </div>
        `,
      )
      .join('')
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(qrStoreCode)} QR Codes</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .qr-card { border: 1px solid #ddd; border-radius: 16px; padding: 16px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    img { width: 170px; height: 170px; }
    h2 { margin: 8px 0 4px; font-size: 16px; }
    p { margin: 0; font-size: 9px; color: #555; word-break: break-all; }
  </style>
</head>
<body>
  <div class="grid">${cells}</div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  async function copyText(value: string, label: string) {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard
    ) {
      pushToast('error', 'Clipboard is not available.')
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      pushToast('success', 'Copied.')
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      pushToast('error', 'Could not copy.')
    }
  }

  function copyLink(link: string) {
    copyText(link, link)
  }

  function downloadQr(item: TableLink) {
    const a = document.createElement('a')
    a.href = item.qrDataUrl
    a.download = `${qrStoreCode.trim() || 'table'}-table-${item.table}.png`
    a.click()
  }

  function downloadVendorCsv() {
    if (!vendorCsv) return

    const blob = new Blob([vendorCsv], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${qrStoreCode.trim() || 'cafe'}-table-urls.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function shopOrdersUrl(
    view: ShopOrderView,
    searchValue: string,
    cursor?: number | null,
  ) {
    const params =
      new URLSearchParams()

    params.set(
      'view',
      view,
    )

    params.set(
      'limit',
      '50',
    )

    const cleanSearch =
      searchValue
        .trim()
        .slice(
          0,
          120,
        )

    if (cleanSearch) {
      params.set(
        'search',
        cleanSearch,
      )
    }

    if (
      cursor &&
      Number.isInteger(
        cursor,
      )
    ) {
      params.set(
        'cursor',
        String(
          cursor,
        ),
      )
    }

    return `${API}/maintenance/shop/orders?${params.toString()}`
  }

  async function loadShopOrdersPage(
    view: ShopOrderView,
    searchValue = '',
    cursor: number | null = null,
    append = false,
  ) {
    if (!API_CONFIGURED) {
      setShopError(
        'Backend API is not configured.',
      )

      return
    }

    try {
      if (append) {
        setShopOrdersLoadingMore(
          true,
        )
      } else {
        setShopLoading(
          true,
        )
      }

      setShopError('')

      const result =
        await apiFetch(
          shopOrdersUrl(
            view,
            searchValue,
            cursor,
          ),
        )

      if (!result.success) {
        throw new Error(
          result.message ||
            'Orders could not be loaded.',
        )
      }

      const orders =
        Array.isArray(
          result.orders,
        )
          ? result.orders
          : []

      const page =
        result.page &&
        typeof result.page ===
          'object'
          ? result.page
          : {}

      if (append) {
        setShopOrders(
          current => {
            const seen =
              new Set(
                current.map(
                  order =>
                    order.id,
                ),
              )

            const additions =
              orders.filter(
                (
                  order:
                    ShopOrder,
                ) =>
                  !seen.has(
                    order.id,
                  ),
              )

            return [
              ...current,
              ...additions,
            ]
          },
        )
      } else {
        setShopOrders(
          orders,
        )
      }

      setShopOrderPage({
        view,

        limit:
          Number(
            page.limit ||
              50,
          ),

        total:
          Number(
            page.total ||
              0,
          ),

        hasMore:
          page.hasMore ===
          true,

        nextCursor:
          Number.isInteger(
            Number(
              page.nextCursor,
            ),
          ) &&
          Number(
            page.nextCursor,
          ) > 0
            ? Number(
                page.nextCursor,
              )
            : null,
      })
    } catch (error) {
      setShopError(
        error instanceof Error
          ? error.message
          : 'Orders could not be loaded.',
      )
    } finally {
      if (append) {
        setShopOrdersLoadingMore(
          false,
        )
      } else {
        setShopLoading(
          false,
        )
      }
    }
  }

  async function switchShopOrderView(
    view: ShopOrderView,
  ) {
    setShopOrderView(
      view,
    )

    setShopOrderSearchDraft(
      '',
    )

    setShopOrderSearch(
      '',
    )

    setShopOrders(
      [],
    )

    await loadShopOrdersPage(
      view,
      '',
      null,
      false,
    )
  }

  async function applyShopOrderSearch() {
    const cleanSearch =
      shopOrderSearchDraft
        .trim()
        .slice(
          0,
          120,
        )

    setShopOrderSearch(
      cleanSearch,
    )

    await loadShopOrdersPage(
      shopOrderView,
      cleanSearch,
      null,
      false,
    )
  }

  async function clearShopOrderSearch() {
    setShopOrderSearchDraft(
      '',
    )

    setShopOrderSearch(
      '',
    )

    await loadShopOrdersPage(
      shopOrderView,
      '',
      null,
      false,
    )
  }

  async function loadMoreShopOrders() {
    if (
      !shopOrderPage.hasMore ||
      !shopOrderPage.nextCursor ||
      shopOrdersLoadingMore
    ) {
      return
    }

    await loadShopOrdersPage(
      shopOrderView,
      shopOrderSearch,
      shopOrderPage.nextCursor,
      true,
    )
  }

  async function loadShopData() {
    if (!API_CONFIGURED) {
      setShopError(
        'Backend API is not configured.',
      )

      return
    }

    try {
      setShopLoading(
        true,
      )

      setShopError('')

      const [
        productsResult,
        ordersResult,
      ] = await Promise.all([
        apiFetch(
          `${API}/maintenance/shop/products`,
        ),

        apiFetch(
          shopOrdersUrl(
            shopOrderView,
            shopOrderSearch,
            null,
          ),
        ),
      ])

      if (
        !productsResult.success
      ) {
        throw new Error(
          productsResult.message ||
            'Products could not be loaded.',
        )
      }

      if (
        !ordersResult.success
      ) {
        throw new Error(
          ordersResult.message ||
            'Orders could not be loaded.',
        )
      }

      const products =
        Array.isArray(
          productsResult.products,
        )
          ? productsResult.products
          : []

      const orders =
        Array.isArray(
          ordersResult.orders,
        )
          ? ordersResult.orders
          : []

      setShopProducts(
        products.map(
          (
            product:
              ShopProduct,
          ) => ({
            ...product,

            priceDraft:
              (
                Number(
                  product.priceCents ||
                    0,
                ) /
                100
              ).toFixed(
                2,
              ),

            inventoryDraft:
              String(
                Number(
                  product.inventory ||
                    0,
                ),
              ),
          }),
        ),
      )

      setShopOrders(
        orders,
      )

      const page =
        ordersResult.page &&
        typeof ordersResult.page ===
          'object'
          ? ordersResult.page
          : {}

      setShopOrderPage({
        view:
          shopOrderView,

        limit:
          Number(
            page.limit ||
              50,
          ),

        total:
          Number(
            page.total ||
              0,
          ),

        hasMore:
          page.hasMore ===
          true,

        nextCursor:
          Number.isInteger(
            Number(
              page.nextCursor,
            ),
          ) &&
          Number(
            page.nextCursor,
          ) > 0
            ? Number(
                page.nextCursor,
              )
            : null,
      })
    } catch (error) {
      setShopError(
        error instanceof Error
          ? error.message
          : 'Shop data could not be loaded.',
      )
    } finally {
      setShopLoading(
        false,
      )
    }
  }

  function updateShopProductLocal(
    id: number,
    patch: Partial<ShopProduct>,
  ) {
    setShopProducts(
      (current) =>
        current.map(
          (product) =>
            product.id === id
              ? {
                  ...product,
                  ...patch,
                }
              : product,
        ),
    )
  }

  async function createShopProduct() {
    const price =
      Number(
        newShopPrice,
      )

    const inventory =
      Number(
        newShopInventory,
      )

    if (
      !newShopName.trim()
    ) {
      pushToast(
        'error',
        'Enter a product name.',
      )
      return
    }

    if (
      !Number.isFinite(price) ||
      price < 0.5
    ) {
      pushToast(
        'error',
        'Enter a valid product price.',
      )
      return
    }

    if (
      !Number.isInteger(
        inventory,
      ) ||
      inventory < 0
    ) {
      pushToast(
        'error',
        'Enter valid inventory.',
      )
      return
    }

    try {
      setCreatingShopProduct(
        true,
      )

      const result =
        await apiFetch(
          `${API}/maintenance/shop/products`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                name:
                  newShopName.trim(),

                description:
                  newShopDescription.trim(),

                priceCents:
                  Math.round(
                    price * 100,
                  ),

                inventory,

                active: true,
              }),
          },
        )

      if (!result.success) {
        throw new Error(
          result.message ||
            'Product could not be created.',
        )
      }

      setNewShopName('')
      setNewShopDescription('')
      setNewShopPrice('')
      setNewShopInventory('')

      pushToast(
        'success',
        'Shop product created.',
      )

      await loadShopData()
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Product could not be created.',
      )
    } finally {
      setCreatingShopProduct(
        false,
      )
    }
  }

  async function saveShopProduct(
    product: ShopProduct,
  ) {
    const price =
      Number(
        product.priceDraft,
      )

    const inventory =
      Number(
        product.inventoryDraft,
      )

    if (
      !product.name.trim()
    ) {
      pushToast(
        'error',
        'Product name is required.',
      )
      return
    }

    if (
      !Number.isFinite(price) ||
      price < 0.5
    ) {
      pushToast(
        'error',
        'Product price is invalid.',
      )
      return
    }

    if (
      !Number.isInteger(
        inventory,
      ) ||
      inventory < 0
    ) {
      pushToast(
        'error',
        'Inventory is invalid.',
      )
      return
    }

    try {
      setShopProductBusyId(
        product.id,
      )

      const result =
        await apiFetch(
          `${API}/maintenance/shop/products/${product.id}`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                name:
                  product.name.trim(),

                description:
                  product.description,

                priceCents:
                  Math.round(
                    price * 100,
                  ),

                inventory,

                active:
                  product.active,
              }),
          },
        )

      if (!result.success) {
        throw new Error(
          result.message ||
            'Product could not be saved.',
        )
      }

      pushToast(
        'success',
        `${product.name} saved.`,
      )

      await loadShopData()
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Product could not be saved.',
      )
    } finally {
      setShopProductBusyId(
        null,
      )
    }
  }

  async function uploadShopProductImage(
    productId: number,
    file: File,
  ) {
    if (
      file.size >
      5 * 1024 * 1024
    ) {
      pushToast(
        'error',
        'Image must be 5 MB or smaller.',
      )
      return
    }

    const allowed =
      new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
      ])

    if (
      !allowed.has(
        file.type,
      )
    ) {
      pushToast(
        'error',
        'Use JPG, PNG or WebP.',
      )
      return
    }

    try {
      setShopProductBusyId(
        productId,
      )

      const token =
        window.localStorage.getItem(
          'caviarqr_maintenance_token',
        ) || ''

      const formData =
        new FormData()

      formData.append(
        'file',
        file,
      )

      const response =
        await fetch(
          `${API}/maintenance/shop/products/${productId}/image`,
          {
            method: 'POST',

            headers:
              token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : undefined,

            body:
              formData,
          },
        )

      const result =
        await response
          .json()
          .catch(
            () => ({}),
          )

      if (!response.ok) {
        throw new Error(
          result?.message ||
            'Image upload failed.',
        )
      }

      pushToast(
        'success',
        'Product image updated.',
      )

      await loadShopData()
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Image upload failed.',
      )
    } finally {
      setShopProductBusyId(
        null,
      )
    }
  }

  function updateShopOrderLocal(
    id: number,
    patch: Partial<ShopOrder>,
  ) {
    setShopOrders(
      (current) =>
        current.map(
          (order) =>
            order.id === id
              ? {
                  ...order,
                  ...patch,
                }
              : order,
        ),
    )
  }

  function openShopRefund(
    orderId: number,
  ) {
    setShopRefundOrderId(
      orderId,
    )

    setShopRefundReason(
      '',
    )

    setShopRefundConfirmed(
      false,
    )

    setShopError('')
  }

  function closeShopRefund() {
    if (
      shopRefundBusyId
    ) {
      return
    }

    setShopRefundOrderId(
      null,
    )

    setShopRefundReason(
      '',
    )

    setShopRefundConfirmed(
      false,
    )
  }

  async function refundShopOrder(
    order: ShopOrder,
  ) {
    const reason =
      shopRefundReason
        .trim()
        .slice(
          0,
          500,
        )

    if (
      reason.length < 3
    ) {
      setShopError(
        'Enter a refund reason.',
      )

      return
    }

    if (
      !shopRefundConfirmed
    ) {
      setShopError(
        'Confirm that you understand this sends a full refund.',
      )

      return
    }

    if (
      !window.confirm(
        `Refund the full ${shopMoney(
          order.totalCents,
        )} for ${order.orderNumber}? This sends a real Stripe refund.`,
      )
    ) {
      return
    }

    try {
      setShopRefundBusyId(
        order.id,
      )

      setShopError('')

      const result =
        await apiFetch(
          `${API}/maintenance/shop/orders/${order.id}/refund`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                reason,
              }),
          },
        )

      if (!result.success) {
        throw new Error(
          result.message ||
            'Hardware refund failed.',
        )
      }

      setShopRefundOrderId(
        null,
      )

      setShopRefundReason(
        '',
      )

      setShopRefundConfirmed(
        false,
      )

      /*
       * Refunded orders belong in
       * Past Orders. Refresh the
       * current operational view.
       */
      await loadShopOrdersPage(
        shopOrderView,
        shopOrderSearch,
        null,
        false,
      )
    } catch (error) {
      setShopError(
        error instanceof Error
          ? error.message
          : 'Hardware refund failed.',
      )
    } finally {
      setShopRefundBusyId(
        null,
      )
    }
  }

  async function saveShopFulfillment(
    order: ShopOrder,
  ) {
    try {
      setShopOrderBusyId(
        order.id,
      )

      const result =
        await apiFetch(
          `${API}/maintenance/shop/orders/${order.id}/fulfillment`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                fulfillmentStatus:
                  order.fulfillmentStatus,

                trackingNumber:
                  order.trackingNumber ||
                  '',
              }),
          },
        )

      if (!result.success) {
        throw new Error(
          result.message ||
            'Order could not be updated.',
        )
      }

      pushToast(
        'success',
        `${order.orderNumber} updated.`,
      )

      await loadShopOrdersPage(
        shopOrderView,
        shopOrderSearch,
        null,
        false,
      )
    } catch (error) {
      pushToast(
        'error',
        error instanceof Error
          ? error.message
          : 'Order could not be updated.',
      )
    } finally {
      setShopOrderBusyId(
        null,
      )
    }
  }

  function NavButton({
    id,
    icon,
    title,
    subtitle,
    count,
  }: {
    id: Tab
    icon: string
    title: string
    subtitle: string
    count?: number
  }) {
    const active = tab === id
    return (
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        className={`nav-btn ${active ? 'active' : ''}`}
        onClick={() => {
          setTab(id)
          setSelectedCafe(null)
          setSearch('')

          if (id === 'shop') {
            void loadShopData()
          }
        }}
      >
        <span className="nav-icon">
          <Icon path={icon} size={17} />
        </span>
        <span className="nav-copy">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        {typeof count === 'number' && count > 0 && <span className="nav-count">{count}</span>}
      </button>
    )
  }

  function StatCard({
    label,
    value,
    tone,
    icon,
    hint,
  }: {
    label: string
    value: string | number
    tone?: 'red' | 'green' | 'amber'
    icon: string
    hint?: string
  }) {
    return (
      <div className={`stat-card ${tone || ''}`}>
        <div className="stat-card-top">
          <div className="stat-icon">
            <Icon path={icon} size={17} />
          </div>
          <span className="stat-pulse" />
        </div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    )
  }

  function ActionButtons({ order }: { order: IssueOrder }) {
    const busy = actioningId === order.id

    if (order.hasSupport) {
      return (
        <div className="action-buttons">
          <button
            type="button"
            className="btn email"
            onClick={() =>
              void openSupport(order)
            }
          >
            <Icon path={ICONS.mail} size={15} />
            {Number(
              order.supportUnreadCount ||
                0,
            ) > 0
              ? `Chat (${order.supportUnreadCount})`
              : 'Open chat'}
          </button>

          <button
            type="button"
            className="btn refund"
            onClick={() => refundOrder(order)}
            disabled={
              busy ||
              order.status === 'REFUNDED'
            }
          >
            <Icon path={ICONS.rotate} size={15} />
            {order.status === 'REFUNDED'
              ? 'Refunded'
              : 'Refund'}
          </button>

          <button
            type="button"
            className="btn resolve"
            onClick={() => resolveOrder(order)}
            disabled={
              busy ||
              Boolean(order.issueResolved)
            }
          >
            <Icon path={ICONS.check} size={15} />
            {order.issueResolved
              ? 'Resolved'
              : 'Resolve'}
          </button>
        </div>
      )
    }

    return (
      <div className="action-buttons">
        <button
          type="button"
          className="btn refund"
          onClick={() => refundOrder(order)}
          disabled={busy || order.status === 'REFUNDED'}
        >
          <Icon path={ICONS.rotate} size={15} />
          {order.status === 'REFUNDED' ? 'Refunded' : 'Refund'}
        </button>
        <button
          type="button"
          className="btn email"
          onClick={() => openEmail(order)}
          disabled={!order.customerEmail}
        >
          <Icon path={ICONS.mail} size={15} />
          Email
        </button>
        <button
          type="button"
          className="btn resolve"
          onClick={() => resolveOrder(order)}
          disabled={busy || Boolean(order.issueResolved)}
        >
          <Icon path={ICONS.check} size={15} />
          {order.issueResolved ? 'Resolved' : 'Resolve'}
        </button>
      </div>
    )
  }

  function MatrixBox({
    label,
    value,
    sub,
    tone,
  }: {
    label: string
    value: string
    sub?: string
    tone?: 'red' | 'green' | 'amber'
  }) {
    return (
      <div className="matrix-box">
        <small>{label}</small>
        <strong
          className={
            tone === 'red'
              ? 'red'
              : tone === 'green'
              ? 'green'
              : tone === 'amber'
              ? 'amber'
              : ''
          }
        >
          {value}
        </strong>
        {sub && <span>{sub}</span>}
      </div>
    )
  }

  function OrderCard({ order }: { order: IssueOrder }) {
    const open = isOpenIssue(order)
    const critical = isCritical(order)
    const displayOrderId =
      getDisplayOrderId(order)

    const rail = open
      ? critical
        ? 'rail-critical'
        : 'rail-open'
      : order.status === 'REFUNDED'
      ? 'rail-refunded'
      : 'rail-resolved'

    const issueId =
      order.ownerActionId ||
      `ACT-${String(displayOrderId).padStart(6, '0')}`

    return (
      <article className={`order-card matrix-card ${rail}`}>
        <div className="order-content">
          <div className="order-top matrix-top">
            <div className="order-id-group">
              <span className="mono order-id">
                {order.storeCode || 'unknown'} · #{displayOrderId}
              </span>

              {order.hasSupport && (
                <span className="badge support">
                  Customer Help
                  {Number(
                    order.supportUnreadCount ||
                      0,
                  ) > 0
                    ? ` · ${order.supportUnreadCount} unread`
                    : ''}
                </span>
              )}

              {open && (
                <span
                  className={`badge needed ${
                    critical ? 'critical' : ''
                  }`}
                >
                  {critical ? 'Critical' : 'Needs action'}
                </span>
              )}

              {!open && (
                <span
                  className={`badge quiet ${
                    order.status === 'REFUNDED'
                      ? 'refunded'
                      : ''
                  }`}
                >
                  {order.status === 'REFUNDED'
                    ? 'Refunded'
                    : 'Resolved'}
                </span>
              )}

              <span className="badge quiet">
                {order.status}
              </span>
            </div>

            <span
              className="time"
              title={timeLabel(
                order.supportLastMessageAt ||
                  order.ownerActionCreatedAt ||
                  order.createdAt,
              )}
            >
              {relativeTime(
                order.supportLastMessageAt ||
                  order.ownerActionCreatedAt ||
                  order.createdAt,
              )}
            </span>
          </div>

          <p className="message matrix-message">
            {getIssueMessage(order)}
          </p>

          <div className="matrix-grid">
            <MatrixBox
              label="Customer"
              value={order.customerName || 'Unknown'}
              sub={order.customerEmail || 'No email on file'}
            />

            <MatrixBox
              label="Table"
              value={String(order.tableNumber ?? '—')}
              sub="Table number"
            />

            <MatrixBox
              label="Total"
              value={money(order.total)}
              sub={`Platform fee ${money(order.platformFee || 0)}`}
            />

            {order.hasSupport ? (
              <MatrixBox
                label="Support"
                value={
                  String(
                    order.supportStatus ||
                      'AWAITING_RESTAURANT',
                  ).replace(/_/g, ' ')
                }
                sub={`${Number(
                  order.supportUnreadCount ||
                    0,
                )} unread`}
                tone={
                  order.issueResolved
                    ? 'green'
                    : 'amber'
                }
              />
            ) : (
              <MatrixBox
                label="Kitchen"
                value={
                  order.kitchenAcknowledged ? 'Ack' : 'No ack'
                }
                sub={
                  order.kitchenAcknowledgedAt
                    ? timeLabel(order.kitchenAcknowledgedAt)
                    : 'No ACK time'
                }
                tone={
                  order.kitchenAcknowledged ? 'green' : 'amber'
                }
              />
            )}

            <MatrixBox
              label="Issue ID"
              value={issueId}
              sub={getIssueType(order)}
            />

            <MatrixBox
              label="Payment"
              value={
                order.stripePaymentIntentId
                  ? 'Stripe paid'
                  : 'Missing PI'
              }
              sub={
                order.stripePaymentIntentId ||
                'No payment intent'
              }
              tone={
                order.stripePaymentIntentId ? 'green' : 'red'
              }
            />

            <MatrixBox
              label="Created"
              value={timeLabel(order.createdAt)}
              sub="Order time"
            />

            <MatrixBox
              label="Resolution"
              value={
                order.issueResolved
                  ? 'Resolved'
                  : open
                  ? 'Open'
                  : 'No action'
              }
              sub={order.ownerActionResolvedBy || 'CaviarQR Ops'}
              tone={
                order.issueResolved
                  ? 'green'
                  : open
                  ? 'amber'
                  : undefined
              }
            />
          </div>

          {order.items && order.items.length > 0 && (
            <div className="items matrix-items">
              {order.items.map((item, index) => (
                <span key={index}>
                  {item.qty || 1}× {item.name || 'Item'}
                </span>
              ))}
            </div>
          )}

          <div className="stripe mono">
            {issueId}
            <span className="stripe-sep">·</span>
            {order.stripePaymentIntentId || 'no payment intent'}
          </div>
        </div>

        <ActionButtons order={order} />
      </article>
    )
  }



  function CafeOrderBox({ order }: { order: IssueOrder }) {
    const open = isOpenIssue(order)
    const critical = isCritical(order)
    const issueId =
      order.ownerActionId ||
      `ACT-${String(order.id).padStart(6, '0')}`

    return (
      <article
        className={`cafe-order-card ${
          critical
            ? 'cafe-critical'
            : open
            ? 'cafe-open'
            : order.status === 'REFUNDED'
            ? 'cafe-refunded'
            : 'cafe-resolved'
        }`}
      >
        <div className="cafe-order-main">
          <div className="cafe-order-head">
            <div>
              <div className="cafe-order-kicker">
                {order.storeCode || selectedCafe || 'cafe'} · Order #{order.id}
              </div>

              <h3>
                {order.customerName || 'Unknown customer'}
                <span>{money(order.total)}</span>
              </h3>
            </div>

            <div className="cafe-order-status-row">
              <span
                className={`badge ${
                  critical
                    ? 'needed critical'
                    : open
                    ? 'needed'
                    : order.status === 'REFUNDED'
                    ? 'quiet refunded'
                    : 'quiet'
                }`}
              >
                {critical
                  ? 'Critical'
                  : open
                  ? 'Needs action'
                  : order.status === 'REFUNDED'
                  ? 'Refunded'
                  : 'Resolved'}
              </span>

              <span className="badge quiet">{order.status}</span>
            </div>
          </div>

          <p className="cafe-order-message">
            {getIssueMessage(order)}
          </p>

          <div className="cafe-order-grid">
            <MatrixBox
              label="Order ID"
              value={`#${order.id}`}
              sub={issueId}
            />

            <MatrixBox
              label="Customer"
              value={order.customerName || 'Unknown'}
              sub={order.customerEmail || 'No email'}
            />

            <MatrixBox
              label="Table"
              value={String(order.tableNumber ?? '—')}
              sub="Restaurant table"
            />

            <MatrixBox
              label="Total"
              value={money(order.total)}
              sub={`Platform fee ${money(order.platformFee || 0)}`}
            />

            <MatrixBox
              label="Kitchen"
              value={order.kitchenAcknowledged ? 'Acknowledged' : 'No ACK'}
              sub={
                order.kitchenAcknowledgedAt
                  ? timeLabel(order.kitchenAcknowledgedAt)
                  : 'No kitchen ACK time'
              }
              tone={order.kitchenAcknowledged ? 'green' : 'amber'}
            />

            <MatrixBox
              label="Payment"
              value={
                order.stripePaymentIntentId
                  ? 'Stripe paid'
                  : 'Missing PI'
              }
              sub={order.stripePaymentIntentId || 'No payment intent'}
              tone={order.stripePaymentIntentId ? 'green' : 'red'}
            />

            <MatrixBox
              label="Created"
              value={timeLabel(order.createdAt)}
              sub={relativeTime(order.createdAt)}
            />

            <MatrixBox
              label="Resolution"
              value={
                order.issueResolved
                  ? 'Resolved'
                  : open
                  ? 'Open'
                  : 'No action'
              }
              sub={order.ownerActionResolvedBy || 'CaviarQR Ops'}
              tone={order.issueResolved ? 'green' : open ? 'amber' : undefined}
            />
          </div>

          <div className="cafe-items-box">
            <small>Items ordered</small>
            <div>
              {order.items?.length ? (
                order.items.map((item, index) => (
                  <span key={index}>
                    {item.qty || 1}× {item.name || 'Item'}
                  </span>
                ))
              ) : (
                <span>No items found</span>
              )}
            </div>
          </div>
        </div>

        <ActionButtons order={order} />
      </article>
    )
  }

  function CafeCard({ cafe }: { cafe: Cafe }) {
    const attention = cafe.openIssues > 0
    const critical = cafe.criticalIssues > 0

    return (
      <button
        type="button"
        className={`cafe-card ${critical ? 'critical' : attention ? 'warning' : 'healthy'}`}
        onClick={() => openCafe(cafe.storeCode)}
      >
        <span className="cafe-card-rail" />
        <div className="cafe-card-head">
          <div className="cafe-identity">
            <div className="cafe-avatar">{initials(cafe.cafeName)}</div>
            <div>
              <strong>{cafe.cafeName}</strong>
              <small className="mono">{cafe.storeCode}</small>
            </div>
          </div>
          <span className={`cafe-health ${critical ? 'critical' : attention ? 'warning' : 'healthy'}`}>
            <i />
            {critical ? 'Critical' : attention ? 'Attention' : 'Healthy'}
          </span>
        </div>
        <div className="cafe-card-grid">
          <div><small>Orders</small><strong>{cafe.orders}</strong></div>
          <div><small>Revenue</small><strong>{money(cafe.revenue)}</strong></div>
          <div><small>Alerts</small><strong className={attention ? 'red' : 'green'}>{cafe.openIssues}</strong></div>
        </div>
        <div className="cafe-card-foot">
          <span>Latest order <strong>{relativeTime(cafe.lastOrderAt)}</strong></span>
          <b>Open café →</b>
        </div>
      </button>
    )
  }

  const healthyCafes = cafes.filter((cafe) => cafe.openIssues === 0).length
  const cafesNeedingAttention = cafes.length - healthyCafes
  const totalCafeOrders = cafes.reduce((sum, cafe) => sum + cafe.orders, 0)
  const totalCafeRevenue = cafes.reduce((sum, cafe) => sum + cafe.revenue, 0)
  const selectedCafeRecord = selectedCafe
    ? cafes.find((cafe) => cafe.storeCode === selectedCafe)
    : undefined
  const selectedCafeOpenIssues = sortedCafeOrders.filter(isOpenIssue).length
  const selectedCafeCriticalIssues = sortedCafeOrders.filter(
    (order) => isOpenIssue(order) && isCritical(order),
  ).length
  const selectedCafeRevenue =
    selectedCafeFinancialOrders.reduce(
      (sum, order) => {
        const refundedAmount =
          order.status === 'REFUNDED' ||
          order.refundProcessed
            ? Number(
                order.refundAmount ??
                  order.total ??
                  0,
              )
            : 0

        return (
          sum +
          Number(order.total || 0) -
          refundedAmount
        )
      },
      0,
    )

  const filterOptions: { id: Filter; label: string }[] = [
    { id: 'OPEN', label: 'Open' },
    { id: 'CRITICAL', label: 'Critical' },
    { id: 'KITCHEN', label: 'Kitchen' },
    { id: 'PAYMENT', label: 'Payment' },
    { id: 'CUSTOMER', label: 'Customer Help' },
    { id: 'REFUNDED', label: 'Refunded' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'ALL', label: 'All' },
  ]

  const withdrawalAmountNumber =
    Number(withdrawAmount)

  const canWithdraw =
    Boolean(platformRevenue) &&
    !revenueLoading &&
    !withdrawing &&
    Number.isFinite(
      withdrawalAmountNumber,
    ) &&
    withdrawalAmountNumber > 0 &&
    withdrawalAmountNumber <=
      Number(
        platformRevenue?.withdrawable || 0,
      )

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">CQ</div>
          <div>
            <h1>CaviarQR</h1>
            <p>Operations Console</p>
          </div>
        </div>

        <div className="sidebar-label">Workspace</div>

        <nav>
          <NavButton id="action" icon={ICONS.inbox} title="Action Center" subtitle="Alerts across all cafés" count={openIssues.length} />
          <NavButton id="cafes" icon={ICONS.store} title="All Cafés" subtitle="Health & orders" />
          <NavButton id="qr" icon={ICONS.qr} title="QR Codes" subtitle="Table generator" />
          <NavButton id="shop" icon={ICONS.store} title="Shop" subtitle="Products & orders" />
        </nav>

        <div className="sidebar-stats">
          <div>
            <small>Open</small>
            <strong>{openIssues.length}</strong>
          </div>
          <div>
            <small>Critical</small>
            <strong className="red">{criticalIssues.length}</strong>
          </div>
        </div>

        <div className="system">
          <div>
            <span className={`dot ${backendOnline ? 'ok' : 'bad'}`} />
            <strong>{backendOnline ? 'All systems normal' : 'Connection issue'}</strong>
          </div>
          <p>
            {backendOnline
              ? lastUpdated
                ? `Synced ${relativeTime(lastUpdated.toISOString())}`
                : 'Monitoring all cafés.'
              : backendError}
          </p>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div className="header-title-group">
            <div className="header-eyebrow">
              <span className={`live-dot ${backendOnline ? 'online' : 'offline'}`} />
              {backendOnline ? 'Live operations' : 'Operations offline'}
            </div>
            <h2>
              {tab === 'action' && 'Action Center'}
              {tab === 'cafes' && (selectedCafeRecord?.cafeName || selectedCafe || 'All Cafés')}
              {tab === 'qr' && 'QR Codes & Tag URLs'}
              {tab === 'shop' && 'CaviarQR Shop'}
            </h2>
            <p>
              {tab === 'action' && 'Prioritize failed orders, kitchen exceptions, and customer recovery.'}
              {tab === 'cafes' && !selectedCafe && 'A real-time health view of every café in the CaviarQR network.'}
              {tab === 'cafes' && selectedCafe && 'Each order stays in its own card while live refresh continues.'}
              {tab === 'qr' && 'Generate production links for caviarqr.com and copy URLs for tag manufacturing.'}
              {tab === 'shop' && 'Manage CaviarQR hardware products, inventory, customer orders, and fulfillment.'}
            </p>
          </div>

          <div className="header-actions">
            {(tab === 'action' || (tab === 'cafes' && !selectedCafe)) && (
              <div className="search-wrap">
                <Icon path={ICONS.search} size={16} />
                <input
                  aria-label="Search maintenance records"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tab === 'action' ? 'Search order, café, customer...' : 'Search cafés...'}
                />
              </div>
            )}

            <label className="switch-label">
              <span
                className={`switch ${autoRefresh ? 'on' : ''}`}
                onClick={() => setAutoRefresh((v) => !v)}
                role="switch"
                aria-checked={autoRefresh}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setAutoRefresh((v) => !v)
                  }
                }}
              >
                <span className="switch-dot" />
              </span>
              Auto-refresh
            </label>

            <button
              className="refresh-btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <span className={refreshing ? 'spin' : ''}>
                <Icon path={ICONS.refresh} size={15} />
              </span>
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        {tab === 'action' && (
          <>
            <section className="ops-hero">
              <div>
                <span className="ops-kicker">Network command center</span>
                <h3>{criticalIssues.length > 0 ? `${criticalIssues.length} critical case${criticalIssues.length === 1 ? '' : 's'} need attention` : openIssues.length > 0 ? `${openIssues.length} open case${openIssues.length === 1 ? '' : 's'} are being monitored` : 'Every café is operating normally'}</h3>
                <p>Payment recovery, kitchen acknowledgements, and customer actions are grouped here so nothing is missed.</p>
              </div>
              <div className="ops-hero-side">
                <div className="hero-risk"><small>Customer value at risk</small><strong>{money(atRiskAmount)}</strong><span>{openIssues.length} open order{openIssues.length === 1 ? '' : 's'}</span></div>
                <div className="hero-status"><span className={`dot ${backendOnline ? 'ok' : 'bad'}`} /><div><small>System status</small><strong>{backendOnline ? 'Monitoring live' : 'Connection lost'}</strong></div></div>
              </div>
            </section>
            <section className="stats">
              <StatCard label="Open issues" value={openIssues.length} icon={ICONS.bell} hint="Waiting for owner action" />
              <StatCard label="Critical" value={criticalIssues.length} tone="red" icon={ICONS.alert} hint="Highest customer-impact risk" />
              <StatCard label="At risk" value={money(atRiskAmount)} tone="amber" icon={ICONS.wallet} hint="Paid value under review" />
              <StatCard label="Refunded" value={refundedOrders.length} tone="green" icon={ICONS.rotate} hint="Customer recovery completed" />
              <StatCard label="Net platform fees" value={money(netPlatformFees)} icon={ICONS.clipboardCheck} hint="Recorded after returned fees" />
            </section>

            <section className="revenue-panel">
              <div className="revenue-head">
                <div>
                  <span className="revenue-kicker">
                    Stripe platform revenue
                  </span>

                  <h3>
                    CaviarQR Stripe platform balance
                  </h3>

                  <p>
                    View settled revenue and withdraw
                    available funds to the CaviarQR
                    business bank account.
                  </p>
                </div>

                <button
                  type="button"
                  className="revenue-refresh"
                  onClick={() =>
                    void loadPlatformRevenue()
                  }
                  disabled={revenueLoading}
                >
                  <Icon
                    path={ICONS.refresh}
                    size={15}
                  />

                  {revenueLoading
                    ? 'Refreshing'
                    : 'Refresh Stripe balance'}
                </button>
              </div>

              <div className="revenue-metrics">
                <div>
                  <small>
                    Recorded net fees
                  </small>
                  <strong>
                    {money(
                      platformRevenue
                        ?.recordedNetFees ??
                        netPlatformFees,
                    )}
                  </strong>
                  <span>
                    From the CaviarQR database
                  </span>
                </div>

                <div>
                  <small>
                    Stripe available
                  </small>
                  <strong>
                    {revenueLoading
                      ? '…'
                      : money(
                          platformRevenue
                            ?.available,
                        )}
                  </strong>
                  <span>
                    Settled funds
                  </span>
                </div>

                <div>
                  <small>
                    Stripe pending
                  </small>
                  <strong>
                    {revenueLoading
                      ? '…'
                      : money(
                          platformRevenue
                            ?.pending,
                        )}
                  </strong>
                  <span>
                    Not available yet
                  </span>
                </div>

                <div>
                  <small>
                    Safety reserve
                  </small>
                  <strong>
                    {money(
                      platformRevenue?.reserve,
                    )}
                  </strong>
                  <span>
                    Held for refunds and disputes
                  </span>
                </div>

                <div className="withdrawable">
                  <small>
                    Available to withdraw
                  </small>
                  <strong>
                    {revenueLoading
                      ? '…'
                      : money(
                          platformRevenue
                            ?.withdrawable,
                        )}
                  </strong>
                  <span>
                    Maximum current payout
                  </span>
                </div>
              </div>

              <div className="revenue-body">
                <div className="withdraw-card">
                  <div className="withdraw-title">
                    <div>
                      <small>
                        New payout
                      </small>

                      <h4>
                        Withdraw processing fees
                      </h4>
                    </div>

                    <div className="withdraw-currency">
                      {String(
                        platformRevenue?.currency ||
                          'usd',
                      ).toUpperCase()}
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: 18,
                      padding: 16,
                      border:
                        '1px solid rgba(255,255,255,.12)',
                      borderRadius: 14,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      <strong>
                        Payout setup
                      </strong>

                      <span
                        style={{
                          fontSize: 13,
                          opacity: 0.72,
                          lineHeight: 1.5,
                        }}
                      >
                        Add or update the bank
                        account that receives
                        CaviarQR Stripe payouts.
                        Bank details are entered
                        securely in Stripe and are
                        not stored by CaviarQR.
                      </span>
                    </div>

                    <button
                      type="button"
                      className="withdraw-button"
                      onClick={() => {
                        window.open(
                          'https://dashboard.stripe.com/acct_1Sxh4AKZAB5HMPha/settings/payouts',
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }}
                    >
                      <span>
                        <strong>
                          Complete payout setup
                        </strong>

                        <small>
                          CaviarQR platform bank account only
                        </small>
                      </span>

                      <span aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  </div>

                  <label>
                    <span>
                      Withdrawal amount
                    </span>

                    <div className="amount-field">
                      <b>$</b>

                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        inputMode="decimal"
                        value={withdrawAmount}
                        onChange={(event) =>
                          setWithdrawAmount(
                            event.target.value,
                          )
                        }
                        placeholder="0.00"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setWithdrawAmount(
                            Number(
                              platformRevenue
                                ?.withdrawable || 0,
                            ).toFixed(2),
                          )
                        }
                      >
                        Max
                      </button>
                    </div>
                  </label>

                  <button
                    type="button"
                    className="withdraw-button"
                    onClick={
                      requestPlatformWithdrawal
                    }
                    disabled={!canWithdraw}
                  >
                    <span>
                      <strong>
                        {withdrawing
                          ? 'Creating Stripe payout…'
                          : 'Withdraw platform funds'}
                      </strong>

                      <small>
                        Send funds to CaviarQR bank
                      </small>
                    </span>

                    <span aria-hidden="true">
                      ↗
                    </span>
                  </button>

                  {revenueError && (
                    <p className="revenue-error">
                      {revenueError}
                    </p>
                  )}

                  <p className="withdraw-note">
                    This payout goes to the external
                    bank account configured on the
                    CaviarQR Stripe platform account.
                    Pay employees through the business
                    bank account or payroll provider.
                  </p>
                </div>

                <div className="payout-history">
                  <div className="payout-history-head">
                    <div>
                      <small>
                        Audit history
                      </small>

                      <h4>
                        Recent Stripe payouts
                      </h4>
                    </div>

                    <span>
                      {platformRevenue?.payouts
                        ?.length || 0}
                    </span>
                  </div>

                  <div className="payout-list">
                    {platformRevenue?.payouts
                      ?.length ? (
                      platformRevenue.payouts.map(
                        (payout) => (
                          <div
                            className="payout-row"
                            key={payout.id}
                          >
                            <div>
                              <strong>
                                {money(
                                  payout.amount,
                                )}
                              </strong>

                              <small className="mono">
                                {payout.stripePayoutId ||
                                  payout.id}
                              </small>
                            </div>

                            <div>
                              <b>
                                {payout.status}
                              </b>

                              <small>
                                {timeLabel(
                                  payout.createdAt,
                                )}
                              </small>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="payout-empty">
                        No platform payouts
                        have been created yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="queue-toolbar">
              <div><span className="section-kicker">Exception queue</span><h3>Orders requiring review</h3></div>
              <div className="filters">{filterOptions.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={filter === item.id ? 'active' : ''}>{item.label}</button>)}</div>
            </section>
            <section className="list">
              {loading ? <div className="skeleton-list">{[0,1,2,3].map((i) => <div className="skeleton-card" key={i} />)}</div> : filteredIssues.length === 0 ? (
                <div className="empty"><div className="empty-icon"><Icon path={ICONS.check} size={22} /></div><h3>All clear</h3><p>{search || filter !== 'OPEN' ? 'Nothing matches this view. Try another filter or clear your search.' : 'Nothing needs your attention right now.'}</p></div>
              ) : <>
                {groupedIssues.open.length > 0 && <><div className="lane-label"><span>Needs action</span><strong>{groupedIssues.open.length}</strong></div>{groupedIssues.open.map((order) => <OrderCard key={String(order.id)} order={order} />)}</>}
                {groupedIssues.other.length > 0 && <><div className="lane-label muted"><span>Completed or informational</span><strong>{groupedIssues.other.length}</strong></div>{groupedIssues.other.map((order) => <OrderCard key={String(order.id)} order={order} />)}</>}
              </>}
            </section>
          </>
        )}

        {tab === 'cafes' && (
          <>
            {!selectedCafe ? <>
              <section className="network-summary">
                <div><span className="section-kicker">Café network</span><h3>{cafes.length} connected location{cafes.length === 1 ? '' : 's'}</h3><p>Open a café to see every order, payment state, kitchen acknowledgement, and resolution in separate cards.</p></div>
                <div className="network-summary-grid">
                  <div><small>Healthy</small><strong className="green">{healthyCafes}</strong></div><div><small>Need attention</small><strong className={cafesNeedingAttention > 0 ? 'red' : ''}>{cafesNeedingAttention}</strong></div><div><small>Total orders</small><strong>{totalCafeOrders}</strong></div><div><small>Loaded revenue</small><strong>{money(totalCafeRevenue)}</strong></div>
                </div>
              </section>
              {filteredCafes.length === 0 ? <div className="empty"><div className="empty-icon"><Icon path={ICONS.store} size={22} /></div><h3>No cafés found</h3><p>No cafés match “{search}”.</p></div> : <section className="cafe-grid">{filteredCafes.map((cafe) => <CafeCard key={cafe.storeCode} cafe={cafe} />)}</section>}
            </> : <>
              <button className="back" onClick={() => setSelectedCafe(null)}><Icon path={ICONS.chevronLeft} size={15} />Back to all cafés</button>
              <section className="selected-cafe-hero">
                <div className="selected-cafe-identity"><div className="selected-cafe-avatar">{initials(selectedCafeRecord?.cafeName || selectedCafe)}</div><div><span className="section-kicker">Selected café</span><h3>{selectedCafeRecord?.cafeName || selectedCafe}</h3><p className="mono">{selectedCafe}</p></div></div>
                <div className="selected-cafe-health"><span className={`cafe-health ${selectedCafeCriticalIssues > 0 ? 'critical' : selectedCafeOpenIssues > 0 ? 'warning' : 'healthy'}`}><i />{selectedCafeCriticalIssues > 0 ? 'Critical attention' : selectedCafeOpenIssues > 0 ? 'Review needed' : 'Operating normally'}</span><small>{autoRefresh ? 'Live refresh stays on this café' : 'Auto-refresh is paused'}</small></div>
              </section>
              <div className="cafe-detail-top"><div><small>Orders shown</small><strong>{sortedCafeOrders.length}</strong><span>Each card is one order</span></div><div><small>Open issues</small><strong className={selectedCafeOpenIssues > 0 ? 'red' : 'green'}>{selectedCafeOpenIssues}</strong><span>{selectedCafeCriticalIssues} critical</span></div><div><small>Order value</small><strong>{money(selectedCafeRevenue)}</strong><span>Across loaded records</span></div><div><small>Latest order</small><strong>{relativeTime(selectedCafeRecord?.lastOrderAt)}</strong><span>{autoRefresh ? 'Updating every 20 seconds' : 'Refresh paused'}</span></div></div>
              <section className="processing-fee-card">
                <div className="processing-fee-copy">
                  <span className="section-kicker">Billing</span>
                  <h3>CaviarQR processing fee</h3>
                  <p>Set the processing fee for this café only. New cafés default to 4.75%.</p>
                </div>

                <div className="processing-fee-control">
                  <label htmlFor="selected-cafe-processing-fee">
                    Processing fee %
                  </label>
                  <div className="processing-fee-actions">
                    <div className="processing-fee-input">
                      <input
                        id="selected-cafe-processing-fee"
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        inputMode="decimal"
                        value={selectedCafeProcessingFee}
                        onChange={(event) =>
                          setSelectedCafeProcessingFee(
                            event.target.value,
                          )
                        }
                        disabled={processingFeeSaving}
                        aria-label={`Processing fee for ${selectedCafe}`}
                      />
                      <span>%</span>
                    </div>

                    <button
                      type="button"
                      className="processing-fee-save"
                      onClick={() => void saveProcessingFee()}
                      disabled={
                        processingFeeSaving ||
                        selectedCafeProcessingFee.trim() === ''
                      }
                    >
                      {processingFeeSaving ? 'Saving…' : 'Save fee'}
                    </button>
                  </div>
                </div>
              </section>

              <section className="processing-fee-card">
                <div className="processing-fee-copy">
                  <span className="section-kicker">
                    Marketing access
                  </span>

                  <h3>
                    Email marketing
                  </h3>

                  <p>
                    Control whether this café can collect marketing subscribers and send promotional emails through CaviarQR. Turning this off does not delete existing subscriber or campaign history.
                  </p>
                </div>

                <div className="processing-fee-control">
                  <label>
                    Email marketing access
                  </label>

                  <div className="processing-fee-actions">
                    <strong>
                      {selectedCafeEmailMarketingEnabled === null
                        ? 'Unknown'
                        : selectedCafeEmailMarketingEnabled
                          ? 'ON'
                          : 'OFF'}
                    </strong>

                    <button
                      type="button"
                      className="processing-fee-save"
                      disabled={
                        emailMarketingSaving ||
                        selectedCafeEmailMarketingEnabled === null
                      }
                      onClick={() =>
                        void setEmailMarketingEnabled(
                          !selectedCafeEmailMarketingEnabled,
                        )
                      }
                    >
                      {emailMarketingSaving
                        ? 'Saving…'
                        : selectedCafeEmailMarketingEnabled
                          ? 'Turn off'
                          : 'Turn on'}
                    </button>
                  </div>
                </div>
              </section>

              <div className="cafe-orders-heading"><div><span className="section-kicker">Order timeline</span><h3>All orders for this café</h3></div><span className="order-count-chip">{sortedCafeOrders.length} orders</span></div>
              <section className="cafe-order-list">{sortedCafeOrders.length === 0 ? <div className="empty"><div className="empty-icon"><Icon path={ICONS.inbox} size={22} /></div><h3>No orders yet</h3><p>This café has no orders on record.</p></div> : sortedCafeOrders.map((order) => <CafeOrderBox key={String(order.id)} order={order} />)}</section>
            </>}
          </>
        )}

        {tab === 'qr' && (
          <section className="qr-section">
            <div className="qr-form">
              <div className="field">
                <label>Store code</label>
                <input
                  value={qrStoreCode}
                  onChange={(e) => setQrStoreCode(e.target.value)}
                  placeholder="cafe1"
                />
              </div>

              <div className="field narrow">
                <label>Tables</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={qrTableCount}
                  onChange={(e) => setQrTableCount(Number(e.target.value))}
                />
              </div>

              <button
                className="generate-btn"
                onClick={generateQrCodes}
                disabled={!qrStoreCode.trim() || generatingQr}
              >
                {generatingQr ? (
                  <>
                    <span className="spin">
                      <Icon path={ICONS.refresh} size={15} />
                    </span>
                    Generating
                  </>
                ) : (
                  <>
                    <Icon path={ICONS.qr} size={15} />
                    Create stand set
                  </>
                )}
              </button>

              {tableLinks.length > 0 && (
                <>
                  <button className="secondary" onClick={exportQrPdf}>
                    <Icon path={ICONS.download} size={15} />
                    Export PDF
                  </button>

                  <button className="secondary" onClick={downloadVendorCsv}>
                    <Icon path={ICONS.download} size={15} />
                    Download CSV
                  </button>
                </>
              )}
            </div>

            {standStatus && (
              <div
                className="domain-box"
                style={{
                  marginBottom: 18,
                }}
              >
                <small>
                  {standRegistered
                    ? 'Registered restaurant'
                    : 'Permanent stand allocation'}
                </small>

                <strong
                  style={{
                    display: 'block',
                    marginTop: 6,
                  }}
                >
                  {qrStoreCode} ·{' '}
                  {standRegistered
                    ? 'REGISTERED'
                    : standStatus}
                </strong>

                {standAlreadyExists &&
                  !standRegistered && (
                  <p
                    style={{
                      marginTop: 14,
                    }}
                  >
                    Existing permanent stand
                    allocation loaded.
                  </p>
                )}

                {!standRegistered &&
                  standStatus ===
                    'UNCLAIMED' && (
                  <p
                    style={{
                      marginTop: 14,
                      fontWeight: 700,
                    }}
                  >
                    Ready for buyer registration.
                  </p>
                )}

                {standRegistered && (
                  <p
                    style={{
                      marginTop: 14,
                      fontWeight: 700,
                    }}
                  >
                    ✓ Restaurant account already
                    registered.
                  </p>
                )}

                {!standRegistered &&
                  standStatus ===
                    'CLAIMED' && (
                  <p
                    style={{
                      marginTop: 14,
                      fontWeight: 700,
                    }}
                  >
                    ✓ Already claimed by a
                    restaurant.
                  </p>
                )}
              </div>
            )}

            <div className="domain-box">
              <small>Production URL format</small>
              <strong className="mono">
                {cleanBaseUrl(QR_BASE_URL)}/store/{qrStoreCode || 'cafe1'}?table=1
              </strong>
              <p>
                QR and NFC tags will now use your real domain, not localhost.
              </p>
            </div>

            {tableLinks.length > 0 && (
              <div className="vendor-box">
                <div className="vendor-head">
                  <div>
                    <h3>URL list for China tag manufacturer</h3>
                    <p>
                      Send this list for QR/NFC table tag production. NFC should use the exact same URL as the QR.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="copy-all"
                    onClick={() => copyText(vendorUrls, 'all-urls')}
                  >
                    {copied === 'all-urls' ? 'Copied' : 'Copy all URLs'}
                  </button>
                </div>

                <textarea readOnly value={vendorUrls} />

                <div className="tag-specs">
                  <div>
                    <small>Recommended tag size</small>
                    <strong>50mm × 50mm</strong>
                  </div>
                  <div>
                    <small>Material</small>
                    <strong>Waterproof PVC / acrylic</strong>
                  </div>
                  <div>
                    <small>NFC encoding</small>
                    <strong>Same URL as QR</strong>
                  </div>
                </div>
              </div>
            )}

            {tableLinks.length === 0 && !generatingQr ? (
              <div className="qr-empty">
                <div className="empty-icon">
                  <Icon path={ICONS.qr} size={22} />
                </div>
                <h3>No codes generated yet</h3>
                <p>
                  Enter a store code and table count, then generate production QR codes for every table.
                </p>
              </div>
            ) : (
              <div className="qr-grid">
                {tableLinks.map((item) => (
                  <div className="qr-card" key={item.table}>
                    <img src={item.qrDataUrl} alt={`QR code for table ${item.table}`} />
                    <strong>Table {item.table}</strong>
                    <span className="mono">{item.link}</span>

                    <div className="qr-card-actions">
                      <button
                        type="button"
                        onClick={() => copyLink(item.link)}
                        aria-label={`Copy link for table ${item.table}`}
                      >
                        <Icon path={ICONS.copy} size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadQr(item)}
                        aria-label={`Download QR code for table ${item.table}`}
                      >
                        <Icon path={ICONS.download} size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === 'shop' && (
          <section className="shop-admin">
            <style>{`
              .shop-admin {
                display: flex;
                flex-direction: column;
                gap: 24px;
              }

              .shop-admin-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 20px 22px;
                background: #fff;
                border: 1px solid #e6e6e6;
                border-radius: 16px;
              }

              .shop-admin-toolbar h3 {
                margin: 0 0 5px;
                font-size: 1.05rem;
              }

              .shop-admin-toolbar p {
                margin: 0;
                color: #747474;
                font-size: .82rem;
              }

              .shop-refresh {
                border: 1px solid #d8d8d8;
                background: #fff;
                border-radius: 9px;
                padding: 9px 14px;
                cursor: pointer;
                font-weight: 700;
              }

              .shop-error {
                padding: 14px 16px;
                color: #a02f2f;
                background: #fff3f3;
                border: 1px solid #f0d5d5;
                border-radius: 10px;
              }

              .shop-panel {
                background: #fff;
                border: 1px solid #e6e6e6;
                border-radius: 16px;
                overflow: hidden;
              }

              .shop-panel-head {
                padding: 20px 22px;
                border-bottom: 1px solid #ededed;
              }

              .shop-panel-head h3 {
                margin: 0 0 5px;
              }

              .shop-panel-head p {
                margin: 0;
                color: #777;
                font-size: .82rem;
              }

              .shop-create {
                display: grid;
                grid-template-columns:
                  minmax(180px, 1.3fr)
                  minmax(240px, 2fr)
                  130px
                  130px
                  120px;
                gap: 12px;
                padding: 20px 22px;
                align-items: end;
              }

              .shop-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
              }

              .shop-field span {
                color: #6e6e6e;
                font-size: .72rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .05em;
              }

              .shop-field input,
              .shop-field textarea,
              .shop-field select {
                width: 100%;
                min-height: 40px;
                padding: 9px 10px;
                border: 1px solid #d9d9d9;
                border-radius: 8px;
                background: #fff;
                color: #222;
              }

              .shop-field textarea {
                resize: vertical;
                min-height: 72px;
              }

              .shop-primary {
                min-height: 40px;
                border: 0;
                border-radius: 8px;
                background: #171717;
                color: #fff;
                font-weight: 750;
                cursor: pointer;
              }

              .shop-primary:disabled {
                opacity: .45;
                cursor: not-allowed;
              }

              .shop-products-list {
                display: grid;
                grid-template-columns:
                  repeat(
                    2,
                    minmax(0, 1fr)
                  );
                gap: 16px;
                padding: 0 22px 22px;
              }

              .shop-product-card {
                display: grid;
                grid-template-columns:
                  145px
                  minmax(0, 1fr);
                gap: 18px;
                padding: 16px;
                border: 1px solid #e8e8e8;
                border-radius: 14px;
              }

              .shop-product-image {
                display: flex;
                flex-direction: column;
                gap: 10px;
              }

              .shop-product-image-preview {
                display: flex;
                align-items: center;
                justify-content: center;
                aspect-ratio: 1;
                overflow: hidden;
                border-radius: 10px;
                background: #f4f3ef;
                color: #8b7355;
                font-family: Georgia, serif;
              }

              .shop-product-image-preview img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }

              .shop-product-image input {
                width: 100%;
                font-size: .72rem;
              }

              .shop-product-fields {
                display: flex;
                flex-direction: column;
                gap: 10px;
              }

              .shop-inline {
                display: grid;
                grid-template-columns:
                  1fr
                  1fr;
                gap: 10px;
              }

              .shop-active-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                font-size: .8rem;
              }

              .shop-active-row label {
                display: flex;
                align-items: center;
                gap: 7px;
              }

              .shop-order-list {
                display: flex;
                flex-direction: column;
              }

              .shop-order-card {
                padding: 20px 22px;
                border-bottom: 1px solid #ededed;
              }

              .shop-order-card:last-child {
                border-bottom: 0;
              }

              .shop-order-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 16px;
              }

              .shop-order-top h4 {
                margin: 0 0 5px;
                font-size: 1rem;
              }

              .shop-order-top p {
                margin: 0;
                color: #757575;
                font-size: .8rem;
              }

              .shop-order-total {
                font-size: 1rem;
                font-weight: 800;
              }

              .shop-badges {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin-bottom: 14px;
              }

              .shop-badge {
                padding: 5px 8px;
                border-radius: 999px;
                background: #f1f1ef;
                font-size: .7rem;
                font-weight: 750;
              }

              .shop-badge.paid {
                background: #eaf6ec;
                color: #286336;
              }

              .shop-order-info {
                display: grid;
                grid-template-columns:
                  repeat(
                    3,
                    minmax(0, 1fr)
                  );
                gap: 14px;
                margin-bottom: 16px;
              }

              .shop-order-info div {
                min-width: 0;
              }

              .shop-order-info small {
                display: block;
                margin-bottom: 4px;
                color: #888;
              }

              .shop-order-info strong,
              .shop-order-info span {
                display: block;
                overflow-wrap: anywhere;
                font-size: .8rem;
              }

              .shop-order-items {
                padding: 12px;
                margin-bottom: 16px;
                background: #f8f8f6;
                border-radius: 9px;
              }

              .shop-order-item {
                display: flex;
                justify-content: space-between;
                gap: 14px;
                padding: 4px 0;
                font-size: .8rem;
              }

              .shop-fulfillment {
                display: grid;
                grid-template-columns:
                  180px
                  minmax(180px, 1fr)
                  130px;
                gap: 10px;
                align-items: end;
              }

              .shop-empty {
                padding: 32px 22px;
                color: #777;
                text-align: center;
              }

              @media (max-width: 1150px) {
                .shop-create {
                  grid-template-columns:
                    1fr
                    1fr;
                }

                .shop-products-list {
                  grid-template-columns:
                    1fr;
                }
              }

              @media (max-width: 760px) {
                .shop-create,
                .shop-inline,
                .shop-order-info,
                .shop-fulfillment {
                  grid-template-columns:
                    1fr;
                }

                .shop-product-card {
                  grid-template-columns:
                    1fr;
                }

                .shop-product-image {
                  max-width: 220px;
                }

                .shop-order-top {
                  flex-direction: column;
                }
              }
            `}</style>

            <div className="shop-admin-toolbar">
              <div>
                <h3>
                  Hardware Store
                </h3>

                <p>
                  Products sold at
                  caviarqr.com/shop.
                </p>
              </div>

              <button
                type="button"
                className="shop-refresh"
                onClick={() =>
                  void loadShopData()
                }
                disabled={shopLoading}
              >
                {shopLoading
                  ? 'Loading…'
                  : 'Refresh shop'}
              </button>
            </div>

            {shopError && (
              <div className="shop-error">
                {shopError}
              </div>
            )}

            <div className="shop-panel">
              <div className="shop-panel-head">
                <h3>
                  Products
                </h3>

                <p>
                  Add stands, upload
                  photos, set price,
                  inventory, and
                  storefront visibility.
                </p>
              </div>

              <div className="shop-create">
                <label className="shop-field">
                  <span>
                    Product name
                  </span>

                  <input
                    value={newShopName}
                    maxLength={140}
                    placeholder="CaviarQR Table Stand"
                    onChange={(e) =>
                      setNewShopName(
                        e.target.value,
                      )
                    }
                  />
                </label>

                <label className="shop-field">
                  <span>
                    Description
                  </span>

                  <input
                    value={
                      newShopDescription
                    }
                    placeholder="Wooden QR/NFC table stand"
                    onChange={(e) =>
                      setNewShopDescription(
                        e.target.value,
                      )
                    }
                  />
                </label>

                <label className="shop-field">
                  <span>
                    Price USD
                  </span>

                  <input
                    type="number"
                    min="0.50"
                    step="0.01"
                    value={newShopPrice}
                    placeholder="24.99"
                    onChange={(e) =>
                      setNewShopPrice(
                        e.target.value,
                      )
                    }
                  />
                </label>

                <label className="shop-field">
                  <span>
                    Inventory
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      newShopInventory
                    }
                    placeholder="100"
                    onChange={(e) =>
                      setNewShopInventory(
                        e.target.value,
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  className="shop-primary"
                  disabled={
                    creatingShopProduct
                  }
                  onClick={() =>
                    void createShopProduct()
                  }
                >
                  {creatingShopProduct
                    ? 'Creating…'
                    : 'Add product'}
                </button>
              </div>

              {shopProducts.length ===
              0 ? (
                <div className="shop-empty">
                  {shopLoading
                    ? 'Loading products…'
                    : 'No shop products yet.'}
                </div>
              ) : (
                <div className="shop-products-list">
                  {shopProducts.map(
                    (product) => (
                      <div
                        className="shop-product-card"
                        key={product.id}
                      >
                        <div className="shop-product-image">
                          <div className="shop-product-image-preview">
                            {product.imageUrl ? (
                              <img
                                src={shopImageUrl(
                                  product.imageUrl,
                                )}
                                alt={
                                  product.name
                                }
                              />
                            ) : (
                              <span>
                                CaviarQR
                              </span>
                            )}
                          </div>

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={
                              shopProductBusyId ===
                              product.id
                            }
                            onChange={(e) => {
                              const file =
                                e.target
                                  .files?.[0]

                              if (file) {
                                void uploadShopProductImage(
                                  product.id,
                                  file,
                                )
                              }

                              e.target.value =
                                ''
                            }}
                          />
                        </div>

                        <div className="shop-product-fields">
                          <label className="shop-field">
                            <span>
                              Name
                            </span>

                            <input
                              value={
                                product.name
                              }
                              maxLength={
                                140
                              }
                              onChange={(e) =>
                                updateShopProductLocal(
                                  product.id,
                                  {
                                    name:
                                      e
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />
                          </label>

                          <label className="shop-field">
                            <span>
                              Description
                            </span>

                            <textarea
                              value={
                                product.description
                              }
                              onChange={(e) =>
                                updateShopProductLocal(
                                  product.id,
                                  {
                                    description:
                                      e
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />
                          </label>

                          <div className="shop-inline">
                            <label className="shop-field">
                              <span>
                                Price USD
                              </span>

                              <input
                                type="number"
                                min="0.50"
                                step="0.01"
                                value={
                                  product.priceDraft ??
                                  ''
                                }
                                onChange={(e) =>
                                  updateShopProductLocal(
                                    product.id,
                                    {
                                      priceDraft:
                                        e
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>

                            <label className="shop-field">
                              <span>
                                Inventory
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  product.inventoryDraft ??
                                  ''
                                }
                                onChange={(e) =>
                                  updateShopProductLocal(
                                    product.id,
                                    {
                                      inventoryDraft:
                                        e
                                          .target
                                          .value,
                                    },
                                  )
                                }
                              />
                            </label>
                          </div>

                          <div className="shop-active-row">
                            <label>
                              <input
                                type="checkbox"
                                checked={
                                  product.active
                                }
                                onChange={(e) =>
                                  updateShopProductLocal(
                                    product.id,
                                    {
                                      active:
                                        e
                                          .target
                                          .checked,
                                    },
                                  )
                                }
                              />

                              Visible in shop
                            </label>

                            <span>
                              ID #{product.id}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="shop-primary"
                            disabled={
                              shopProductBusyId ===
                              product.id
                            }
                            onClick={() =>
                              void saveShopProduct(
                                product,
                              )
                            }
                          >
                            {shopProductBusyId ===
                            product.id
                              ? 'Saving…'
                              : 'Save product'}
                          </button>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="shop-panel">
              <div className="shop-panel-head">
                <h3>
                  Hardware Orders
                </h3>

                <p>
                  {shopOrderView ===
                  'active'
                    ? 'Paid orders that still need to be processed, shipped, or delivered.'
                    : 'Delivered hardware orders are kept here as your permanent order history.'}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems:
                    'center',
                  marginBottom: 14,
                }}
              >
                <button
                  type="button"
                  className={
                    shopOrderView ===
                    'active'
                      ? 'shop-primary'
                      : 'shop-refresh'
                  }
                  onClick={() =>
                    void switchShopOrderView(
                      'active',
                    )
                  }
                  disabled={
                    shopLoading
                  }
                >
                  Active Orders
                </button>

                <button
                  type="button"
                  className={
                    shopOrderView ===
                    'past'
                      ? 'shop-primary'
                      : 'shop-refresh'
                  }
                  onClick={() =>
                    void switchShopOrderView(
                      'past',
                    )
                  }
                  disabled={
                    shopLoading
                  }
                >
                  Past Orders
                </button>

                <span
                  style={{
                    marginLeft:
                      'auto',
                    fontSize: 13,
                    opacity: 0.7,
                  }}
                >
                  {shopOrderPage.total}{' '}
                  {shopOrderPage.total ===
                  1
                    ? 'order'
                    : 'orders'}
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()

                  void applyShopOrderSearch()
                }}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems:
                    'center',
                  marginBottom: 16,
                }}
              >
                <input
                  value={
                    shopOrderSearchDraft
                  }
                  maxLength={120}
                  placeholder="Search order #, customer, email, tracking…"
                  onChange={(e) =>
                    setShopOrderSearchDraft(
                      e.target.value,
                    )
                  }
                  style={{
                    flex: '1 1 260px',
                    minWidth: 0,
                  }}
                />

                <button
                  type="submit"
                  className="shop-refresh"
                  disabled={
                    shopLoading
                  }
                >
                  Search
                </button>

                {shopOrderSearch && (
                  <button
                    type="button"
                    className="shop-refresh"
                    disabled={
                      shopLoading
                    }
                    onClick={() =>
                      void clearShopOrderSearch()
                    }
                  >
                    Clear
                  </button>
                )}

                {shopOrderPage.hasMore && (
                  <button
                    type="button"
                    className="shop-refresh"
                    disabled={
                      shopOrdersLoadingMore
                    }
                    onClick={() =>
                      void loadMoreShopOrders()
                    }
                  >
                    {shopOrdersLoadingMore
                      ? 'Loading…'
                      : 'Load 50 more'}
                  </button>
                )}
              </form>

              {shopOrders.length ===
              0 ? (
                <div className="shop-empty">
                  {shopLoading
                    ? 'Loading orders…'
                    : shopOrderSearch
                      ? 'No orders match this search.'
                      : shopOrderView ===
                          'past'
                        ? 'No delivered orders yet.'
                        : 'No active hardware orders.'}
                </div>
              ) : (
                <div className="shop-order-list">
                  {shopOrders.map(
                    (order) => (
                      <div
                        className="shop-order-card"
                        key={order.id}
                      >
                        <div className="shop-order-top">
                          <div>
                            <h4>
                              {
                                order.orderNumber
                              }
                            </h4>

                            <p>
                              {timeLabel(
                                order.createdAt,
                              )}
                            </p>
                          </div>

                          <div className="shop-order-total">
                            {shopMoney(
                              order.totalCents,
                            )}
                          </div>
                        </div>

                        <div className="shop-badges">
                          <span
                            className={`shop-badge ${
                              order.paymentStatus ===
                              'PAID'
                                ? 'paid'
                                : ''
                            }`}
                          >
                            Payment ·{' '}
                            {
                              order.paymentStatus
                            }
                          </span>

                          <span className="shop-badge">
                            Fulfillment ·{' '}
                            {
                              order.fulfillmentStatus
                            }
                          </span>

                          {order.confirmationEmailSentAt ? (
                            <span className="shop-badge paid">
                              Confirmation email · Sent
                            </span>
                          ) : order.confirmationEmailFailureMessage ? (
                            <span className="shop-badge">
                              Confirmation email · Issue
                            </span>
                          ) : (
                            <span className="shop-badge">
                              Confirmation email · Pending
                            </span>
                          )}

                          {order.refundStatus &&
                          order.refundStatus !==
                            'NONE' && (
                            <span
                              className={
                                order.refundStatus ===
                                'SUCCEEDED'
                                  ? 'shop-badge paid'
                                  : 'shop-badge'
                              }
                            >
                              Refund ·{' '}
                              {
                                order.refundStatus
                              }
                            </span>
                          )}
                        </div>

                        <div className="shop-order-info">
                          <div>
                            <small>
                              Customer
                            </small>

                            <strong>
                              {order.customerName ||
                                '—'}
                            </strong>
                          </div>

                          <div>
                            <small>
                              Email / phone
                            </small>

                            <span>
                              {order.email ||
                                '—'}
                            </span>

                            <span>
                              {order.phone ||
                                '—'}
                            </span>
                          </div>

                          <div>
                            <small>
                              Shipping address
                            </small>

                            <span>
                              {shopAddressLabel(
                                order.shippingAddress,
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="shop-order-items">
                          {order.items?.map(
                            (item) => (
                              <div
                                className="shop-order-item"
                                key={item.id}
                              >
                                <span>
                                  {
                                    item.productName
                                  }{' '}
                                  ×{' '}
                                  {
                                    item.quantity
                                  }
                                </span>

                                <strong>
                                  {shopMoney(
                                    item.unitPriceCents *
                                      item.quantity,
                                  )}
                                </strong>
                              </div>
                            ),
                          )}
                        </div>

                        <div className="shop-fulfillment">
                          <label className="shop-field">
                            <span>
                              Status
                            </span>

                            <select
                              disabled={
                                [
                                  'SUCCEEDED',
                                  'PENDING',
                                  'CREATING',
                                ].includes(
                                  order.refundStatus ||
                                    '',
                                )
                              }
                              value={
                                order.fulfillmentStatus
                              }
                              onChange={(e) =>
                                updateShopOrderLocal(
                                  order.id,
                                  {
                                    fulfillmentStatus:
                                      e
                                        .target
                                        .value,
                                  },
                                )
                              }
                            >
                              <option value="UNFULFILLED">
                                Unfulfilled
                              </option>

                              <option value="PROCESSING">
                                Processing
                              </option>

                              <option value="SHIPPED">
                                Shipped
                              </option>

                              <option value="DELIVERED">
                                Delivered
                              </option>
                            </select>
                          </label>

                          <label className="shop-field">
                            <span>
                              Tracking number
                            </span>

                            <input
                              value={
                                order.trackingNumber ||
                                ''
                              }
                              maxLength={
                                120
                              }
                              placeholder="Optional"
                              onChange={(e) =>
                                updateShopOrderLocal(
                                  order.id,
                                  {
                                    trackingNumber:
                                      e
                                        .target
                                        .value,
                                  },
                                )
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="shop-primary"
                            disabled={
                              shopOrderBusyId ===
                              order.id
                            }
                            onClick={() =>
                              void saveShopFulfillment(
                                order,
                              )
                            }
                          >
                            {shopOrderBusyId ===
                            order.id
                              ? 'Saving…'
                              : 'Save'}
                          </button>
                        </div>


                        {order.refundStatus &&
                        order.refundStatus !==
                          'NONE' && (
                          <div
                            style={{
                              marginTop: 14,
                              padding: 14,
                              border:
                                '1px solid rgba(0,0,0,.12)',
                              borderRadius: 12,
                            }}
                          >
                            <strong>
                              Refund
                            </strong>

                            <div
                              style={{
                                display:
                                  'grid',
                                gap: 5,
                                marginTop: 8,
                                fontSize: 13,
                              }}
                            >
                              <span>
                                Status:{' '}
                                {
                                  order.refundStatus
                                }
                              </span>

                              {order.refundAmountCents !=
                                null && (
                                <span>
                                  Amount:{' '}
                                  {shopMoney(
                                    order.refundAmountCents,
                                  )}
                                </span>
                              )}

                              {order.refundReason && (
                                <span>
                                  Reason:{' '}
                                  {
                                    order.refundReason
                                  }
                                </span>
                              )}

                              {order.refundedAt && (
                                <span>
                                  Refunded:{' '}
                                  {new Date(
                                    order.refundedAt,
                                  ).toLocaleString()}
                                </span>
                              )}

                              {order.stripeRefundId && (
                                <span>
                                  Stripe refund:{' '}
                                  {
                                    order.stripeRefundId
                                  }
                                </span>
                              )}

                              {order.refundFailureMessage && (
                                <span>
                                  Issue:{' '}
                                  {
                                    order.refundFailureMessage
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {order.paymentStatus ===
                          'PAID' &&
                        ![
                          'SUCCEEDED',
                          'PENDING',
                          'CREATING',
                        ].includes(
                          order.refundStatus ||
                            'NONE',
                        ) && (
                          <div
                            style={{
                              marginTop: 14,
                            }}
                          >
                            {shopRefundOrderId !==
                            order.id ? (
                              <button
                                type="button"
                                className="shop-refresh"
                                onClick={() =>
                                  openShopRefund(
                                    order.id,
                                  )
                                }
                              >
                                {[
                                  'FAILED',
                                  'UNKNOWN',
                                ].includes(
                                  order.refundStatus ||
                                    '',
                                )
                                  ? 'Retry refund'
                                  : 'Refund customer'}
                              </button>
                            ) : (
                              <div
                                style={{
                                  padding: 14,
                                  border:
                                    '1px solid rgba(180,0,0,.28)',
                                  borderRadius: 12,
                                  display:
                                    'grid',
                                  gap: 12,
                                }}
                              >
                                <strong>
                                  Full refund ·{' '}
                                  {shopMoney(
                                    order.totalCents,
                                  )}
                                </strong>

                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 13,
                                  }}
                                >
                                  This refunds the
                                  customer through Stripe.
                                  Inventory will not be
                                  restored automatically.
                                </p>

                                <label className="shop-field">
                                  <span>
                                    Refund reason
                                  </span>

                                  <textarea
                                    value={
                                      shopRefundReason
                                    }
                                    maxLength={
                                      500
                                    }
                                    rows={3}
                                    placeholder="Example: Customer requested a refund by email"
                                    onChange={(e) =>
                                      setShopRefundReason(
                                        e
                                          .target
                                          .value,
                                      )
                                    }
                                  />
                                </label>

                                <label
                                  style={{
                                    display:
                                      'flex',
                                    gap: 8,
                                    alignItems:
                                      'flex-start',
                                    fontSize: 13,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      shopRefundConfirmed
                                    }
                                    onChange={(e) =>
                                      setShopRefundConfirmed(
                                        e
                                          .target
                                          .checked,
                                      )
                                    }
                                  />

                                  <span>
                                    I understand this
                                    sends a full Stripe
                                    refund to the
                                    customer.
                                  </span>
                                </label>

                                <div
                                  style={{
                                    display:
                                      'flex',
                                    gap: 8,
                                    flexWrap:
                                      'wrap',
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="shop-primary"
                                    disabled={
                                      shopRefundBusyId ===
                                        order.id ||
                                      shopRefundReason
                                        .trim()
                                        .length <
                                        3 ||
                                      !shopRefundConfirmed
                                    }
                                    onClick={() =>
                                      void refundShopOrder(
                                        order,
                                      )
                                    }
                                  >
                                    {shopRefundBusyId ===
                                    order.id
                                      ? 'Refunding…'
                                      : `Confirm refund ${shopMoney(
                                          order.totalCents,
                                        )}`}
                                  </button>

                                  <button
                                    type="button"
                                    className="shop-refresh"
                                    disabled={
                                      shopRefundBusyId ===
                                      order.id
                                    }
                                    onClick={
                                      closeShopRefund
                                    }
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {supportOrder && (
        <div
          className="modal-bg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeSupport()
            }
          }}
        >
          <div
            className="modal support-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Customer help for order ${getDisplayOrderId(
              supportOrder,
            )}`}
          >
            <div className="modal-head">
              <div>
                <h3>
                  Customer Help · Order #{getDisplayOrderId(
                    supportOrder,
                  )}
                </h3>
                <p>
                  {supportOrder.storeCode}
                  {supportOrder.customerName
                    ? ` · ${supportOrder.customerName}`
                    : ''}
                  {supportOrder.customerEmail
                    ? ` · ${supportOrder.customerEmail}`
                    : ''}
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={closeSupport}
                aria-label="Close"
              >
                <Icon path={ICONS.x} size={16} />
              </button>
            </div>

            <div className="support-status-row">
              <span>
                {String(
                  supportThread?.status ||
                    supportOrder.supportStatus ||
                    'LOADING',
                ).replace(/_/g, ' ')}
              </span>
              <small>
                {supportThread
                  ? `${supportThread.messages.length} message${
                      supportThread.messages.length === 1
                        ? ''
                        : 's'
                    }`
                  : 'Loading conversation'}
              </small>
            </div>

            <div className="support-messages">
              {supportLoading &&
                !supportThread && (
                  <div className="support-empty">
                    Loading conversation…
                  </div>
                )}

              {!supportLoading &&
                supportThread &&
                supportThread.messages.length === 0 && (
                  <div className="support-empty">
                    No messages yet.
                  </div>
                )}

              {supportThread?.messages.map(
                (message) => {
                  const customer =
                    String(
                      message.senderType ||
                        '',
                    ).toUpperCase() ===
                    'CUSTOMER'

                  return (
                    <div
                      key={message.id}
                      className={`support-message ${
                        customer
                          ? 'customer'
                          : 'restaurant'
                      }`}
                    >
                      <div className="support-message-meta">
                        <strong>
                          {message.senderName ||
                            (customer
                              ? 'Customer'
                              : 'Restaurant')}
                        </strong>
                        <span>
                          {timeLabel(
                            message.createdAt,
                          )}
                        </span>
                      </div>
                      <p>{message.message}</p>
                    </div>
                  )
                },
              )}
            </div>

            {!isTerminalSupportStatus(
              supportThread?.status ||
                supportOrder.supportStatus,
            ) && (
              <>
                <textarea
                  className="support-reply"
                  value={replyText}
                  onChange={(e) =>
                    setReplyText(
                      e.target.value,
                    )
                  }
                  maxLength={2000}
                  placeholder="Reply to the customer..."
                />

                <div className="support-reply-count">
                  {replyText.length}/2000
                </div>
              </>
            )}

            <div className="modal-actions support-modal-actions">
              <button
                className="light"
                onClick={closeSupport}
              >
                Close
              </button>

              <button
                className="danger-btn"
                onClick={() =>
                  refundOrder(
                    supportOrder,
                  )
                }
                disabled={
                  actioningId ===
                    supportOrder.id ||
                  supportOrder.status ===
                    'REFUNDED' ||
                  supportOrder.refundProcessed
                }
              >
                {supportOrder.status ===
                  'REFUNDED' ||
                supportOrder.refundProcessed
                  ? 'Refunded'
                  : 'Refund'}
              </button>

              <button
                className="light"
                onClick={() =>
                  resolveOrder(
                    supportOrder,
                  )
                }
                disabled={
                  actioningId ===
                    supportOrder.id ||
                  isTerminalSupportStatus(
                    supportThread?.status ||
                      supportOrder.supportStatus,
                  )
                }
              >
                Resolve
              </button>

              {!isTerminalSupportStatus(
                supportThread?.status ||
                  supportOrder.supportStatus,
              ) && (
                <button
                  onClick={() =>
                    void sendSupportReply()
                  }
                  disabled={
                    sendingReply ||
                    !replyText.trim()
                  }
                >
                  {sendingReply
                    ? 'Sending…'
                    : 'Send reply'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {emailOrder && (
        <div
          className="modal-bg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEmailOrder(null)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h3>Email customer</h3>
                <p>
                  Order #{emailOrder.id} · {emailOrder.customerEmail}
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setEmailOrder(null)}
                aria-label="Close"
              >
                <Icon path={ICONS.x} size={16} />
              </button>
            </div>

            <textarea
              value={emailNote}
              onChange={(e) => setEmailNote(e.target.value)}
            />

            <div className="modal-actions">
              <button
                className="light"
                onClick={() => setEmailOrder(null)}
              >
                Cancel
              </button>

              <button
                onClick={sendEmail}
                disabled={sendingEmail || !emailNote.trim()}
              >
                {sendingEmail ? 'Sending...' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmState.open && (
        <div
          className="modal-bg"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeConfirm()
          }}
        >
          <div
            className="modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="confirm-icon-wrap">
              <span
                className={`confirm-icon ${
                  confirmState.tone === 'danger' ? 'danger' : ''
                }`}
              >
                <Icon path={ICONS.alert} size={18} />
              </span>
            </div>

            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>

            <div className="modal-actions">
              <button className="light" onClick={closeConfirm}>
                Cancel
              </button>

              <button
                className={confirmState.tone === 'danger' ? 'danger-btn' : ''}
                onClick={runConfirm}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.kind}`} key={t.id}>
            <span className="toast-icon">
              <Icon
                path={
                  t.kind === 'success'
                    ? ICONS.check
                    : t.kind === 'error'
                    ? ICONS.alert
                    : ICONS.info
                }
                size={15}
              />
            </span>
            <span>{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              <Icon path={ICONS.x} size={13} />
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
        }

        :global(button),
        :global(input),
        :global(textarea) {
          font: inherit;
          color: inherit;
        }

        :global(button:focus-visible),
        :global(input:focus-visible),
        :global(textarea:focus-visible),
        :global([tabindex]:focus-visible) {
          outline: 2px solid #2f6fed;
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          :global(*) {
            animation-duration: 0.001ms !important;
            transition-duration: 0.001ms !important;
          }
        }

        .page {
          --ink: #0b0d12;
          --body: #3a3f47;
          --muted: #6b7280;
          --faint: #9ca3af;
          --line: #e5e7eb;
          --canvas: #f7f7f8;
          --panel: #ffffff;
          --brand: #e23b23;
          --brand-weak: #fdeeea;
          --brand-strong: #b92e1b;
          --blue: #2f6fed;
          --blue-weak: #eef3ff;
          --amber: #b45309;
          --amber-weak: #fef6e7;
          --green: #0f8a5f;
          --green-weak: #e8f7f0;
          --red: #d92d20;
          --red-weak: #fef0ef;
          --r-sm: 8px;
          --r-md: 12px;
          --r-lg: 18px;
          --r-xl: 24px;
          --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.04);
          --shadow-md: 0 4px 16px rgba(16, 24, 40, 0.06);
          --shadow-lg: 0 24px 56px rgba(16, 24, 40, 0.18);

          min-height: 100vh;
          display: flex;
          background: var(--canvas);
          color: var(--ink);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .red {
          color: var(--red) !important;
        }
        .green {
          color: var(--green) !important;
        }
        .amber {
          color: var(--amber) !important;
        }

        .sidebar {
          width: 260px;
          min-height: 100vh;
          background: var(--ink);
          color: #e5e7eb;
          padding: 22px 16px;
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 4px 6px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .logo {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 10px;
          background: var(--brand);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          letter-spacing: -0.02em;
          box-shadow: 0 6px 18px rgba(226, 59, 35, 0.35);
        }

        .brand h1 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: white;
        }

        .brand p {
          margin: 2px 0 0;
          color: #8b8f98;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .nav-btn {
          border: 1px solid rgba(255, 255, 255, 0.12);
          width: 100%;
          background: white;
          color: #111827;
          border-radius: var(--r-md);
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 11px 12px;
          cursor: pointer;
          text-align: left;
          transition: background 130ms ease, color 130ms ease, transform 130ms ease, box-shadow 130ms ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .nav-btn:hover {
          background: #f4f4f5;
          color: #111827;
          transform: translateY(-1px);
        }

        .nav-btn.active {
          background: white;
          color: #111827;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
        }

        .nav-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #111827;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-btn.active .nav-icon {
          background: var(--brand);
          color: white;
        }

        .nav-copy {
          flex: 1;
          min-width: 0;
        }

        .nav-copy strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
          color: #111827;
        }

        .nav-copy small {
          display: block;
          margin-top: 2px;
          font-size: 10.5px;
          font-weight: 600;
          color: #52525b;
        }

        .nav-count {
          background: var(--brand);
          color: white;
          font-size: 10.5px;
          font-weight: 800;
          border-radius: 999px;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .sidebar-stats div {
          border-radius: var(--r-md);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 12px;
        }

        .sidebar-stats small {
          display: block;
          color: #8b8f98;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .sidebar-stats strong {
          display: block;
          margin-top: 4px;
          font-size: 22px;
          font-weight: 750;
          color: white;
        }

        .system {
          margin-top: auto;
          border-radius: var(--r-md);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 13px;
        }

        .system > div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .system strong {
          font-size: 12px;
          color: white;
          font-weight: 650;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .dot.ok {
          background: #34d399;
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
        }

        .dot.bad {
          background: #fb7185;
          box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.18);
        }

        .system p {
          margin: 7px 0 0;
          color: #8b8f98;
          font-size: 11px;
          line-height: 1.5;
        }

        .main {
          flex: 1;
          min-width: 0;
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px clamp(20px, 3vw, 44px) 56px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 22px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .header h2 {
          margin: 0;
          font-size: clamp(22px, 2.6vw, 27px);
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .header p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 13.5px;
          font-weight: 500;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: min(300px, 40vw);
          height: 38px;
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: var(--r-sm);
          padding: 0 10px;
          color: var(--faint);
          gap: 8px;
          transition: border-color 130ms ease, box-shadow 130ms ease;
        }

        .search-wrap:focus-within {
          border-color: #9db8f7;
          box-shadow: 0 0 0 3px var(--blue-weak);
        }

        .search-wrap input {
          border: 0;
          outline: none;
          flex: 1;
          background: transparent;
          color: var(--ink);
          font-size: 13px;
          font-weight: 500;
        }

        .switch-label {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 38px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
          user-select: none;
        }

        .switch {
          width: 32px;
          height: 18px;
          border-radius: 999px;
          background: #d1d5db;
          position: relative;
          cursor: pointer;
          transition: background 150ms ease;
          flex-shrink: 0;
        }

        .switch.on {
          background: var(--brand);
        }

        .switch-dot {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: white;
          box-shadow: var(--shadow-sm);
          transition: transform 150ms ease;
        }

        .switch.on .switch-dot {
          transform: translateX(14px);
        }

        .refresh-btn {
          height: 38px;
          border: 0;
          background: var(--ink);
          color: white;
          border-radius: var(--r-sm);
          padding: 0 14px;
          cursor: pointer;
          font-weight: 650;
          font-size: 12.5px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .refresh-btn:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .spin {
          display: inline-flex;
          animation: spin 900ms linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r-lg);
          padding: 16px;
          box-shadow: var(--shadow-sm);
        }

        .stat-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: var(--blue-weak);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .stat-card.red .stat-icon {
          background: var(--red-weak);
          color: var(--red);
        }

        .stat-card.green .stat-icon {
          background: var(--green-weak);
          color: var(--green);
        }

        .stat-card.amber .stat-icon {
          background: var(--amber-weak);
          color: var(--amber);
        }

        .stat-card span {
          display: block;
          color: var(--muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .stat-card strong {
          display: block;
          margin-top: 7px;
          font-size: 26px;
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 18px;
        }

        .filters button {
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--muted);
          border-radius: 999px;
          padding: 7px 13px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          transition: background 130ms ease, color 130ms ease, border-color 130ms ease;
        }

        .filters button:hover {
          border-color: #d1d5db;
          color: var(--ink);
        }

        .filters button.active {
          background: var(--ink);
          border-color: var(--ink);
          color: white;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .lane-label {
          font-size: 11.5px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--red);
          margin: 6px 2px 2px;
        }

        .lane-label.muted {
          color: var(--faint);
          margin-top: 18px;
        }

        .order-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 148px;
          gap: 16px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r-lg);
          padding: 16px 16px 16px 18px;
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: hidden;
          transition: box-shadow 150ms ease, transform 150ms ease;
        }

        .order-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
        }

        .order-card:hover {
          box-shadow: var(--shadow-md);
        }

        .rail-critical::before {
          background: var(--red);
        }
        .rail-open::before {
          background: var(--blue);
        }
        .rail-resolved::before {
          background: #d1d5db;
        }
        .rail-refunded::before {
          background: var(--green);
        }

        .order-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .order-id-group {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .order-id {
          font-size: 12px;
          font-weight: 650;
          color: var(--body);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          height: 21px;
          border-radius: 6px;
          padding: 0 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-weight: 800;
          white-space: nowrap;
        }

        .badge.needed {
          background: var(--blue-weak);
          color: var(--blue);
        }

        .badge.needed.critical {
          background: var(--red-weak);
          color: var(--red);
        }

        .badge.quiet {
          background: #f4f4f5;
          color: var(--muted);
        }

        .badge.quiet.refunded {
          background: var(--green-weak);
          color: var(--green);
        }

        .time {
          color: var(--faint);
          font-size: 11.5px;
          font-weight: 600;
          white-space: nowrap;
        }

        .message {
          margin: 10px 0 0;
          color: var(--body);
          font-size: 13.5px;
          line-height: 1.5;
          font-weight: 500;
        }

        .matrix-card {
          border-radius: 24px;
          padding: 0;
        }

        .matrix-card .order-content {
          padding: 18px 0 18px 18px;
        }

        .matrix-top {
          padding-right: 4px;
        }

        .matrix-message {
          max-width: 900px;
          font-weight: 600;
        }

        .matrix-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .matrix-box {
          min-width: 0;
          background: #fbfbfc;
          border: 1px solid #eeeeef;
          border-radius: 14px;
          padding: 12px;
        }

        .matrix-box small {
          display: block;
          color: var(--faint);
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
        }

        .matrix-box strong {
          display: block;
          margin-top: 4px;
          color: var(--ink);
          font-size: 12.5px;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .matrix-box span {
          display: block;
          margin-top: 2px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .matrix-items {
          margin-top: 12px;
        }

        .cafe-detail-top {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 0 0 14px;
        }

        .cafe-detail-top > div {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 14px 16px;
          box-shadow: var(--shadow-sm);
        }

        .cafe-detail-top small {
          display: block;
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
        }

        .cafe-detail-top strong {
          display: block;
          margin-top: 4px;
          color: var(--ink);
          font-size: 15px;
          font-weight: 850;
        }

        .cafe-order-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .cafe-order-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
          position: relative;
        }

        .cafe-order-card::before {
          content: '';
          display: block;
          height: 5px;
          background: #d1d5db;
        }

        .cafe-order-card.cafe-critical::before {
          background: var(--red);
        }

        .cafe-order-card.cafe-open::before {
          background: var(--amber);
        }

        .cafe-order-card.cafe-refunded::before {
          background: var(--green);
        }

        .cafe-order-main {
          padding: 16px;
        }

        .cafe-order-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .cafe-order-kicker {
          font-size: 11px;
          color: var(--muted);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .cafe-order-head h3 {
          margin: 4px 0 0;
          color: var(--ink);
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cafe-order-head h3 span {
          margin-left: 8px;
          color: var(--green);
          font-size: 14px;
        }

        .cafe-order-status-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .cafe-order-message {
          margin: 12px 0 0;
          color: var(--body);
          font-size: 13px;
          line-height: 1.5;
          font-weight: 600;
        }

        .cafe-order-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .cafe-order-card .matrix-box {
          background: #fbfbfc;
          border-color: #ececef;
          min-height: 82px;
        }

        .cafe-items-box {
          margin-top: 12px;
          background: #fbfbfc;
          border: 1px solid #ececef;
          border-radius: 14px;
          padding: 12px;
        }

        .cafe-items-box small {
          display: block;
          color: var(--faint);
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
        }

        .cafe-items-box div {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cafe-items-box span {
          background: white;
          border: 1px solid #eeeeef;
          border-radius: 999px;
          padding: 6px 9px;
          color: var(--ink);
          font-size: 11px;
          font-weight: 800;
        }

        .cafe-order-card .action-buttons {
          padding: 0 16px 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .cafe-order-card .btn {
          min-height: 42px;
          border-radius: 13px;
          font-size: 12px;
          font-weight: 850;
        }

        .cafe-order-card .btn.refund {
          background: #fee2e2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .cafe-order-card .btn.email {
          background: #dbeafe;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .cafe-order-card .btn.resolve {
          background: #111827;
          border-color: #111827;
          color: white;
        }

        .nav-btn,
        .nav-btn:hover,
        .nav-btn.active {
          background: white !important;
          color: #111827 !important;
        }

        .nav-btn .nav-copy strong,
        .nav-btn.active .nav-copy strong {
          color: #111827 !important;
        }

        .nav-btn .nav-copy small,
        .nav-btn.active .nav-copy small {
          color: #374151 !important;
        }

        .nav-count {
          color: white !important;
        }

        .back {
          color: #111827 !important;
          background: white !important;
          border: 1px solid var(--line) !important;
        }

        .order-people {
          margin-top: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px;
          background: #fbfbfc;
          border: 1px solid #f0f0f1;
          border-radius: var(--r-md);
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: var(--ink);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11.5px;
          font-weight: 750;
          flex-shrink: 0;
        }

        .order-people > div:nth-child(2) {
          min-width: 0;
        }

        .order-people > div:nth-child(2) strong {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .order-people > div:nth-child(2) span {
          display: block;
          margin-top: 1px;
          font-size: 11px;
          color: var(--muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .order-people-right {
          margin-left: auto;
          display: flex;
          gap: 16px;
          flex-shrink: 0;
        }

        .order-people-right small {
          display: block;
          color: var(--faint);
          font-size: 9.5px;
          text-transform: uppercase;
          font-weight: 750;
          letter-spacing: 0.04em;
        }

        .order-people-right strong {
          display: block;
          margin-top: 2px;
          font-size: 12.5px;
          font-weight: 700;
        }

        .items {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .items span {
          background: var(--amber-weak);
          color: #9a3412;
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 700;
        }

        .stripe {
          margin-top: 11px;
          color: var(--faint);
          font-size: 10.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stripe-sep {
          margin: 0 6px;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 7px;
          justify-content: center;
        }

        .btn {
          width: 100%;
          min-height: 36px;
          border: 1px solid transparent;
          border-radius: var(--r-sm);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: filter 130ms ease, transform 130ms ease;
        }

        .btn:not(:disabled):hover {
          filter: brightness(0.95);
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn.refund {
          background: var(--red-weak);
          color: var(--red);
        }

        .btn.email {
          background: var(--blue-weak);
          color: var(--blue);
        }

        .btn.resolve {
          background: var(--ink);
          color: white;
        }

        .empty {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r-xl);
          padding: 56px 30px;
          text-align: center;
        }

        .empty-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--green-weak);
          color: var(--green);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
        }

        .empty h3 {
          margin: 0 0 6px;
          font-size: 17px;
          font-weight: 700;
        }

        .empty p {
          margin: 0 auto;
          max-width: 360px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 500;
          line-height: 1.5;
        }

        .skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .skeleton-card {
          height: 168px;
          border-radius: var(--r-lg);
          background: linear-gradient(100deg, #eeeeef 30%, #f6f6f7 45%, #eeeeef 60%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }

        @keyframes shimmer {
          from {
            background-position: 120% 0;
          }
          to {
            background-position: -20% 0;
          }
        }

        .table-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r-xl);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .table-wrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
        }

        th {
          background: #fafafa;
          color: var(--muted);
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 10.5px;
          font-weight: 750;
          padding: 13px 18px;
          border-bottom: 1px solid var(--line);
        }

        td {
          padding: 14px 18px;
          border-bottom: 1px solid #f4f4f5;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--body);
        }

        tbody tr {
          cursor: pointer;
          transition: background 120ms ease;
        }

        tbody tr:hover {
          background: #fafbff;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .cafe-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cafe-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--brand-weak);
          color: var(--brand-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10.5px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .cafe-cell strong {
          color: var(--ink);
        }

        .mono {
          color: var(--muted);
        }

        td.center {
          text-align: center;
          color: var(--faint);
          cursor: default;
        }

        .pill {
          display: inline-flex;
          border-radius: 6px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 750;
        }

        .pill.danger {
          background: var(--red-weak);
          color: var(--red);
        }

        .pill.good {
          background: var(--green-weak);
          color: var(--green);
        }

        .back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: var(--r-sm);
          padding: 9px 13px;
          margin-bottom: 14px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12.5px;
          box-shadow: var(--shadow-sm);
        }

        .qr-section {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--r-xl);
          padding: 22px;
          box-shadow: var(--shadow-sm);
        }

        .domain-box {
          margin-top: 16px;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          border-radius: var(--r-lg);
          padding: 14px 16px;
        }

        .domain-box small {
          display: block;
          color: #15803d;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .domain-box strong {
          display: block;
          margin-top: 5px;
          color: #14532d;
          font-size: 13px;
          word-break: break-all;
        }

        .domain-box p {
          margin: 6px 0 0;
          color: #166534;
          font-size: 12px;
          font-weight: 650;
        }

        .vendor-box {
          margin-top: 16px;
          border: 1px solid var(--line);
          background: white;
          border-radius: var(--r-lg);
          padding: 16px;
        }

        .vendor-head {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .vendor-head h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .vendor-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12.5px;
          line-height: 1.5;
          font-weight: 600;
        }

        .copy-all {
          border: 0;
          background: var(--green);
          color: white;
          border-radius: var(--r-sm);
          min-height: 36px;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .vendor-box textarea {
          width: 100%;
          height: 190px;
          border: 1px solid var(--line);
          background: #fafafa;
          border-radius: var(--r-md);
          padding: 12px;
          resize: vertical;
          font-size: 12px;
          line-height: 1.6;
          color: var(--body);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .tag-specs {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .tag-specs div {
          background: #fbfbfc;
          border: 1px solid #eeeeef;
          border-radius: var(--r-md);
          padding: 12px;
        }

        .tag-specs small {
          display: block;
          color: var(--faint);
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .tag-specs strong {
          display: block;
          margin-top: 4px;
          color: var(--ink);
          font-size: 12px;
          font-weight: 800;
        }

        .qr-form {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 12px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: var(--muted);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 750;
        }

        .field input {
          height: 40px;
          width: 220px;
          border: 1px solid var(--line);
          border-radius: var(--r-sm);
          padding: 0 12px;
          outline: none;
          font-weight: 600;
          transition: border-color 130ms ease, box-shadow 130ms ease;
        }

        .field.narrow input {
          width: 100px;
        }

        .field input:focus {
          border-color: #9db8f7;
          box-shadow: 0 0 0 3px var(--blue-weak);
        }

        .generate-btn,
        .secondary {
          height: 40px;
          border: 0;
          border-radius: var(--r-sm);
          padding: 0 16px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .generate-btn {
          background: var(--ink);
          color: white;
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .secondary {
          background: white;
          color: var(--ink);
          border: 1px solid var(--line);
        }

        .qr-empty {
          padding: 56px 30px;
          text-align: center;
        }

        .qr-empty h3 {
          margin: 0 0 6px;
          font-size: 16px;
          font-weight: 700;
        }

        .qr-empty p {
          margin: 0 auto;
          max-width: 360px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .qr-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
          gap: 12px;
        }

        .qr-card {
          background: #fafafa;
          border: 1px solid #eeeeef;
          border-radius: var(--r-md);
          padding: 14px;
          text-align: center;
        }

        .qr-card img {
          width: 110px;
          height: 110px;
          margin: 0 auto;
          border-radius: 6px;
        }

        .qr-card strong {
          display: block;
          margin-top: 9px;
          font-weight: 750;
          font-size: 13px;
        }

        .qr-card span {
          display: block;
          margin-top: 3px;
          color: var(--faint);
          font-size: 9.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .qr-card-actions {
          margin-top: 9px;
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .qr-card-actions button {
          width: 28px;
          height: 28px;
          border: 1px solid var(--line);
          background: white;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
        }

        .qr-card-actions button:hover {
          color: var(--ink);
          border-color: #d1d5db;
        }

        .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(11, 13, 18, 0.55);
          backdrop-filter: blur(3px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: 100%;
          max-width: 460px;
          background: white;
          border-radius: var(--r-xl);
          padding: 22px;
          box-shadow: var(--shadow-lg);
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .modal-head h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 750;
        }

        .modal-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12.5px;
          font-weight: 600;
        }

        .icon-btn {
          border: 0;
          background: #f4f4f5;
          border-radius: var(--r-sm);
          width: 30px;
          height: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          flex-shrink: 0;
        }

        textarea {
          width: 100%;
          height: 150px;
          margin-top: 16px;
          border: 1px solid var(--line);
          background: #fafafa;
          border-radius: var(--r-md);
          padding: 12px;
          outline: none;
          resize: vertical;
          line-height: 1.55;
          font-weight: 500;
          font-size: 13.5px;
        }

        textarea:focus {
          border-color: #9db8f7;
          box-shadow: 0 0 0 3px var(--blue-weak);
        }

        .modal-actions {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .modal-actions button {
          border: 0;
          border-radius: var(--r-sm);
          background: var(--blue);
          color: white;
          padding: 10px 15px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
        }

        .modal-actions button.light {
          background: #f4f4f5;
          color: var(--ink);
        }

        .modal-actions button.danger-btn {
          background: var(--red);
        }

        .modal-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-modal {
          max-width: 400px;
          text-align: left;
        }

        .confirm-icon-wrap {
          margin-bottom: 12px;
        }

        .confirm-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--blue-weak);
          color: var(--blue);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .confirm-icon.danger {
          background: var(--red-weak);
          color: var(--red);
        }

        .confirm-modal h3 {
          margin: 0 0 6px;
          font-size: 16.5px;
          font-weight: 750;
        }

        .confirm-modal p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
          font-weight: 500;
        }

        .toast-stack {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 200;
          max-width: min(360px, calc(100vw - 40px));
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 9px;
          background: var(--ink);
          color: white;
          border-radius: var(--r-md);
          padding: 12px 12px 12px 14px;
          box-shadow: var(--shadow-lg);
          font-size: 12.5px;
          font-weight: 600;
          animation: toast-in 180ms ease;
        }

        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .toast-icon {
          display: flex;
          flex-shrink: 0;
        }

        .toast.success .toast-icon {
          color: #34d399;
        }
        .toast.error .toast-icon {
          color: #fb7185;
        }
        .toast.info .toast-icon {
          color: #93c5fd;
        }

        .toast span:nth-child(2) {
          flex: 1;
        }

        .toast button {
          border: 0;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
        }

        .toast button:hover {
          color: white;
        }

        @media (max-width: 1100px) {
          .page {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            min-height: auto;
            position: relative;
            flex-direction: row;
            align-items: center;
            flex-wrap: wrap;
            padding: 14px 16px;
            gap: 12px;
          }

          .brand {
            border-bottom: 0;
            padding: 0;
          }

          nav {
            flex-direction: row;
            flex: 1;
            gap: 6px;
          }

          .nav-btn {
            flex: 1;
          }

          .nav-copy small {
            display: none;
          }

          .sidebar-stats,
          .system {
            display: none;
          }

          .main {
            padding: 22px 16px 40px;
          }

          .header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            justify-content: flex-start;
          }

          .search-wrap {
            width: 100%;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .order-card {
            grid-template-columns: 1fr;
          }

          .matrix-card .order-content {
            padding: 16px;
          }

          .matrix-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .action-buttons {
            flex-direction: row;
          }

          .btn {
            flex: 1;
          }

          .cafe-order-list {
            grid-template-columns: 1fr;
          }

          .cafe-detail-top {
            grid-template-columns: 1fr;
          }

          .order-people {
            flex-wrap: wrap;
          }

          .order-people-right {
            margin-left: 0;
            width: 100%;
            justify-content: space-between;
          }
        }

        @media (max-width: 640px) {
          .nav-copy {
            display: none;
          }

          .nav-btn {
            justify-content: center;
          }

          .header h2 {
            font-size: 22px;
          }

          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .field input {
            width: 100%;
          }

          .qr-form {
            flex-direction: column;
            align-items: stretch;
          }

          .vendor-head {
            flex-direction: column;
          }

          .tag-specs {
            grid-template-columns: 1fr;
          }

          .generate-btn,
          .secondary {
            justify-content: center;
          }

          .toast-stack {
            left: 16px;
            right: 16px;
            bottom: 16px;
            max-width: none;
          }
        }

        /* ===== Delivery operations redesign (Action Center + All Cafés) ===== */
        .page {
          --ops-ink: #101828;
          --ops-muted: #667085;
          --ops-border: #e4e7ec;
          --ops-canvas: #f3f5f8;
          --ops-orange: #ff5a1f;
          --ops-red: #d92d20;
          --ops-amber: #dc6803;
          --ops-green: #067647;
          background:
            radial-gradient(circle at 100% 0%, rgba(255, 90, 31, 0.07), transparent 28%),
            var(--ops-canvas);
        }

        .sidebar {
          width: 278px;
          padding: 24px 18px 20px;
          gap: 18px;
          background: linear-gradient(180deg, #111827 0%, #0b1220 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 14px 0 36px rgba(16, 24, 40, 0.08);
          z-index: 10;
        }
        .brand { border-bottom: 0; padding: 2px 4px 18px; }
        .logo {
          width: 42px; height: 42px; border-radius: 14px;
          background: linear-gradient(145deg, #ff6b35, #f04438);
          box-shadow: 0 10px 24px rgba(240, 68, 56, 0.28);
        }
        .brand h1 { font-size: 17px; letter-spacing: -0.025em; }
        .brand p { color: #98a2b3; font-size: 10px; letter-spacing: .075em; text-transform: uppercase; }
        .sidebar-label { padding: 0 10px; color: #667085; font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        nav { gap: 7px; }
        .nav-btn, .nav-btn:hover, .nav-btn.active {
          min-height: 60px; padding: 10px 11px; border-radius: 15px;
          border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.045);
          color: #f9fafb; box-shadow: none; transform: none;
        }
        .nav-btn:hover { background: rgba(255,255,255,.085); border-color: rgba(255,255,255,.13); }
        .nav-btn.active { background: #fff; border-color: #fff; color: var(--ops-ink); box-shadow: 0 14px 28px rgba(0,0,0,.24); }
        .nav-icon { width: 36px; height: 36px; border-radius: 12px; background: rgba(255,255,255,.09); color: #d0d5dd; }
        .nav-btn.active .nav-icon { background: linear-gradient(145deg, #ff6b35, #f04438); color: #fff; box-shadow: 0 7px 16px rgba(240,68,56,.25); }
        .nav-copy strong, .nav-btn:hover .nav-copy strong { color: #f9fafb; font-size: 13px; }
        .nav-copy small, .nav-btn:hover .nav-copy small { color: #98a2b3; font-size: 10px; }
        .nav-btn.active .nav-copy strong { color: var(--ops-ink); }
        .nav-btn.active .nav-copy small { color: #667085; }
        .nav-count { background: #f04438; min-width: 22px; height: 22px; }
        .sidebar-stats div, .system { border-radius: 14px; background: rgba(255,255,255,.045); }

        .main { max-width: 1540px; padding: 26px clamp(22px,3vw,46px) 64px; }
        .header {
          align-items: center; min-height: 104px;
          margin: -26px calc(clamp(22px,3vw,46px) * -1) 24px;
          padding: 23px clamp(22px,3vw,46px) 20px;
          background: rgba(255,255,255,.9); backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--ops-border); position: sticky; top: 0; z-index: 8;
        }
        .header-title-group { min-width: 270px; }
        .header-eyebrow { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; color: #667085; font-size: 10px; font-weight: 800; letter-spacing: .075em; text-transform: uppercase; }
        .live-dot { width: 7px; height: 7px; border-radius: 50%; }
        .live-dot.online { background: #12b76a; box-shadow: 0 0 0 4px rgba(18,183,106,.12); }
        .live-dot.offline { background: #f04438; box-shadow: 0 0 0 4px rgba(240,68,56,.12); }
        .header h2 { font-size: clamp(24px,2.3vw,31px); font-weight: 800; color: var(--ops-ink); letter-spacing: -.04em; }
        .header p { margin-top: 5px; color: #667085; font-size: 13px; }
        .search-wrap, .refresh-btn { height: 42px; border-radius: 12px; }
        .search-wrap { width: min(340px,38vw); }
        .refresh-btn { background: var(--ops-ink); padding: 0 16px; box-shadow: 0 6px 14px rgba(16,24,40,.16); }
        .switch.on { background: var(--ops-orange); }

        .ops-hero {
          display: grid; grid-template-columns: minmax(0,1.45fr) minmax(300px,.55fr);
          gap: 22px; min-height: 210px; margin-bottom: 18px; padding: clamp(24px,3vw,34px);
          border-radius: 24px; color: #fff; overflow: hidden; position: relative;
          background: radial-gradient(circle at 83% 12%, rgba(255,120,62,.35), transparent 27%), radial-gradient(circle at 18% 125%, rgba(105,65,198,.42), transparent 35%), linear-gradient(130deg,#101828 0%,#17264a 55%,#202e55 100%);
          box-shadow: 0 22px 48px rgba(16,24,40,.16);
        }
        .ops-hero > div { position: relative; z-index: 1; }
        .ops-hero > div:first-child { display: flex; flex-direction: column; justify-content: center; }
        .ops-kicker, .section-kicker { display: block; margin-bottom: 7px; color: var(--ops-orange); font-size: 10px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; }
        .ops-kicker { color: #ffb494; }
        .ops-hero h3 { margin: 0; max-width: 680px; font-size: clamp(26px,3.3vw,42px); line-height: 1.06; letter-spacing: -.045em; }
        .ops-hero p { margin: 13px 0 0; max-width: 630px; color: #cbd5e1; font-size: 13px; line-height: 1.65; }
        .ops-hero-side { display: grid; align-content: center; gap: 10px; }
        .hero-risk, .hero-status { border: 1px solid rgba(255,255,255,.12); border-radius: 17px; background: rgba(255,255,255,.08); backdrop-filter: blur(10px); }
        .hero-risk { padding: 17px 18px; }
        .hero-risk small, .hero-status small { display: block; color: #cbd5e1; font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
        .hero-risk strong { display: block; margin: 5px 0 1px; font-size: 30px; letter-spacing: -.04em; }
        .hero-risk span { color: #d0d5dd; font-size: 11px; }
        .hero-status { display: flex; align-items: center; gap: 11px; padding: 13px 16px; }
        .hero-status strong { display: block; margin-top: 2px; color: #fff; font-size: 12px; }

        .stats { grid-template-columns: repeat(5,minmax(0,1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { min-height: 156px; padding: 16px; border: 1px solid var(--ops-border); border-radius: 19px; background: #fff; box-shadow: 0 8px 24px rgba(16,24,40,.055); position: relative; overflow: hidden; }
        .stat-card::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #d0d5dd; }
        .stat-card.red::after { background: #f04438; } .stat-card.green::after { background: #12b76a; } .stat-card.amber::after { background: #f79009; }
        .stat-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .stat-card .stat-icon { margin: 0; width: 34px; height: 34px; border-radius: 11px; }
        .stat-pulse { width: 6px; height: 6px; border-radius: 50%; background: #d0d5dd; }
        .stat-card.red .stat-pulse { background: #f04438; } .stat-card.green .stat-pulse { background: #12b76a; } .stat-card.amber .stat-pulse { background: #f79009; }
        .stat-card > span:not(.stat-pulse) { color: #667085; font-size: 9.5px; letter-spacing: .08em; }
        .stat-card strong { margin-top: 5px; color: var(--ops-ink); font-size: 25px; }
        .stat-card > small { display: block; margin-top: 7px; color: #98a2b3; font-size: 10px; line-height: 1.35; }

        .queue-toolbar, .cafe-orders-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 8px 0 14px; }
        .queue-toolbar h3, .network-summary h3, .cafe-orders-heading h3 { margin: 0; color: var(--ops-ink); font-size: 20px; letter-spacing: -.025em; }
        .filters { margin: 0; padding: 5px; border: 1px solid var(--ops-border); border-radius: 13px; background: #fff; box-shadow: 0 3px 10px rgba(16,24,40,.035); }
        .filters button { min-height: 32px; padding: 0 12px; border-radius: 9px; color: #475467; font-size: 11px; font-weight: 750; }
        .filters button.active { background: var(--ops-ink); color: #fff; box-shadow: 0 5px 12px rgba(16,24,40,.17); }

        .list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); align-items: start; gap: 14px; }
        .lane-label { grid-column: 1/-1; display: flex; align-items: center; gap: 8px; margin: 7px 0 -2px; color: #344054; font-size: 11px; font-weight: 800; letter-spacing: .055em; text-transform: uppercase; }
        .lane-label::after { content: ''; height: 1px; flex: 1; background: var(--ops-border); }
        .lane-label strong { display: inline-flex; align-items: center; justify-content: center; min-width: 25px; height: 22px; padding: 0 7px; border-radius: 999px; color: #fff; background: #f04438; font-size: 10px; }
        .lane-label.muted strong { background: #667085; }
        .order-card { min-width: 0; height: 100%; border: 1px solid var(--ops-border); border-radius: 20px; background: #fff; box-shadow: 0 8px 24px rgba(16,24,40,.055); overflow: hidden; transition: transform .16s ease, box-shadow .16s ease; }
        .order-card:hover { transform: translateY(-2px); box-shadow: 0 16px 36px rgba(16,24,40,.09); }
        .order-card.rail-critical { border-color: #fecdca; background: linear-gradient(180deg,#fff8f7,#fff 42%); }
        .order-card.rail-open { border-color: #fedf89; background: linear-gradient(180deg,#fffbf3,#fff 42%); }
        .order-card.rail-refunded { border-color: #abefc6; background: linear-gradient(180deg,#f6fef9,#fff 42%); }
        .order-content { padding: 17px 17px 12px; }
        .matrix-message { min-height: 46px; margin: 13px 0; color: var(--ops-ink); font-size: 13px; font-weight: 700; line-height: 1.45; }
        .time { padding: 5px 8px; border-radius: 999px; color: #667085; background: #f2f4f7; font-size: 9.5px; font-weight: 750; }
        .badge { min-height: 23px; border-radius: 999px; padding: 0 8px; font-size: 9px; font-weight: 850; letter-spacing: .035em; text-transform: uppercase; }
        .badge.needed { border: 1px solid #fedf89; color: #93370d; background: #fffaeb; }
        .badge.needed.critical { border-color: #fecdca; color: #b42318; background: #fef3f2; }
        .badge.quiet { border: 1px solid var(--ops-border); color: #475467; background: #f9fafb; }
        .badge.quiet.refunded { border-color: #abefc6; color: #067647; background: #ecfdf3; }
        .matrix-grid, .cafe-order-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 0; overflow: hidden; border: 1px solid var(--ops-border); border-radius: 14px; background: #f9fafb; }
        .matrix-box { min-width: 0; min-height: 88px; padding: 11px; border: 0; border-right: 1px solid var(--ops-border); border-bottom: 1px solid var(--ops-border); border-radius: 0; background: transparent; }
        .matrix-box:nth-child(4n) { border-right: 0; } .matrix-box:nth-last-child(-n+4) { border-bottom: 0; }
        .matrix-box small { color: #98a2b3; font-size: 8.5px; letter-spacing: .075em; }
        .matrix-box strong { margin-top: 6px; color: #1d2939; font-size: 12px; line-height: 1.25; overflow-wrap: anywhere; }
        .matrix-box span { margin-top: 4px; color: #667085; font-size: 9px; overflow-wrap: anywhere; }
        .matrix-items, .cafe-items-box { margin-top: 11px; border: 1px solid var(--ops-border); border-radius: 12px; background: #fff; }
        .matrix-items span, .cafe-items-box div span { border: 1px solid var(--ops-border); border-radius: 999px; padding: 5px 8px; color: #344054; background: #f9fafb; font-size: 9.5px; font-weight: 700; }
        .stripe { color: #98a2b3; font-size: 8.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .action-buttons { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; padding: 12px 14px 14px; border-top: 1px solid var(--ops-border); background: #f9fafb; }
        .btn { min-height: 38px; border-radius: 10px; justify-content: center; font-size: 10.5px; font-weight: 800; }
        .btn.refund { border: 1px solid #fecdca; color: #b42318; background: #fff; }
        .btn.email { border: 1px solid #b2ddff; color: #175cd3; background: #fff; }
        .btn.resolve { border: 1px solid #abefc6; color: #067647; background: #fff; }
        .btn.refund:hover:not(:disabled) { color: #fff; background: #d92d20; } .btn.email:hover:not(:disabled) { color: #fff; background: #175cd3; } .btn.resolve:hover:not(:disabled) { color: #fff; background: #067647; }

        .network-summary { display: grid; grid-template-columns: minmax(0,.85fr) minmax(520px,1.15fr); gap: 24px; align-items: center; margin-bottom: 20px; padding: 23px 24px; border: 1px solid var(--ops-border); border-radius: 22px; background: #fff; box-shadow: 0 10px 30px rgba(16,24,40,.055); }
        .network-summary p { margin: 7px 0 0; color: #667085; font-size: 12px; line-height: 1.55; }
        .network-summary-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); overflow: hidden; border: 1px solid var(--ops-border); border-radius: 15px; background: #f9fafb; }
        .network-summary-grid > div { min-height: 82px; padding: 14px; border-right: 1px solid var(--ops-border); }
        .network-summary-grid > div:last-child { border-right: 0; }
        .network-summary-grid small, .cafe-detail-top small { display: block; color: #98a2b3; font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
        .network-summary-grid strong { display: block; margin-top: 9px; color: var(--ops-ink); font-size: 20px; }
        .cafe-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 15px; }
        .cafe-card { position: relative; width: 100%; min-width: 0; min-height: 246px; padding: 0; border: 1px solid var(--ops-border); border-radius: 20px; text-align: left; color: var(--ops-ink); background: #fff; box-shadow: 0 8px 24px rgba(16,24,40,.05); overflow: hidden; cursor: pointer; transition: transform .17s ease, box-shadow .17s ease; }
        .cafe-card:hover { transform: translateY(-3px); box-shadow: 0 18px 38px rgba(16,24,40,.1); }
        .cafe-card-rail { display: block; height: 5px; background: #12b76a; }
        .cafe-card.warning .cafe-card-rail { background: #f79009; } .cafe-card.critical .cafe-card-rail { background: #f04438; }
        .cafe-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 16px 14px; }
        .cafe-identity { display: flex; align-items: center; min-width: 0; gap: 11px; }
        .cafe-avatar, .selected-cafe-avatar { flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 13px; color: #fff; background: linear-gradient(145deg,#344054,#101828); font-weight: 850; }
        .cafe-avatar { width: 42px; height: 42px; font-size: 12px; }
        .cafe-identity strong { display: block; max-width: 150px; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
        .cafe-identity small { display: block; margin-top: 4px; color: #98a2b3; font-size: 9.5px; }
        .cafe-health { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; min-height: 25px; padding: 0 9px; border: 1px solid #abefc6; border-radius: 999px; color: #067647; background: #ecfdf3; font-size: 9px; font-weight: 850; text-transform: uppercase; }
        .cafe-health i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .cafe-health.warning { border-color: #fedf89; color: #b54708; background: #fffaeb; } .cafe-health.critical { border-color: #fecdca; color: #b42318; background: #fef3f2; }
        .cafe-card-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 0 16px; overflow: hidden; border: 1px solid var(--ops-border); border-radius: 14px; background: #f9fafb; }
        .cafe-card-grid > div { min-width: 0; padding: 12px 10px; border-right: 1px solid var(--ops-border); }
        .cafe-card-grid > div:last-child { border-right: 0; }
        .cafe-card-grid small { display: block; color: #98a2b3; font-size: 8.5px; font-weight: 800; text-transform: uppercase; }
        .cafe-card-grid strong { display: block; margin-top: 7px; overflow: hidden; color: var(--ops-ink); font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
        .cafe-card-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 15px 16px 16px; color: #98a2b3; font-size: 9px; }
        .cafe-card-foot span strong { display: block; margin-top: 4px; color: #475467; font-size: 10px; }
        .cafe-card-foot b { color: var(--ops-ink); font-size: 10px; }

        .back { min-height: 38px; margin-bottom: 14px; border: 1px solid #d0d5dd; border-radius: 11px; padding: 0 13px; color: var(--ops-ink); background: #fff; font-size: 11px; font-weight: 800; }
        .selected-cafe-hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 13px; padding: 20px 22px; border-radius: 21px; color: #fff; background: radial-gradient(circle at 90% 0%,rgba(255,90,31,.22),transparent 34%),linear-gradient(125deg,#101828,#243456); box-shadow: 0 16px 36px rgba(16,24,40,.13); }
        .selected-cafe-identity { display: flex; align-items: center; gap: 14px; }
        .selected-cafe-avatar { width: 56px; height: 56px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.11); font-size: 15px; }
        .selected-cafe-hero .section-kicker { color: #ffb494; margin-bottom: 5px; }
        .selected-cafe-hero h3 { margin: 0; font-size: 22px; letter-spacing: -.03em; }
        .selected-cafe-hero p { margin: 4px 0 0; color: #cbd5e1; font-size: 10px; }
        .selected-cafe-health { display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
        .selected-cafe-health small { color: #cbd5e1; font-size: 10px; }
        .cafe-detail-top { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; margin-bottom: 22px; }
        .cafe-detail-top > div { min-height: 104px; padding: 15px; border: 1px solid var(--ops-border); border-radius: 16px; background: #fff; box-shadow: 0 6px 18px rgba(16,24,40,.045); }
        .cafe-detail-top strong { display: block; margin-top: 8px; color: var(--ops-ink); font-size: 21px; }
        .cafe-detail-top > div > span { display: block; margin-top: 5px; color: #98a2b3; font-size: 9.5px; }
        .processing-fee-card { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 22px; padding: 18px 20px; border: 1px solid var(--ops-border); border-radius: 18px; background: #fff; box-shadow: 0 6px 18px rgba(16,24,40,.045); }
        .processing-fee-copy { min-width: 0; }
        .processing-fee-copy .section-kicker { margin-bottom: 5px; }
        .processing-fee-copy h3 { margin: 0; color: var(--ops-ink); font-size: 17px; letter-spacing: -.02em; }
        .processing-fee-copy p { margin: 6px 0 0; color: #667085; font-size: 11px; line-height: 1.5; }
        .processing-fee-control { width: min(100%, 360px); flex-shrink: 0; }
        .processing-fee-control > label { display: block; margin-bottom: 7px; color: #475467; font-size: 9px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
        .processing-fee-actions { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 9px; }
        .processing-fee-input { min-width: 0; height: 43px; display: flex; align-items: center; border: 1px solid #d0d5dd; border-radius: 11px; background: #f9fafb; overflow: hidden; }
        .processing-fee-input:focus-within { border-color: #111827; box-shadow: 0 0 0 3px rgba(255,229,154,.52); }
        .processing-fee-input input { min-width: 0; width: 100%; height: 100%; border: 0; outline: 0; background: transparent; padding: 0 10px; color: #111827; font-size: 14px; font-weight: 800; }
        .processing-fee-input span { padding: 0 11px 0 5px; color: #667085; font-size: 12px; font-weight: 800; }
        .processing-fee-save { min-width: 94px; height: 43px; border: 0; border-radius: 11px; background: #111827; color: #fff; padding: 0 14px; cursor: pointer; font-size: 10.5px; font-weight: 850; }
        .processing-fee-save:hover:not(:disabled) { background: #344054; }
        .processing-fee-save:disabled { cursor: not-allowed; opacity: .55; }
        .order-count-chip { min-height: 29px; padding: 0 11px; border: 1px solid #d0d5dd; border-radius: 999px; color: #344054; background: #fff; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; }
        .cafe-order-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); align-items: start; gap: 14px; }
        .cafe-order-card { min-width: 0; height: 100%; border: 1px solid var(--ops-border); border-radius: 20px; background: #fff; box-shadow: 0 8px 24px rgba(16,24,40,.055); overflow: hidden; position: relative; }
        .cafe-order-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: #98a2b3; }
        .cafe-order-card.cafe-critical::before { background: #f04438; } .cafe-order-card.cafe-open::before { background: #f79009; } .cafe-order-card.cafe-refunded::before, .cafe-order-card.cafe-resolved::before { background: #12b76a; }
        .cafe-order-main { padding: 17px 17px 12px 20px; }
        .cafe-order-head h3 { color: var(--ops-ink); font-size: 15px; }
        .cafe-order-message { min-height: 43px; color: #344054; font-size: 11.5px; font-weight: 650; line-height: 1.5; }
        .cafe-items-box { padding: 9px; }
        .cafe-items-box small { display: block; margin-bottom: 7px; color: #98a2b3; font-size: 8.5px; font-weight: 800; text-transform: uppercase; }
        .cafe-items-box div { display: flex; flex-wrap: wrap; gap: 6px; }

        .empty { grid-column: 1/-1; min-height: 260px; border: 1px dashed #d0d5dd; border-radius: 20px; background: rgba(255,255,255,.8); }
        .skeleton-list { grid-column: 1/-1; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
        .skeleton-card { height: 460px; border-radius: 20px; }

        @media (max-width: 1280px) {
          .stats { grid-template-columns: repeat(3,minmax(0,1fr)); }
          .cafe-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .network-summary { grid-template-columns: 1fr; }
        }
        @media (max-width: 1080px) {
          .ops-hero { grid-template-columns: 1fr; }
          .ops-hero-side { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .list, .cafe-order-list, .skeleton-list { grid-template-columns: 1fr; }
          .matrix-grid, .cafe-order-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .matrix-box:nth-child(4n) { border-right: 1px solid var(--ops-border); }
          .matrix-box:nth-child(2n) { border-right: 0; }
          .matrix-box:nth-last-child(-n+4) { border-bottom: 1px solid var(--ops-border); }
          .matrix-box:nth-last-child(-n+2) { border-bottom: 0; }
        }
        @media (max-width: 900px) {
          .sidebar { width: 86px; padding: 18px 11px; }
          .brand { justify-content: center; padding-inline: 0; }
          .brand > div:last-child, .sidebar-label, .nav-copy, .sidebar-stats, .system { display: none; }
          .nav-btn, .nav-btn:hover, .nav-btn.active { justify-content: center; padding: 10px; }
          .header-actions { max-width: 54%; }
          .search-wrap { width: 100%; }
          .network-summary-grid, .cafe-detail-top { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
        @media (max-width: 680px) {
          .page { display: block; }
          .sidebar { width: 100%; min-height: auto; position: sticky; top: 0; z-index: 20; flex-direction: row; align-items: center; padding: 9px 12px; }
          .brand { padding: 0; } .logo { width: 36px; height: 36px; }
          .sidebar nav { flex: 1; flex-direction: row; justify-content: flex-end; }
          .nav-btn, .nav-btn:hover, .nav-btn.active { width: 44px; min-height: 42px; padding: 4px; }
          .nav-icon { width: 32px; height: 32px; }
          .main { padding: 18px 14px 44px; }
          .header { position: static; margin: -18px -14px 18px; padding: 18px 14px; flex-direction: column; align-items: stretch; }
          .header-actions { max-width: none; justify-content: flex-start; }
          .search-wrap { width: 100%; }
          .ops-hero { padding: 22px 18px; border-radius: 20px; }
          .ops-hero-side, .stats, .cafe-grid, .network-summary-grid, .cafe-detail-top { grid-template-columns: 1fr; }
          .processing-fee-card { align-items: stretch; flex-direction: column; gap: 14px; }
          .processing-fee-control { width: 100%; }
          .queue-toolbar, .cafe-orders-heading, .selected-cafe-hero { align-items: stretch; flex-direction: column; }
          .filters { width: 100%; overflow-x: auto; flex-wrap: nowrap; }
          .selected-cafe-health { align-items: flex-start; }
          .action-buttons { grid-template-columns: 1fr; }
        }


        /* Workspace navigation
           Global selectors are required because NavButton renders
           through a child component inside styled-jsx.
        */

        :global(.sidebar .nav-btn) {
          min-height: 60px;
          padding: 10px 11px;

          border: 1px solid #e4e7ec !important;
          border-radius: 15px;

          background: #ffffff !important;
          color: #111827 !important;

          box-shadow:
            0 3px 10px
            rgba(16, 24, 40, 0.08);

          transform: none;
        }

        :global(.sidebar .nav-btn:hover) {
          border-color: #c9cdd4 !important;
          background: #f8fafc !important;
          color: #111827 !important;

          transform: translateY(-1px);

          box-shadow:
            0 8px 18px
            rgba(16, 24, 40, 0.14);
        }

        :global(.sidebar .nav-btn.active) {
          border-color: #ffe08a !important;
          background: #ffe8a3 !important;
          color: #111827 !important;

          box-shadow:
            0 12px 26px
            rgba(0, 0, 0, 0.22);
        }

        /* Main workspace button title */
        :global(.sidebar .nav-btn .nav-copy strong),
        :global(.sidebar .nav-btn:hover .nav-copy strong),
        :global(.sidebar .nav-btn.active .nav-copy strong) {
          color: #111827 !important;
          font-size: 13px;
          font-weight: 800;
        }

        /* Workspace button subtitle */
        :global(.sidebar .nav-btn .nav-copy small),
        :global(.sidebar .nav-btn:hover .nav-copy small),
        :global(.sidebar .nav-btn.active .nav-copy small) {
          color: #525866 !important;
          font-size: 10px;
          font-weight: 650;
        }

        /* Inactive button icon */
        :global(.sidebar .nav-btn .nav-icon) {
          background: #111827 !important;
          color: #ffffff !important;
        }

        /* Selected button icon */
        :global(.sidebar .nav-btn.active .nav-icon) {
          background:
            linear-gradient(
              145deg,
              #ff6b35,
              #e23b23
            ) !important;

          color: #ffffff !important;

          box-shadow:
            0 7px 16px
            rgba(226, 59, 35, 0.26);
        }

        /* Open-issue number */
        :global(.sidebar .nav-btn .nav-count) {
          background: #e23b23 !important;
          color: #ffffff !important;
        }

        /* Stripe platform funds */
        .revenue-panel {
          margin: 0 0 24px;
          overflow: hidden;
          border: 1px solid #111827;
          border-radius: 24px;
          background: #111827;
          color: white;
          box-shadow:
            0 20px 45px
            rgba(16, 24, 40, 0.16);
        }

        .revenue-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 24px;
          border-bottom:
            1px solid
            rgba(255, 255, 255, 0.1);
        }

        .revenue-kicker {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #ffe59a;
          color: #111827;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .revenue-head h3 {
          margin: 14px 0 4px;
          color: white;
          font-size: 23px;
          letter-spacing: -0.03em;
        }

        .revenue-head p {
          max-width: 620px;
          margin: 0;
          color:
            rgba(255, 255, 255, 0.58);
          font-size: 13px;
          line-height: 1.55;
        }

        .revenue-refresh {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border:
            1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          background:
            rgba(255, 255, 255, 0.08);
          color: white;
          padding: 0 15px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
        }

        .revenue-refresh:hover {
          background:
            rgba(255, 255, 255, 0.13);
        }

        .revenue-metrics {
          display: grid;
          grid-template-columns:
            repeat(5, minmax(0, 1fr));
          gap: 1px;
          background:
            rgba(255, 255, 255, 0.1);
        }

        .revenue-metrics > div {
          background: #111827;
          padding: 18px;
        }

        .revenue-metrics small {
          display: block;
          color:
            rgba(255, 255, 255, 0.46);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .revenue-metrics strong {
          display: block;
          margin-top: 8px;
          color: white;
          font-size: 23px;
          letter-spacing: -0.03em;
        }

        .revenue-metrics span {
          display: block;
          margin-top: 4px;
          color:
            rgba(255, 255, 255, 0.4);
          font-size: 10px;
          font-weight: 600;
        }

        .revenue-metrics .withdrawable {
          background: #1b3429;
        }

        .revenue-metrics .withdrawable strong {
          color: #86efac;
        }

        .revenue-body {
          display: grid;
          grid-template-columns:
            minmax(0, 430px)
            minmax(0, 1fr);
          gap: 20px;
          padding: 24px;
        }

        .withdraw-card {
          border-radius: 19px;
          background: white;
          color: #111827;
          padding: 20px;
        }

        .withdraw-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .withdraw-title small,
        .payout-history-head small {
          display: block;
          color: #667085;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .withdraw-title h4,
        .payout-history-head h4 {
          margin: 4px 0 0;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .withdraw-currency {
          border-radius: 9px;
          background: #f2f4f7;
          padding: 7px 9px;
          color: #344054;
          font-size: 10px;
          font-weight: 800;
        }

        .withdraw-card label {
          display: block;
          margin-top: 20px;
        }

        .withdraw-card label > span {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 750;
        }

        .amount-field {
          height: 56px;
          display: flex;
          align-items: center;
          border: 1px solid #d0d5dd;
          border-radius: 14px;
          background: #f9fafb;
          padding: 0 12px;
        }

        .amount-field:focus-within {
          border-color: #111827;
          box-shadow:
            0 0 0 4px
            rgba(255, 229, 154, 0.5);
        }

        .amount-field b {
          color: #667085;
          font-size: 18px;
        }

        .amount-field input {
          min-width: 0;
          flex: 1;
          height: 100%;
          border: 0;
          background: transparent;
          padding: 0 8px;
          outline: none;
          color: #111827;
          font-size: 20px;
          font-weight: 800;
        }

        .amount-field button {
          border: 0;
          border-radius: 8px;
          background: #eaecf0;
          color: #111827;
          padding: 7px 10px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .withdraw-button {
          width: 100%;
          min-height: 58px;
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 0;
          border-radius: 15px;
          background: #ffe59a;
          color: #111827;
          padding: 12px 16px;
          cursor: pointer;
          text-align: left;
        }

        .withdraw-button:hover {
          background: #ffdc70;
        }

        .withdraw-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .withdraw-button strong {
          display: block;
          font-size: 13px;
        }

        .withdraw-button small {
          display: block;
          margin-top: 2px;
          color: #5d5543;
          font-size: 10px;
        }

        .withdraw-note,
        .revenue-error {
          margin: 12px 0 0;
          font-size: 10px;
          line-height: 1.5;
          font-weight: 600;
        }

        .withdraw-note {
          color: #667085;
        }

        .revenue-error {
          color: #d92d20;
        }

        .payout-history {
          border:
            1px solid
            rgba(255, 255, 255, 0.11);
          border-radius: 19px;
          background:
            rgba(255, 255, 255, 0.05);
          padding: 20px;
        }

        .payout-history-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .payout-history-head h4 {
          color: white;
        }

        .payout-history-head > span {
          min-width: 25px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #ffe59a;
          color: #111827;
          font-size: 10px;
          font-weight: 800;
        }

        .payout-list {
          margin-top: 14px;
          display: grid;
          gap: 8px;
        }

        .payout-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border:
            1px solid
            rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background:
            rgba(0, 0, 0, 0.14);
          padding: 12px;
        }

        .payout-row strong {
          display: block;
          color: white;
          font-size: 14px;
        }

        .payout-row small {
          display: block;
          margin-top: 3px;
          color:
            rgba(255, 255, 255, 0.4);
          font-size: 9px;
        }

        .payout-row > div:last-child {
          text-align: right;
        }

        .payout-row b {
          color: #ffe59a;
          font-size: 10px;
          text-transform: uppercase;
        }

        .payout-empty {
          border:
            1px dashed
            rgba(255, 255, 255, 0.16);
          border-radius: 12px;
          padding: 34px 15px;
          color:
            rgba(255, 255, 255, 0.45);
          text-align: center;
          font-size: 12px;
          font-weight: 650;
        }

        .badge.support {
          background: #eef3ff;
          color: #175cd3;
          border: 1px solid #b2ccff;
        }

        .support-modal {
          max-width: 760px;
          max-height: min(860px, calc(100vh - 40px));
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .support-status-row {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid var(--line);
          border-radius: var(--r-sm);
          background: #f9fafb;
          padding: 9px 11px;
        }

        .support-status-row span {
          color: #175cd3;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .support-status-row small {
          color: var(--muted);
          font-size: 10px;
          font-weight: 650;
        }

        .support-messages {
          min-height: 220px;
          max-height: 430px;
          margin-top: 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid var(--line);
          border-radius: var(--r-md);
          background: #f8fafc;
          padding: 14px;
        }

        .support-message {
          width: min(86%, 560px);
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          padding: 11px 12px;
          box-shadow: var(--shadow-sm);
        }

        .support-message.customer {
          align-self: flex-start;
          border-color: #fecdca;
          background: #fff7f5;
        }

        .support-message.restaurant {
          align-self: flex-end;
          border-color: #b2ddff;
          background: #f5f9ff;
        }

        .support-message-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .support-message-meta strong {
          color: var(--ink);
          font-size: 10.5px;
          font-weight: 800;
        }

        .support-message-meta span {
          color: var(--faint);
          font-size: 9px;
          font-weight: 600;
        }

        .support-message p {
          margin: 6px 0 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          color: var(--body);
          font-size: 13px;
          line-height: 1.55;
        }

        .support-empty {
          margin: auto;
          color: var(--muted);
          font-size: 12px;
          font-weight: 650;
          text-align: center;
        }

        .support-reply {
          min-height: 110px;
          height: 110px;
        }

        .support-reply-count {
          margin-top: 5px;
          color: var(--faint);
          font-size: 9.5px;
          font-weight: 650;
          text-align: right;
        }

        .support-modal-actions {
          flex-wrap: wrap;
        }

        @media (max-width: 1100px) {
          .revenue-metrics {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .revenue-body {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .revenue-head {
            flex-direction: column;
          }

          .revenue-refresh {
            width: 100%;
            justify-content: center;
          }

          .revenue-metrics {
            grid-template-columns: 1fr;
          }

          .revenue-body {
            padding: 16px;
          }

          .payout-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .payout-row > div:last-child {
            text-align: left;
          }
        }

      `}</style>
    </div>
  )
}