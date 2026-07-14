"use client"
import { useEffect, useState } from "react"
import axios from "axios"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

const API = "http://localhost:3001"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           #f7f7f8;
    --surface:      #ffffff;
    --surface2:     #f3f3f5;
    --surface3:     #ebebed;
    --border:       rgba(0,0,0,0.07);
    --border2:      rgba(0,0,0,0.11);
    --text:         #111113;
    --text2:        #60606a;
    --text3:        #a0a0ab;
    --accent:       #5b5bd6;
    --accent-hover: #4f4fc4;
    --accent-light: rgba(91,91,214,0.08);
    --accent-dim:   rgba(91,91,214,0.15);
    --green:        #1a9e5c;
    --green-bg:     rgba(26,158,92,0.08);
    --red:          #d93025;
    --red-bg:       rgba(217,48,37,0.08);
    --amber:        #c47d0e;
    --amber-bg:     rgba(196,125,14,0.08);
    --font:         'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
    --r:            10px;
    --r-sm:         7px;
    --r-lg:         14px;
    --shadow-sm:    0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04);
    --shadow:       0 4px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
  }

  html, body {
    background: var(--bg);
    font-family: var(--font);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    font-size: 14px;
  }

  /* ── LAYOUT ── */
  .wrap {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 220px 1fr;
    grid-template-rows: 48px 1fr;
  }

  /* ── TOPBAR ── */
  .topbar {
    grid-column: 1 / -1;
    height: 48px;
    background: var(--surface);
    border-bottom: 1px solid var(--border2);
    display: flex;
    align-items: center;
    padding: 0 18px;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: -0.4px;
    color: var(--text);
    flex-shrink: 0;
  }

  .logo-mark {
    width: 26px;
    height: 26px;
    background: var(--accent);
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 13px;
  }

  .topbar-sep {
    width: 1px;
    height: 16px;
    background: var(--border2);
  }

  .store-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text2);
    font-weight: 500;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 20px;
    padding: 3px 10px 3px 7px;
  }

  .store-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    flex-shrink: 0;
  }

  .topbar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent-dim);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2px;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border2);
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: calc(100vh - 48px);
    position: sticky;
    top: 48px;
    overflow-y: auto;
  }

  .sidebar-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.7px;
    color: var(--text3);
    text-transform: uppercase;
    padding: 16px 8px 5px;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    border-radius: var(--r-sm);
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    cursor: pointer;
    transition: all 0.1s;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-family: var(--font);
    line-height: 1;
  }

  .sidebar-item:hover { background: var(--surface2); color: var(--text); }

  .sidebar-item.active {
    background: var(--accent-light);
    color: var(--accent);
    font-weight: 600;
  }

  .s-icon {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    background: var(--surface2);
    flex-shrink: 0;
  }

  .sidebar-item.active .s-icon { background: var(--accent-dim); }

  .sidebar-bottom {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  /* ── MAIN ── */
  .main {
    padding: 28px 36px;
    overflow-y: auto;
    max-height: calc(100vh - 48px);
    background: var(--bg);
  }

  /* ── PAGE HEADER ── */
  .ph {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .ph-left {}

  .ph-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: var(--text);
    line-height: 1;
  }

  .ph-sub {
    font-size: 12.5px;
    color: var(--text3);
    margin-top: 4px;
    font-weight: 400;
  }

  /* ── STAT GRID ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r-lg);
    padding: 16px 18px;
    box-shadow: var(--shadow-sm);
  }

  .stat-label {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text3);
    letter-spacing: 0.1px;
    margin-bottom: 8px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -1px;
    color: var(--text);
    line-height: 1;
  }

  .stat-sub {
    font-size: 11px;
    color: var(--text3);
    margin-top: 5px;
  }

  .stat-up { color: var(--green); }
  .stat-dn { color: var(--red); }

  /* ── CARD ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r-lg);
    padding: 20px 22px;
    margin-bottom: 12px;
    box-shadow: var(--shadow-sm);
    transition: .18s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(0,0,0,.08);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.2px;
  }

  .card-sub {
    font-size: 11.5px;
    color: var(--text3);
    margin-top: 2px;
  }

  .card-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--surface2);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  /* ── CHART TOOLTIP ── */
  .custom-tip {
    background: var(--text);
    border-radius: 8px;
    padding: 8px 12px;
    font-family: var(--font);
    font-size: 12px;
    color: white;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }

  .custom-tip-val {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  /* ── TOP ITEMS TABLE ── */
  .items-table {
    width: 100%;
  }

  .items-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid var(--border);
  }

  .items-row:last-child { border-bottom: none; }

  .items-rank {
    width: 20px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text3);
    flex-shrink: 0;
    text-align: center;
  }

  .items-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }

  .items-bar-wrap {
    width: 80px;
    height: 4px;
    background: var(--surface3);
    border-radius: 2px;
    overflow: hidden;
  }

  .items-bar {
    height: 4px;
    background: var(--accent);
    border-radius: 2px;
    opacity: 0.6;
  }

  .items-qty {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    width: 32px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ── ORDERS TABLE ── */
  .orders-table {
    width: 100%;
    border-collapse: collapse;
  }

  .orders-th {
    font-size: 11px;
    font-weight: 600;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 0 10px;
    text-align: left;
    border-bottom: 1px solid var(--border2);
  }

  .orders-th:last-child { text-align: right; }

  .orders-td {
    padding: 10px 0;
    font-size: 13px;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .orders-td:last-child { text-align: right; }

  .orders-tr:last-child .orders-td { border-bottom: none; }

  .order-id {
    font-weight: 600;
    font-family: monospace;
    font-size: 12.5px;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 5px;
    padding: 2px 6px;
    color: var(--text2);
  }

  /* ── STATUS CHIP ── */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1;
  }

  .chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .chip-green  { background: var(--green-bg);  color: var(--green);  }
  .chip-green  .chip-dot { background: var(--green); }
  .chip-amber  { background: var(--amber-bg);  color: var(--amber);  }
  .chip-amber  .chip-dot { background: var(--amber); }
  .chip-red    { background: var(--red-bg);    color: var(--red);    }
  .chip-red    .chip-dot { background: var(--red); }
  .chip-gray   { background: var(--surface3);  color: var(--text2);  }
  .chip-gray   .chip-dot { background: var(--text3); }
  .chip-accent { background: var(--accent-dim); color: var(--accent); }
  .chip-accent .chip-dot { background: var(--accent); }

  /* ── FORM ── */
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .field-grid.one   { grid-template-columns: 1fr; }
  .field-grid.three { grid-template-columns: 1fr 1fr 1fr; }

  .field { display: flex; flex-direction: column; gap: 5px; }

  .field-label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.1px;
  }

  .inp {
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: var(--r-sm);
    padding: 8px 11px;
    font-size: 13.5px;
    color: var(--text);
    font-family: var(--font);
    outline: none;
    transition: all 0.15s;
    width: 100%;
    -webkit-appearance: none;
  }

  .inp:focus {
    border-color: var(--accent);
    background: white;
    box-shadow: 0 0 0 3px var(--accent-light);
  }

  .inp::placeholder { color: var(--text3); }

  .file-zone {
    background: var(--surface2);
    border: 1.5px dashed var(--border2);
    border-radius: var(--r-sm);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 13px;
    color: var(--text3);
  }

  .file-zone:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
  .file-zone.loaded { border-color: var(--green); color: var(--green); background: var(--green-bg); border-style: solid; }
  .file-zone input { display: none; }

  .file-icon {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: white;
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    flex-shrink: 0;
  }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--r-sm);
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    border: none;
    transition: all 0.12s;
    letter-spacing: -0.1px;
    line-height: 1;
  }

  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:active { transform: scale(0.98); }

  .btn-success { background: var(--green); color: white; }
  .btn-success:hover { opacity: .92; }

  .btn-ghost {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border2);
  }
  .btn-ghost:hover { background: var(--surface2); }

  .btn-danger { background: var(--red-bg); color: var(--red); }
  .btn-danger:hover { background: rgba(217,48,37,0.14); }

  .btn-disabled {
    background: var(--surface3);
    color: var(--text3);
    cursor: not-allowed;
  }
  .btn-disabled:hover { background: var(--surface3); }

  .btn-row {
    display: flex;
    gap: 8px;
    margin-top: 18px;
    align-items: center;
    flex-wrap: wrap;
  }

  /* ── INFO TABLE ── */
  .info-tbl { width: 100%; border-collapse: collapse; }
  .info-tr { border-bottom: 1px solid var(--border); }
  .info-tr:last-child { border-bottom: none; }
  .info-td { padding: 10px 0; font-size: 13px; }
  .info-td.lbl { color: var(--text3); width: 42%; font-weight: 400; }
  .info-td.val { color: var(--text); font-weight: 500; }

  /* ── MENU GRID ── */
  .menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }

  .item-card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.15s, transform 0.15s;
  }

  .item-card:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
  .item-card.hidden-item { opacity: 0.38; }

  .item-img {
    width: 100%;
    height: 100px;
    object-fit: cover;
    display: block;
    background: var(--surface2);
  }

  .item-body { padding: 9px 11px 7px; }

  .item-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-price { font-size: 13px; font-weight: 700; color: var(--text); }

  .item-original {
    font-size: 11px;
    color: var(--text3);
    text-decoration: line-through;
    margin-right: 3px;
  }

  .item-disc {
    display: inline-block;
    background: var(--red-bg);
    color: var(--red);
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    margin-left: 3px;
  }

  .item-actions {
    display: flex;
    border-top: 1px solid var(--border);
  }

  .item-btn {
    flex: 1;
    padding: 7px 0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.1s;
    border: none;
    background: transparent;
    color: var(--text2);
  }

  .item-btn:hover { background: var(--surface2); }
  .item-btn + .item-btn { border-left: 1px solid var(--border); color: var(--red); }
  .item-btn + .item-btn:hover { background: var(--red-bg); }

  .cat-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--text3);
    padding: 20px 0 8px;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cat-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border2);
  }

  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--text);
    color: white;
    font-size: 13px;
    font-weight: 500;
    padding: 10px 20px;
    border-radius: 40px;
    z-index: 9999;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    animation: slideUp 0.2s cubic-bezier(0.16,1,0.3,1);
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .toast::before {
    content: '✓';
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--green);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── EMPTY ── */
  .empty {
    text-align: center;
    padding: 60px 0;
    color: var(--text3);
  }

  .empty-icon { font-size: 32px; margin-bottom: 10px; }
  .empty-title { font-size: 13.5px; font-weight: 600; color: var(--text2); }
  .empty-sub { font-size: 12.5px; margin-top: 3px; }

  /* ── DIVIDER ── */
  .divider { height: 1px; background: var(--border); margin: 16px 0; }

  /* ── SECTION INTRO ── */
  .section-intro {
    font-size: 12.5px;
    color: var(--text3);
    line-height: 1.5;
    margin-bottom: 16px;
    padding: 10px 14px;
    background: var(--surface2);
    border-radius: var(--r-sm);
    border-left: 3px solid var(--accent);
  }
`

// Custom tooltip for recharts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tip">
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{label}</div>
      <div className="custom-tip-val">${Number(payload[0].value).toFixed(2)}</div>
    </div>
  )
}

const statusChip = (status: string) => {
  const s = (status || "").toLowerCase()
  const cls = s === "completed" || s === "paid" ? "chip-green"
    : s === "pending" ? "chip-amber"
    : s === "preparing" ? "chip-accent"
    : s === "refunded" ? "chip-red"
    : "chip-gray"
  return (
    <span className={`chip ${cls}`}>
      <span className="chip-dot" />
      {status}
    </span>
  )
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()

  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)

  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  if (hrs < 24) return `${hrs} hr ago`

  return `${days} day ago`
}

const severityChip = (severity: string) => {
  const s = (severity || "INFO").toUpperCase()
  const cls = s === "CRITICAL" ? "chip-red" : s === "WARNING" ? "chip-amber" : "chip-accent"
  return (
    <span className={`chip ${cls}`}>
      <span className="chip-dot" />
      {s}
    </span>
  )
}

const severityBorder = (severity: string) => {
  const s = (severity || "INFO").toUpperCase()
  return s === "CRITICAL" ? "var(--red)" : s === "WARNING" ? "var(--amber)" : "var(--accent)"
}

export default function OwnerPage() {
  const [businessId] = useState(3)
  const [storeCode] = useState("cafe1")

  const [menu, setMenu] = useState<any[]>([])
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("")
  const [file, setFile] = useState<any>(null)
  const [discount, setDiscount] = useState("")
  const [kitchenPass, setKitchenPass] = useState("")
  const [msg, setMsg] = useState("")
  const [serviceFee, setServiceFee] = useState("")
  const [cafeName, setCafeName] = useState("")
  const [logoFile, setLogoFile] = useState<any>(null)
  // Change 7: cover photo state
  const [coverFile, setCoverFile] = useState<any>(null)
  const [kitchenMode, setKitchenMode] = useState("unknown")
  const [activeSection, setActiveSection] = useState("analytics")
  const [toast, setToast] = useState("")
  const [dashboard, setDashboard] = useState<any>(null)
  const [topItems, setTopItems] = useState<any[]>([])
  const [revenueChart, setRevenueChart] = useState<any[]>([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [issueSearch, setIssueSearch] = useState("")
  const [stripeStatus, setStripeStatus] = useState<any>(null)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2800) }

  const enablePasswordless = async () => {
    try {
      await axios.post(`${API}/business/disable-kitchen-password`, { businessId })
      showToast("Passwordless mode enabled")
      setKitchenPass("")
      setKitchenMode("passwordless")
    } catch { showToast("Failed to enable passwordless") }
  }

  const load = async () => {
    try {
      const res = await axios.get(`${API}/menu/${businessId}`)
      setMenu(Array.isArray(res.data) ? res.data.map((i: any) => ({ ...i })) : [])
    } catch { setMenu([]) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const checkMode = async () => {
      try {
        const res = await axios.get(`${API}/public/store/cafe1`)
        setKitchenMode(res.data?.business?.kitchenPassword ? "password" : "passwordless")
      } catch {}
    }
    checkMode()
  }, [])

  const loadAnalytics = async () => {
    try {
      const [dashRes, itemsRes, chartRes, ordersRes] = await Promise.all([
        axios.get(`${API}/analytics/dashboard/${businessId}`),
        axios.get(`${API}/analytics/top-items/${businessId}`),
        axios.get(`${API}/analytics/revenue-chart/${businessId}`),
        axios.get(`${API}/analytics/recent-orders/${businessId}`),
      ])
      setDashboard(dashRes.data)
      setTopItems(itemsRes.data)
      setRevenueChart(chartRes.data)
      setRecentOrders(ordersRes.data)
    } catch (err) { console.error(err) }
  }

  // CHANGE 2: point Action Center loads at the order controller, scoped to this store
  const loadActionCenter = async () => {
    try {
      const res = await axios.get(`${API}/order/action-center/${storeCode}`)
      setIssues(res.data)
    } catch {
      setIssues([])
    }
  }

  const loadStripeStatus = async () => {
    try {
      const res = await axios.get(`${API}/stripe/status?businessId=${businessId}`)
      setStripeStatus(res.data)
    } catch {
      setStripeStatus(null)
    }
  }

  // CHANGE 15: auto-refresh Action Center every 5s, Stripe status every 30s
  useEffect(() => {
    loadAnalytics()
    loadActionCenter()
    loadStripeStatus()

    const actionInterval = setInterval(loadActionCenter, 5000)
    const stripeInterval = setInterval(loadStripeStatus, 30000)

    return () => {
      clearInterval(actionInterval)
      clearInterval(stripeInterval)
    }
  }, [])

  const upload = async () => {
    if (!file) return ""
    try {
      const form = new FormData(); form.append("file", file)
      const res = await axios.post(`${API}/menu/upload`, form)
      return res.data.url
    } catch { return "" }
  }

  const uploadLogo = async () => {
    if (!logoFile) return ""
    try {
      const form = new FormData(); form.append("file", logoFile)
      const res = await axios.post(`${API}/menu/upload`, form)
      return res.data.url
    } catch { return "" }
  }

  // Change 7: cover photo upload helper
  const uploadCover = async () => {
    if (!coverFile) return ""
    try {
      const form = new FormData(); form.append("file", coverFile)
      const res = await axios.post(`${API}/menu/upload`, form)
      return res.data.url
    } catch { return "" }
  }

  const add = async () => {
    if (!name || !price) return setMsg("Name and price are required")
    const imageUrl = await upload()
    await axios.post(`${API}/menu/create`, {
      businessId, name, price: Number(price),
      category: category.trim().toLowerCase(),
      imageUrl, discount: discount ? Number(discount) : 0,
    })
    setName(""); setPrice(""); setCategory(""); setFile(null); setDiscount(""); setMsg("")
    // Change 3: reload analytics after adding item
    showToast("Item added")
    await load()
    await loadAnalytics()
  }

  const saveBranding = async () => {
    const logo = await uploadLogo()
    // Change 7: send coverUrl to branding endpoint
    const coverUrl = await uploadCover()
    await axios.post(`${API}/business/update-branding`, { businessId, name: cafeName, logo, coverUrl })
    showToast("Branding saved")
  }

  // Change 4: reload analytics after deleting item
  const del = (id: any) =>
    axios
      .delete(`${API}/menu/${id}`)
      .then(async () => {
        await load()
        await loadAnalytics()
        showToast("Item removed")
      })

  // Change 5: reload analytics after hiding item
  const hide = (id: any) =>
    axios
      .patch(`${API}/menu/hide/${id}`)
      .then(async () => {
        await load()
        await loadAnalytics()
      })

  const saveKitchen = () => axios.post(`${API}/business/set-kitchen-password`, { businessId, password: kitchenPass }).then(() => showToast("Password saved"))

  const saveServiceFee = async () => {
    try {
      await axios.post(`${API}/business/set-service-fee`, { businessId, fee: Number(serviceFee) })
      showToast("Service fee saved")
    } catch { showToast("Failed to save fee") }
  }

  const connectStripe = async () => {
    try {
      const res = await axios.post(`${API}/stripe/connect`, { businessId })
      await loadStripeStatus()
      window.location.href = res.data.url
    } catch {
      showToast("Stripe connect failed")
    }
  }

  const withdraw = async () => {
    try {
      const res = await axios.get(`${API}/stripe/dashboard?businessId=${businessId}`)
      window.open(res.data.url, "_blank")
    } catch { showToast("Could not open dashboard") }
  }

  // CHANGE 16: confirm before refunding
  const refundIssue = async (issue: any) => {
    if (!confirm("Refund this customer?")) return
    try {
      await axios.patch(`${API}/order/refund/${issue.stripePaymentIntentId}`)
      await loadActionCenter()
      showToast("✅ Customer refunded.")
    } catch {
      showToast("Failed to issue refund")
    }
  }

  // CHANGE 1 + 17: confirm before resolving, hit the order controller with resolvedBy
  const resolveIssue = async (id: any) => {
    if (!confirm("Mark this issue resolved?")) return
    try {
      await axios.patch(`${API}/order/resolve/${id}`, { resolvedBy: "OWNER" })
      await loadActionCenter()
      showToast("✅ Issue resolved.")
    } catch {
      showToast("Failed to resolve issue")
    }
  }

  const grouped = menu.reduce((acc: any, item: any) => {
    const k = item.category || "other"
    if (!acc[k]) acc[k] = []
    acc[k].push(item); return acc
  }, {})

  const maxQty = topItems.length ? Math.max(...topItems.map((i: any) => i.quantitySold)) : 1

  // CHANGE 13/14: search filter across customer, email, action id, payment intent
  // CHANGE 21/22: sort open issues by severity, resolved issues pushed to the bottom
  const filteredIssues = issues
    .filter((issue: any) => {
      if (!issueSearch) return true
      const q = issueSearch.toLowerCase()
      return (
        issue.customerName?.toLowerCase().includes(q) ||
        issue.customerEmail?.toLowerCase().includes(q) ||
        issue.ownerActionId?.toLowerCase().includes(q) ||
        issue.stripePaymentIntentId?.toLowerCase().includes(q)
      )
    })
    .sort((a: any, b: any) => {
      if (!!a.issueResolved !== !!b.issueResolved) return a.issueResolved ? 1 : -1
      const score: any = { CRITICAL: 3, WARNING: 2, INFO: 1 }
      return (score[b.ownerIssueSeverity] || 0) - (score[a.ownerIssueSeverity] || 0)
    })

  // CHANGE 19: quick stats above the cards
  const todayStr = new Date().toDateString()
  const stripeIssueOpen = Boolean(stripeStatus?.issueActive)

  const openCount =
    issues.filter((i: any) => !i.issueResolved).length +
    (stripeIssueOpen ? 1 : 0)

  const criticalCount =
    issues.filter((i: any) => !i.issueResolved && (i.ownerIssueSeverity || "").toUpperCase() === "CRITICAL").length +
    (stripeIssueOpen ? 1 : 0)

  const refundedTodayCount = issues.filter((i: any) => i.status === "REFUNDED" && i.ownerActionCreatedAt && new Date(i.ownerActionCreatedAt).toDateString() === todayStr).length
  const resolvedTodayCount = issues.filter((i: any) => i.issueResolved && i.ownerActionCreatedAt && new Date(i.ownerActionCreatedAt).toDateString() === todayStr).length

  const nav = [
    { id: "analytics", icon: "📈", label: "Analytics" },
    { id: "menu",      icon: "🍽️", label: "Menu" },
    { id: "add",       icon: "＋", label: "Add Item" },
    { id: "kitchen",   icon: "🔑", label: "Kitchen Access" },
    { id: "payments",  icon: "💳", label: "Payments" },

    { id: "action",    icon: "🚨", label: "Action Center" },

    { id: "fee",       icon: "％", label: "Service Fee" },
    { id: "branding",  icon: "✦", label: "Branding" },
  ]

  return (
    <>
      <style>{css}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="wrap">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-mark">🍴</div>
            CaviarQR
          </div>
          <div className="topbar-sep" />
          <div className="store-badge">
            <div className="store-dot" />
            cafe1
          </div>
          <div className="topbar-right">
            <div className="avatar">OW</div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-label">Workspace</div>
          {nav.map(n => (
            <button
              key={n.id}
              className={`sidebar-item${activeSection === n.id ? " active" : ""}`}
              onClick={() => setActiveSection(n.id)}
            >
              <div className="s-icon">{n.icon}</div>
              {n.label}
            </button>
          ))}
        </div>

        {/* MAIN */}
        <div className="main">

          {/* ── ANALYTICS ── */}
          {activeSection === "analytics" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Analytics</div>
                  <div className="ph-sub">Revenue and performance overview</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={loadAnalytics}>↻ Refresh</button>
              </div>

              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Today's Revenue</div>
                  <div className="stat-value">${dashboard?.todayRevenue?.toFixed(2) || "0.00"}</div>
                  <div className="stat-sub">{dashboard?.todayOrders || 0} orders today</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">This Month</div>
                  <div className="stat-value">${dashboard?.monthRevenue?.toFixed(2) || "0.00"}</div>
                  <div className="stat-sub">{dashboard?.monthOrders || 0} orders</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">All Time</div>
                  <div className="stat-value">${dashboard?.allTimeRevenue?.toFixed(2) || "0.00"}</div>
                  <div className="stat-sub">{dashboard?.allTimeOrders || 0} total orders</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg. Order Value</div>
                  <div className="stat-value">${dashboard?.averageOrderValue?.toFixed(2) || "0.00"}</div>
                  <div className="stat-sub">per transaction</div>
                </div>
              </div>

              {/* CHART */}
              <div className="card">
                <div className="card-top">
                  <div>
                    <div className="card-title">Revenue — Last 30 Days</div>
                    <div className="card-sub">Daily totals from completed orders</div>
                  </div>
                  <div className="card-icon-wrap">📊</div>
                </div>
                {/* Change 1: explicit width/height on ResponsiveContainer */}
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#5b5bd6" />
                          <stop offset="100%" stopColor="#8b8beb" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#a0a0ab" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#a0a0ab" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(91,91,214,0.15)", strokeWidth: 1 }} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="url(#lineGrad)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#5b5bd6", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                {/* TOP ITEMS */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-top">
                    <div>
                      <div className="card-title">Top Selling Items</div>
                      <div className="card-sub">By units sold</div>
                    </div>
                    <div className="card-icon-wrap">🏆</div>
                  </div>
                  <div className="items-table">
                    {topItems.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "12px 0" }}>No data yet</div>}
                    {topItems.map((item: any, i: number) => (
                      <div key={item.itemName} className="items-row">
                        <div className="items-rank">{i + 1}</div>
                        <div className="items-name">{item.itemName}</div>
                        <div className="items-bar-wrap">
                          <div className="items-bar" style={{ width: `${(item.quantitySold / maxQty) * 100}%` }} />
                        </div>
                        <div className="items-qty">{item.quantitySold}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RECENT ORDERS */}
                <div className="card" style={{ marginBottom: 0 }}>
                  <div className="card-top">
                    <div>
                      <div className="card-title">Recent Orders</div>
                      <div className="card-sub">Latest transactions</div>
                    </div>
                    <div className="card-icon-wrap">🧾</div>
                  </div>
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th className="orders-th">Order</th>
                        <th className="orders-th">Status</th>
                        <th className="orders-th">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.length === 0 && (
                        <tr><td className="orders-td" colSpan={3} style={{ color: "var(--text3)" }}>No orders yet</td></tr>
                      )}
                      {recentOrders.map((order: any) => (
                        <tr key={order.id} className="orders-tr">
                          <td className="orders-td"><span className="order-id">#{order.id}</span></td>
                          <td className="orders-td">{statusChip(order.status)}</td>
                          <td className="orders-td" style={{ fontWeight: 600 }}>${order.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* ── MENU ── */}
          {activeSection === "menu" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Menu</div>
                  <div className="ph-sub">{menu.length} items across {Object.keys(grouped).length} categories</div>
                </div>
                <button className="btn btn-primary" onClick={() => setActiveSection("add")}>＋ Add Item</button>
              </div>

              {menu.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🍽️</div>
                  <div className="empty-title">No items yet</div>
                  <div className="empty-sub">Add your first item to get started</div>
                </div>
              ) : Object.keys(grouped).map(cat => (
                <div key={cat}>
                  <div className="cat-label">{cat}</div>
                  <div className="menu-grid">
                    {grouped[cat].map((i: any) => (
                      <div key={i.id} className={`item-card${i.isHidden ? " hidden-item" : ""}`}>
                        <img
                          className="item-img"
                          src={i.imageUrl
                            ? (i.imageUrl.startsWith("http") ? i.imageUrl : `${API}${i.imageUrl}`)
                            : "https://via.placeholder.com/200x100?text= "}
                          onError={(e: any) => e.currentTarget.src = "https://via.placeholder.com/200x100?text= "}
                          alt={i.name}
                        />
                        <div className="item-body">
                          <div className="item-name">{i.name}</div>
                          <div>
                            {i.discount > 0 ? (
                              <>
                                <span className="item-original">${i.price}</span>
                                <span className="item-price">${(i.price * (1 - i.discount / 100)).toFixed(2)}</span>
                                <span className="item-disc">{i.discount}%</span>
                              </>
                            ) : (
                              <span className="item-price">${i.price}</span>
                            )}
                          </div>
                        </div>
                        <div className="item-actions">
                          <button className="item-btn" onClick={() => hide(i.id)}>{i.isHidden ? "Show" : "Hide"}</button>
                          <button className="item-btn" onClick={() => del(i.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ADD ITEM ── */}
          {activeSection === "add" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Add Item</div>
                  <div className="ph-sub">New items go live on your store immediately</div>
                </div>
              </div>

              <div className="card" style={{ maxWidth: 560 }}>
                <div className="card-top">
                  <div>
                    <div className="card-title">Item Details</div>
                    <div className="card-sub">Fill in the fields below</div>
                  </div>
                  <div className="card-icon-wrap">📋</div>
                </div>

                <div className="field-grid">
                  <div className="field">
                    <div className="field-label">Name</div>
                    <input type="text" className="inp" placeholder="e.g. Iced Latte" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label">Price ($)</div>
                    <input type="number" className="inp" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <div className="field-label">Category</div>
                    <input type="text" className="inp" placeholder="drinks, food, desserts…" value={category} onChange={e => setCategory(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label">Discount (%)</div>
                    <input type="number" className="inp" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid one">
                  <div className="field">
                    <div className="field-label">Photo</div>
                    <label className={`file-zone${file ? " loaded" : ""}`}>
                      <div className="file-icon">📷</div>
                      <span>{file ? (file as any).name : "Click to upload a photo"}</span>
                      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>

                <div className="btn-row">
                  <button className="btn btn-primary" onClick={add}>Add to Menu</button>
                  {msg && <span style={{ fontSize: 12, color: "var(--red)" }}>{msg}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── KITCHEN ── */}
          {activeSection === "kitchen" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Kitchen Access</div>
                  <div className="ph-sub">Control how kitchen staff sign in</div>
                </div>
                <div className={`chip ${kitchenMode === "passwordless" ? "chip-green" : kitchenMode === "password" ? "chip-amber" : "chip-gray"}`} style={{ padding: "5px 12px" }}>
                  <span className="chip-dot" />
                  {kitchenMode === "password" ? "Password Protected" : kitchenMode === "passwordless" ? "Passwordless" : "Checking…"}
                </div>
              </div>

              <div className="card">
                <div className="card-top">
                  <div>
                    <div className="card-title">Access Modes</div>
                  </div>
                  <div className="card-icon-wrap">📡</div>
                </div>
                <table className="info-tbl">
                  <tbody>
                    <tr className="info-tr">
                      <td className="info-td lbl">Passwordless</td>
                      <td className="info-td val">Instant access — no login required</td>
                    </tr>
                    <tr className="info-tr">
                      <td className="info-td lbl">Password mode</td>
                      <td className="info-td val">Staff must enter a shared password</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ maxWidth: 440 }}>
                <div className="card-top">
                  <div>
                    <div className="card-title">Set Password</div>
                    <div className="card-sub">Leave blank and use Enable Passwordless for instant access</div>
                  </div>
                  <div className="card-icon-wrap">🔑</div>
                </div>
                <div className="field-grid one">
                  <div className="field">
                    <div className="field-label">Kitchen Password</div>
                    <input type="password" className="inp" placeholder="Leave blank for passwordless" value={kitchenPass} onChange={e => setKitchenPass(e.target.value)} />
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={saveKitchen}>Save Password</button>
                  <button className="btn btn-ghost" onClick={enablePasswordless}>Enable Passwordless</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeSection === "payments" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Payments</div>
                  <div className="ph-sub">Stripe Connect and payout management</div>
                </div>
              </div>

              {stripeStatus?.issueActive && (
                <div
                  className="card"
                  style={{
                    maxWidth: 720,
                    borderLeft: "4px solid var(--red)",
                    background: "var(--red-bg)",
                  }}
                >
                  <div className="card-top">
                    <div>
                      <div className="card-title" style={{ color: "var(--red)" }}>
                        ⚠️ Stripe account not fully ready
                      </div>
                      <div className="card-sub">
                        {stripeStatus.message || "Complete Stripe onboarding so charges and payouts work correctly."}
                      </div>
                    </div>
                    {severityChip("CRITICAL")}
                  </div>

                  <table className="info-tbl">
                    <tbody>
                      <tr className="info-tr">
                        <td className="info-td lbl">Charges</td>
                        <td className="info-td val">
                          {stripeStatus.charges_enabled ? "Enabled" : "Not enabled"}
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Payouts</td>
                        <td className="info-td val">
                          {stripeStatus.payouts_enabled ? "Enabled" : "Not enabled"}
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Details Submitted</td>
                        <td className="info-td val">
                          {stripeStatus.details_submitted ? "Yes" : "No"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={connectStripe}>
                      Continue Stripe Setup
                    </button>
                    <button className="btn btn-ghost" onClick={loadStripeStatus}>
                      Refresh Status
                    </button>
                  </div>
                </div>
              )}

              {stripeStatus && !stripeStatus.issueActive && (
                <div
                  className="card"
                  style={{
                    maxWidth: 720,
                    borderLeft: "4px solid var(--green)",
                    background: "var(--green-bg)",
                  }}
                >
                  <div className="card-top">
                    <div>
                      <div className="card-title" style={{ color: "var(--green)" }}>
                        ✅ Stripe account ready
                      </div>
                      <div className="card-sub">
                        Charges, payouts, and account details are ready.
                      </div>
                    </div>
                    {severityChip("INFO")}
                  </div>
                </div>
              )}

              <div className="card" style={{ maxWidth: 520 }}>
                <div className="card-top">
                  <div>
                    <div className="card-title">Stripe Connect</div>
                    <div className="card-sub">Receive payments directly to your bank account</div>
                  </div>
                  <div className="card-icon-wrap">💳</div>
                </div>
                <table className="info-tbl">
                  <tbody>
                    <tr className="info-tr">
                      <td className="info-td lbl">Processor</td>
                      <td className="info-td val">Stripe</td>
                    </tr>
                    <tr className="info-tr">
                      <td className="info-td lbl">Payouts</td>
                      <td className="info-td val">Via Stripe Express dashboard</td>
                    </tr>
                    <tr className="info-tr">
                      <td className="info-td lbl">Fees</td>
                      <td className="info-td val">Stripe standard rates apply</td>
                    </tr>
                  </tbody>
                </table>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={connectStripe}>Connect Stripe</button>
                  <button className="btn btn-ghost" onClick={withdraw}>Open Dashboard ↗</button>
                </div>
              </div>
            </div>
          )}

          {/* ── ACTION CENTER ── */}
          {activeSection === "action" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Action Center</div>
                  <div className="ph-sub">Failed orders and customer issues</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={loadActionCenter}>↻ Refresh</button>
              </div>

              {/* CHANGE 19: stats */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">Open Issues</div>
                  <div className="stat-value">{openCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Critical Issues</div>
                  <div className="stat-value" style={{ color: criticalCount > 0 ? "var(--red)" : "var(--text)" }}>{criticalCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Refunded Today</div>
                  <div className="stat-value">{refundedTodayCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Resolved Today</div>
                  <div className="stat-value" style={{ color: "var(--green)" }}>{resolvedTodayCount}</div>
                </div>
              </div>

              {stripeStatus?.issueActive && (
                <div
                  className="card"
                  style={{
                    borderLeft: "4px solid var(--red)",
                    background: "var(--red-bg)",
                  }}
                >
                  <div className="card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {severityChip("CRITICAL")}
                      <div>
                        <div className="card-title">Stripe Account Issue</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>
                          STORE-STRIPE-{businessId}
                        </div>
                      </div>
                    </div>
                    {statusChip("ACTION_REQUIRED")}
                  </div>

                  <table className="info-tbl">
                    <tbody>
                      <tr className="info-tr">
                        <td className="info-td lbl">Issue</td>
                        <td className="info-td val">
                          {stripeStatus.message || "Stripe account is not fully ready."}
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Charges</td>
                        <td className="info-td val">
                          {stripeStatus.charges_enabled ? "Enabled" : "Not enabled"}
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Payouts</td>
                        <td className="info-td val">
                          {stripeStatus.payouts_enabled ? "Enabled" : "Not enabled"}
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Details Submitted</td>
                        <td className="info-td val">
                          {stripeStatus.details_submitted ? "Yes" : "No"}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={connectStripe}>
                      Continue Stripe Setup
                    </button>
                    <button className="btn btn-ghost" onClick={loadStripeStatus}>
                      Refresh Status
                    </button>
                  </div>
                </div>
              )}

              {/* CHANGE 13: search bar */}
              <input
                className="inp"
                style={{ marginBottom: 14 }}
                placeholder="Search customer, payment, action ID…"
                value={issueSearch}
                onChange={e => setIssueSearch(e.target.value)}
              />

              {/* CHANGE 18: empty state */}
              {filteredIssues.length === 0 && !stripeStatus?.issueActive && (
                <div className="empty" style={{ background: "var(--green-bg)", border: "1px solid var(--border2)", borderRadius: "var(--r-lg)" }}>
                  <div className="empty-icon">✅</div>
                  <div className="empty-title">No active issues</div>
                  <div className="empty-sub">Everything is running smoothly.</div>
                </div>
              )}

              {filteredIssues.map((issue: any) => (
                <div
                  key={issue.id}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${severityBorder(issue.ownerIssueSeverity)}`,
                    opacity: issue.issueResolved ? 0.6 : 1,
                  }}
                >
                  <div className="card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {severityChip(issue.ownerIssueSeverity)}
                      <div>
                        <div className="card-title">Order #{issue.id}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{issue.ownerActionId}</div>
                      </div>
                    </div>
                    {statusChip(issue.status)}
                  </div>

                  <table className="info-tbl">
                    <tbody>
                      <tr className="info-tr">
                        <td className="info-td lbl">Customer</td>
                        <td className="info-td val">
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "var(--accent-light)",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                fontWeight: 700,
                              }}
                            >
                              {(issue.customerName || "?").substring(0, 2).toUpperCase()}
                            </div>
                            {issue.customerName || "Unknown"}
                          </div>
                        </td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Email</td>
                        <td className="info-td val">{issue.customerEmail || "Unknown"}</td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Table</td>
                        <td className="info-td val">{issue.tableNumber ?? "—"}</td>
                      </tr>
                      <tr className="info-tr">
                        <td className="info-td lbl">Created</td>
                        <td className="info-td val">{issue.ownerActionCreatedAt ? timeAgo(issue.ownerActionCreatedAt) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {issue.items?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div className="field-label" style={{ marginBottom: 6 }}>Items</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {issue.items.map((item: any, idx: number) => (
                          <div key={idx} style={{ fontSize: 13 }}>{item.quantity}x {item.name}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CHANGE 5: human-readable issue message, keyed off ownerIssueType */}
                  <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--red)" }}>
                    {issue.ownerIssueType === "SOCKET_EMIT_FAILED"
                      ? "Kitchen never received this paid order."
                      : issue.ownerIssueType === "DATABASE_SAVE_FAILED"
                      ? "The order could not be saved."
                      : issue.ownerIssueType === "INVALID_ORDER_DATA"
                      ? "Customer payment succeeded but order data was corrupted."
                      : issue.ownerIssueType === "ORDER_STUCK_NEW"
                      ? "Order has been stuck in NEW status."
                      : issue.ownerActionMessage || "General issue"}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 42, fontWeight: 800, letterSpacing: -1, color: "var(--green)" }}>
                    ${Number(issue.total || 0).toFixed(2)}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all", color: "var(--text2)" }}>
                      {issue.stripePaymentIntentId}
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "3px 8px", fontSize: 11 }}
                      onClick={() => {
                        navigator.clipboard.writeText(issue.stripePaymentIntentId)
                        showToast("Payment ID copied")
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>

                  <div className="btn-row">
                    {issue.status === "REFUNDED" ? (
                      <button className="btn btn-disabled" disabled>✓ Refunded</button>
                    ) : (
                      <button className="btn btn-danger" onClick={() => refundIssue(issue)}>Refund Customer</button>
                    )}

                    {issue.issueResolved ? (
                      <button className="btn btn-disabled" disabled>✓ Resolved</button>
                    ) : (
                      <button className="btn btn-success" onClick={() => resolveIssue(issue.id)}>Mark Resolved</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SERVICE FEE ── */}
          {activeSection === "fee" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Service Fee</div>
                  <div className="ph-sub">Added to every order at checkout</div>
                </div>
              </div>

              <div className="card" style={{ maxWidth: 380 }}>
                <div className="card-top">
                  <div>
                    <div className="card-title">Fee Configuration</div>
                    <div className="card-sub">Applied as a percentage of each order subtotal</div>
                  </div>
                  <div className="card-icon-wrap">％</div>
                </div>
                <div className="field-grid one">
                  <div className="field">
                    <div className="field-label">Percentage</div>
                    <input type="number" className="inp" placeholder="e.g. 5" value={serviceFee} onChange={e => setServiceFee(e.target.value)} />
                  </div>
                </div>
                {serviceFee && (
                  <div className="section-intro" style={{ marginTop: 10, marginBottom: 0 }}>
                    A <strong>{serviceFee}%</strong> fee will be added to every order total.
                  </div>
                )}
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={saveServiceFee}>Save Fee</button>
                </div>
              </div>
            </div>
          )}

          {/* ── BRANDING ── */}
          {activeSection === "branding" && (
            <div>
              <div className="ph">
                <div className="ph-left">
                  <div className="ph-title">Branding</div>
                  <div className="ph-sub">Name and logo shown to your customers</div>
                </div>
              </div>

              <div className="card" style={{ maxWidth: 480 }}>
                <div className="card-top">
                  <div>
                    <div className="card-title">Store Identity</div>
                    <div className="card-sub">Displayed on your public menu page</div>
                  </div>
                  <div className="card-icon-wrap">✦</div>
                </div>
                <div className="field-grid one">
                  <div className="field">
                    <div className="field-label">Cafe Name</div>
                    <input type="text" className="inp" placeholder="e.g. Barista Coffee" value={cafeName} onChange={e => setCafeName(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid one" style={{ marginTop: 10 }}>
                  <div className="field">
                    <div className="field-label">Logo</div>
                    <label className={`file-zone${logoFile ? " loaded" : ""}`}>
                      <div className="file-icon">🖼️</div>
                      <span>{logoFile ? (logoFile as any).name : "Click to upload logo"}</span>
                      <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                {/* Change 7: cover photo upload field */}
                <div className="field-grid one" style={{ marginTop: 10 }}>
                  <div className="field">
                    <div className="field-label">Cover Photo</div>
                    <label className={`file-zone${coverFile ? " loaded" : ""}`}>
                      <div className="file-icon">🏞️</div>
                      <span>{coverFile ? (coverFile as any).name : "Click to upload cover photo"}</span>
                      <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={saveBranding}>Save Branding</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}