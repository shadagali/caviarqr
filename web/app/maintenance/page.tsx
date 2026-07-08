'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type View = 'qr' | 'cafes'

type Cafe = {
  storeCode: string
  cafeName: string
  ordersToday: number
  revenueToday: number
}

type Order = {
  id: string | number
  storeCode: string
  tableNumber: number
  total: number
  status: string
  customerName?: string
  customerEmail?: string
  stripePaymentIntentId?: string
  issueType?: string | null
  issueResolved?: boolean
  failedChecks?: string[]
}

type TableLink = {
  table: number
  link: string
  qrDataUrl: string
}

// The 16 things that are checked on every order to decide if it is "down"
const HEALTH_CHECKS = [
  'Store exists',
  'Menu exists',
  'Table exists',
  'Checkout created',
  'Stripe session created',
  'Payment completed',
  'Webhook received',
  'Order created',
  'Saved to database',
  'Kitchen received order',
  'Kitchen accepted order',
  'Receipt generated',
  'Analytics updated',
  'Customer notified',
  'Order completed',
  'Refund processed (if requested)',
]

function isOrderDown(order: Order): boolean {
  if (order.failedChecks && order.failedChecks.length > 0) return true
  if (order.issueType && !order.issueResolved) return true
  if (order.status === 'failed' || order.status === 'payment_failed') return true
  return false
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function MaintenancePage() {
  const [view, setView] = useState<View>('cafes')
  const [backendOnline, setBackendOnline] = useState(true)
  const [backendError, setBackendError] = useState('')

  // ---------------- QR GENERATOR ----------------
  const [qrStoreCode, setQrStoreCode] = useState('')
  const [qrTableCount, setQrTableCount] = useState(50)
  const [tableLinks, setTableLinks] = useState<TableLink[]>([])
  const [generating, setGenerating] = useState(false)

  // ---------------- CAFES ----------------
  const [cafes, setCafes] = useState<Cafe[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [cafeOrders, setCafeOrders] = useState<Record<string, Order[]>>({})
  const [loadingCafes, setLoadingCafes] = useState(false)
  const [selectedCafe, setSelectedCafe] = useState<string | null>(null)
  const [showOrders, setShowOrders] = useState(false)
  const [refundingId, setRefundingId] = useState<string | number | null>(null)

  async function pingBackend() {
    try {
      const res = await apiFetch(`${API}/maintenance/dashboard`, {})
      if (res && res.success !== false) {
        setBackendOnline(true)
        setBackendError('')
      } else {
        setBackendOnline(false)
        setBackendError('Backend responded with an error.')
      }
    } catch {
      setBackendOnline(false)
      setBackendError('Cannot reach the backend server.')
    }
  }

  async function loadCafes() {
    setLoadingCafes(true)
    try {
      const storesRes = await apiFetch(`${API}/maintenance/stores`, {})
      const codes: string[] = storesRes?.stores || []
      const dashRes = await apiFetch(`${API}/maintenance/dashboard`, {})
      const orders: Order[] = dashRes?.recentOrders || []
      setRecentOrders(orders)

      const built: Cafe[] = codes.map((code) => {
        const ordersForCafe = orders.filter((o) => o.storeCode === code)
        const revenue = ordersForCafe.reduce((sum, o) => sum + Number(o.total || 0), 0)
        return {
          storeCode: code,
          cafeName: code,
          ordersToday: ordersForCafe.length,
          revenueToday: revenue,
        }
      })
      setCafes(built)
      setBackendOnline(true)
      setBackendError('')
    } catch {
      setBackendOnline(false)
      setBackendError('Cannot reach the backend server.')
    } finally {
      setLoadingCafes(false)
    }
  }

  async function loadOrdersForCafe(storeCode: string) {
    try {
      const res = await apiFetch(`${API}/maintenance/orders/${storeCode}`, {})
      const orders: Order[] = res?.orders || []
      setCafeOrders((prev) => ({ ...prev, [storeCode]: orders }))
    } catch {
      setCafeOrders((prev) => ({ ...prev, [storeCode]: [] }))
    }
  }

  useEffect(() => {
    pingBackend()
    loadCafes()
    const timer = setInterval(() => {
      pingBackend()
      loadCafes()
      setSelectedCafe((current) => {
        if (current) loadOrdersForCafe(current)
        return current
      })
    }, 10000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCafe(storeCode: string) {
    setSelectedCafe(storeCode)
    setShowOrders(false)
    if (!cafeOrders[storeCode]) loadOrdersForCafe(storeCode)
  }

  function closeCafe() {
    setSelectedCafe(null)
    setShowOrders(false)
    setView('cafes')
  }

  async function refundOrder(order: Order) {
    if (!order.stripePaymentIntentId) {
      alert('No Stripe payment intent on file for this order.')
      return
    }
    if (!confirm(`Refund order #${order.id} for $${Number(order.total).toFixed(2)}?`)) return
    setRefundingId(order.id)
    try {
      await apiFetch(`${API}/order/refund/${order.stripePaymentIntentId}`, { method: 'PATCH' })
      if (selectedCafe) await loadOrdersForCafe(selectedCafe)
    } catch {
      alert(`Refund failed for order #${order.id}.`)
    } finally {
      setRefundingId(null)
    }
  }

  const selectedCafeIsDown = useMemo(() => {
    if (!selectedCafe) return false
    const orders = cafeOrders[selectedCafe] || []
    return orders.some((o) => isOrderDown(o))
  }, [selectedCafe, cafeOrders])

  const sortedOrders = useMemo(() => {
    if (!selectedCafe) return []
    const orders = cafeOrders[selectedCafe] || []
    return [...orders].sort((a, b) => (isOrderDown(b) ? 1 : 0) - (isOrderDown(a) ? 1 : 0))
  }, [selectedCafe, cafeOrders])

  // ---------------- QR GENERATOR LOGIC ----------------
  async function generateQrCodes() {
    if (!qrStoreCode.trim() || qrTableCount < 1) return
    setGenerating(true)
    setTableLinks([])
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://caviarqr.com'
      const results: TableLink[] = []
      for (let i = 1; i <= qrTableCount; i++) {
        const link = `${baseUrl}/store/${qrStoreCode.trim()}?table=${i}`
        const qrDataUrl = await QRCode.toDataURL(link, { width: 300, margin: 1 })
        results.push({ table: i, link, qrDataUrl })
      }
      setTableLinks(results)
    } catch {
      alert('Failed to generate QR codes.')
    } finally {
      setGenerating(false)
    }
  }

  // Uses the browser's native print dialog ("Save as PDF") instead of a PDF
  // library, so there are no server-bundling issues in Next.js.
  function exportPdf() {
    if (tableLinks.length === 0) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow pop-ups for this site to export the PDF.')
      return
    }

    const cells = tableLinks
      .map(
        (t) => `
          <div class="cell">
            <img src="${t.qrDataUrl}" alt="Table ${t.table} QR" />
            <div class="label">Table ${t.table}</div>
            <div class="link">${escapeHtml(t.link)}</div>
          </div>
        `,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(qrStoreCode.trim())} - Table QR Codes</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; }
      h1 { font-size: 16px; margin: 0 0 16px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .cell {
        text-align: center;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .cell img { width: 160px; height: 160px; }
      .label { font-weight: 600; margin-top: 8px; font-size: 13px; }
      .link { font-size: 9px; color: #555; word-break: break-all; margin-top: 4px; }
      @media print {
        h1 { display: none; }
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(qrStoreCode.trim())} - Table QR Codes (${tableLinks.length} tables)</h1>
    <div class="grid">${cells}</div>
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#14172c] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white text-sm font-bold text-[#14172c]">
              CQ
            </div>
            <span className="text-lg font-semibold tracking-tight">CaviarQR Ops</span>
          </div>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setView('qr')}
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                view === 'qr' ? 'bg-white text-[#14172c]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              QR Generator
            </button>
            <button
              onClick={closeCafe}
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                view === 'cafes' ? 'bg-white text-[#14172c]' : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              Cafes
            </button>
          </nav>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              backendOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {backendOnline ? 'SYSTEM OK' : 'SYSTEM ERROR'}
          </div>
        </div>
      </header>

      {!backendOnline && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-center text-sm font-medium text-red-700">
          {backendError || 'Cannot reach the backend server.'}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ================= QR GENERATOR ================= */}
        {view === 'qr' && (
          <div className="space-y-6">
            <div className="rounded border border-zinc-300 bg-white p-6">
              <h2 className="mb-4 text-base font-semibold text-zinc-900">Generate table QR codes</h2>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Store code
                  </label>
                  <input
                    value={qrStoreCode}
                    onChange={(e) => setQrStoreCode(e.target.value)}
                    placeholder="cafe1"
                    className="h-10 w-48 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-[#14172c]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Number of tables
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={qrTableCount}
                    onChange={(e) => setQrTableCount(Number(e.target.value))}
                    className="h-10 w-32 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-[#14172c]"
                  />
                </div>
                <button
                  onClick={generateQrCodes}
                  disabled={!qrStoreCode.trim() || qrTableCount < 1 || generating}
                  className="h-10 rounded bg-[#14172c] px-6 text-sm font-medium text-white transition hover:bg-[#242849] disabled:opacity-40"
                >
                  {generating ? 'Generating…' : 'Generate'}
                </button>
                {tableLinks.length > 0 && (
                  <button
                    onClick={exportPdf}
                    className="h-10 rounded border border-[#14172c] px-6 text-sm font-medium text-[#14172c] transition hover:bg-zinc-100"
                  >
                    Export PDF
                  </button>
                )}
              </div>
            </div>

            {tableLinks.length > 0 && (
              <div className="rounded border border-zinc-300 bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold text-zinc-900">
                  {tableLinks.length} table links for {qrStoreCode}
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {tableLinks.map((t) => (
                    <div key={t.table} className="rounded border border-zinc-200 p-3 text-center">
                      <img src={t.qrDataUrl} alt={`Table ${t.table} QR`} className="mx-auto h-28 w-28" />
                      <div className="mt-2 text-sm font-semibold text-zinc-900">Table {t.table}</div>
                      <div className="mt-1 truncate text-xs text-zinc-500" title={t.link}>
                        {t.link}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= CAFES LIST ================= */}
        {view === 'cafes' && !selectedCafe && (
          <div className="rounded border border-zinc-300 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">All cafes</h2>
              {loadingCafes && <span className="text-xs text-zinc-400">Refreshing…</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-6 py-3">Store code</th>
                  <th className="px-6 py-3">Cafe name</th>
                  <th className="px-6 py-3 text-right">Orders today</th>
                  <th className="px-6 py-3 text-right">Revenue today</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cafes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">
                      No cafes found.
                    </td>
                  </tr>
                )}
                {cafes.map((c) => {
                  const storeOrders = recentOrders.filter((o) => o.storeCode === c.storeCode)
                  const down = storeOrders.some((o) => isOrderDown(o))
                  return (
                    <tr
                      key={c.storeCode}
                      onClick={() => openCafe(c.storeCode)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-6 py-3 font-mono text-zinc-900">{c.storeCode}</td>
                      <td className="px-6 py-3 text-zinc-700">{c.cafeName}</td>
                      <td className="px-6 py-3 text-right font-mono">{c.ordersToday}</td>
                      <td className="px-6 py-3 text-right font-mono">${c.revenueToday.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                            down ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${down ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {down ? 'DOWN' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= CAFE DETAIL ================= */}
        {view === 'cafes' && selectedCafe && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded border border-zinc-300 bg-white p-6">
              <div>
                <button
                  onClick={() => setSelectedCafe(null)}
                  className="mb-2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  ← Back to all cafes
                </button>
                <h2 className="text-lg font-semibold text-zinc-900">{selectedCafe}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    selectedCafeIsDown ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${selectedCafeIsDown ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {selectedCafeIsDown ? 'DOWN' : 'OK'}
                </span>
                <button
                  onClick={() => setShowOrders((v) => !v)}
                  className="rounded bg-[#14172c] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#242849]"
                >
                  {showOrders ? 'Hide orders' : 'Orders'}
                </button>
              </div>
            </div>

            {showOrders && (
              <div className="rounded border border-zinc-300 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <th className="px-6 py-3">Order</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Health</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-zinc-400">
                          No orders yet.
                        </td>
                      </tr>
                    )}
                    {sortedOrders.map((o) => {
                      const down = isOrderDown(o)
                      return (
                        <tr key={o.id} className={down ? 'bg-red-50/50' : ''}>
                          <td className="px-6 py-3 font-mono text-zinc-900">#{o.id}</td>
                          <td className="px-6 py-3 text-zinc-700">{o.customerName || '—'}</td>
                          <td className="px-6 py-3 text-zinc-700">{o.customerEmail || '—'}</td>
                          <td className="px-6 py-3 text-right font-mono">${Number(o.total).toFixed(2)}</td>
                          <td className="px-6 py-3 text-zinc-700">{o.status}</td>
                          <td className="px-6 py-3">
                            {down ? (
                              <span className="text-xs font-semibold text-red-600">⚠ Please refund ASAP</span>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-600">✓ OK</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => refundOrder(o)}
                              disabled={refundingId === o.id}
                              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium transition hover:bg-zinc-100 disabled:opacity-40"
                            >
                              {refundingId === o.id ? 'Refunding…' : 'Refund'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <details className="border-t border-zinc-100 px-6 py-3 text-xs text-zinc-500">
                  <summary className="cursor-pointer font-medium">What does "Health" check?</summary>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {HEALTH_CHECKS.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}