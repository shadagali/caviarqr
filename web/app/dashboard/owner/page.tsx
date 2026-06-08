"use client"
import { useEffect, useState } from "react"
import axios from "axios"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f5f5f7;
    --bg2: #ffffff;
    --surface: #ffffff;
    --surface2: #f5f5f7;
    --surface3: #e8e8ed;
    --border: rgba(0,0,0,0.08);
    --border2: rgba(0,0,0,0.12);
    --text: #1d1d1f;
    --text2: #6e6e73;
    --text3: #aeaeb2;
    --accent: #0071e3;
    --accent-hover: #0077ed;
    --accent-light: rgba(0,113,227,0.08);
    --green: #34c759;
    --green-light: rgba(52,199,89,0.1);
    --red: #ff3b30;
    --red-light: rgba(255,59,48,0.1);
    --amber: #ff9f0a;
    --amber-light: rgba(255,159,10,0.1);
    --font: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --radius: 12px;
    --radius-sm: 8px;
    --radius-lg: 16px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
    --shadow-md: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
  }

  html, body { background: var(--bg); font-family: var(--font); color: var(--text); -webkit-font-smoothing: antialiased; }

  /* ── LAYOUT ── */
  .owner-wrap {
    min-height: 100vh;
    background: var(--bg);
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: 52px 1fr;
  }

  /* ── TOPBAR ── */
  .topbar {
    grid-column: 1 / -1;
    height: 52px;
    background: rgba(255,255,255,0.82);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 14px;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .topbar-logo {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.3px;
    color: var(--text);
  }

  .topbar-logo-mark {
    width: 28px;
    height: 28px;
    background: var(--text);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
  }

  .topbar-divider {
    width: 1px;
    height: 18px;
    background: var(--border2);
  }

  .topbar-store {
    font-size: 13px;
    color: var(--text2);
    font-weight: 500;
  }

  .topbar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .topbar-pill {
    background: var(--green-light);
    color: var(--green);
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .topbar-pill::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--green);
  }

  .topbar-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--surface3);
    border: 1px solid var(--border2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--text2);
    font-weight: 600;
    letter-spacing: 0;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(10px);
    border-right: 1px solid var(--border);
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: calc(100vh - 52px);
    position: sticky;
    top: 52px;
    overflow-y: auto;
  }

  .sidebar-section {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text3);
    text-transform: uppercase;
    padding: 14px 10px 5px;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text2);
    cursor: pointer;
    transition: all 0.12s ease;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-family: var(--font);
  }

  .sidebar-item:hover {
    background: var(--surface3);
    color: var(--text);
  }

  .sidebar-item.active {
    background: var(--accent-light);
    color: var(--accent);
    font-weight: 600;
  }

  .sidebar-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    background: var(--surface3);
    flex-shrink: 0;
    transition: background 0.12s;
  }

  .sidebar-item.active .sidebar-icon {
    background: var(--accent-light);
  }

  /* ── MAIN ── */
  .main {
    padding: 32px 40px;
    overflow-y: auto;
    max-height: calc(100vh - 52px);
  }

  .page-header {
    margin-bottom: 28px;
  }

  .page-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.6px;
    color: var(--text);
    line-height: 1.1;
  }

  .page-sub {
    font-size: 13.5px;
    color: var(--text2);
    margin-top: 4px;
    font-weight: 400;
  }

  /* ── CARDS ── */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 22px 24px;
    margin-bottom: 14px;
    box-shadow: var(--shadow-sm);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
  }

  .card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.2px;
  }

  .card-sub {
    font-size: 12px;
    color: var(--text3);
    margin-top: 1px;
  }

  /* ── FORM ── */
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .field-grid.one { grid-template-columns: 1fr; }
  .field-grid.three { grid-template-columns: 1fr 1fr 1fr; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.1px;
  }

  .inp {
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: var(--radius-sm);
    padding: 9px 13px;
    font-size: 14px;
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
    box-shadow: 0 0 0 3px rgba(0,113,227,0.12);
  }

  .inp::placeholder { color: var(--text3); }

  .file-zone {
    background: var(--surface2);
    border: 1.5px dashed var(--border2);
    border-radius: var(--radius-sm);
    padding: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 13px;
    color: var(--text3);
  }

  .file-zone:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
  .file-zone.loaded { border-color: var(--green); color: var(--green); background: var(--green-light); border-style: solid; }
  .file-zone input { display: none; }

  .file-zone-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: white;
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: var(--radius-sm);
    font-size: 13.5px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    letter-spacing: -0.1px;
  }

  .btn-blue {
    background: var(--accent);
    color: white;
  }
  .btn-blue:hover { background: var(--accent-hover); }
  .btn-blue:active { transform: scale(0.98); }

  .btn-ghost {
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border2);
  }
  .btn-ghost:hover { background: var(--surface3); }

  .btn-red {
    background: var(--red-light);
    color: var(--red);
  }
  .btn-red:hover { background: rgba(255,59,48,0.16); }

  .btn-green {
    background: var(--green-light);
    color: var(--green);
  }

  .btn-row {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ── STATUS ── */
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .chip-green { background: var(--green-light); color: var(--green); }
  .chip-green .chip-dot { background: var(--green); }
  .chip-amber { background: var(--amber-light); color: var(--amber); }
  .chip-amber .chip-dot { background: var(--amber); }
  .chip-gray { background: var(--surface3); color: var(--text2); }
  .chip-gray .chip-dot { background: var(--text3); }

  /* ── MENU ITEMS ── */
  .menu-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }

  .item-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.15s, transform 0.15s;
  }

  .item-card:hover {
    box-shadow: var(--shadow);
    transform: translateY(-1px);
  }

  .item-card.hidden-item { opacity: 0.4; }

  .item-img {
    width: 100%;
    height: 106px;
    object-fit: cover;
    display: block;
    background: var(--surface2);
  }

  .item-body { padding: 10px 12px 8px; }

  .item-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-price {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .item-original {
    font-size: 11.5px;
    color: var(--text3);
    text-decoration: line-through;
    margin-right: 4px;
  }

  .item-disc {
    display: inline-block;
    background: var(--red-light);
    color: var(--red);
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    margin-left: 3px;
  }

  .item-actions {
    display: flex;
    gap: 0;
    border-top: 1px solid var(--border);
  }

  .item-btn {
    flex: 1;
    padding: 7px 0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    transition: background 0.12s;
    border: none;
    background: white;
    color: var(--text2);
  }

  .item-btn:hover { background: var(--surface2); }
  .item-btn + .item-btn { border-left: 1px solid var(--border); color: var(--red); }
  .item-btn + .item-btn:hover { background: var(--red-light); }

  .cat-row {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text3);
    padding: 20px 0 8px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
  }

  /* ── INFO TABLE ── */
  .info-table { width: 100%; border-collapse: collapse; }
  .info-row-tr { border-bottom: 1px solid var(--border); }
  .info-row-tr:last-child { border-bottom: none; }
  .info-td { padding: 11px 0; font-size: 13.5px; }
  .info-td.label { color: var(--text2); width: 44%; font-weight: 400; }
  .info-td.val { color: var(--text); font-weight: 500; }

  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(29,29,31,0.92);
    backdrop-filter: blur(12px);
    color: white;
    font-size: 13.5px;
    font-weight: 500;
    padding: 11px 22px;
    border-radius: 40px;
    z-index: 9999;
    white-space: nowrap;
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
    animation: fadeUp 0.22s ease;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── EMPTY STATE ── */
  .empty {
    text-align: center;
    padding: 64px 0;
    color: var(--text3);
  }

  .empty-icon { font-size: 36px; margin-bottom: 12px; }
  .empty-text { font-size: 14px; font-weight: 500; }
  .empty-sub { font-size: 13px; margin-top: 4px; }
`

export default function OwnerPage() {
  const [businessId] = useState(3)
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
  const [kitchenMode, setKitchenMode] = useState("unknown")
  const [activeSection, setActiveSection] = useState("menu")
  const [toast, setToast] = useState("")

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(""), 2600)
  }

  const enablePasswordless = async () => {
    try {
      await axios.post("http://localhost:3001/business/disable-kitchen-password", { businessId })
      showToast("Passwordless mode enabled")
      setKitchenPass("")
      setKitchenMode("passwordless")
    } catch {
      showToast("Failed to enable passwordless")
    }
  }

  const load = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/menu/${businessId}`)
      setMenu(Array.isArray(res.data) ? res.data.map((i: any) => ({ ...i })) : [])
    } catch { setMenu([]) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const checkMode = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/public/store/cafe1`)
        setKitchenMode(res.data?.business?.kitchenPassword ? "password" : "passwordless")
      } catch {}
    }
    checkMode()
  }, [])

  const upload = async () => {
    if (!file) return ""
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await axios.post("http://localhost:3001/menu/upload", form)
      return res.data.url
    } catch { return "" }
  }

  const uploadLogo = async () => {
    if (!logoFile) return ""
    try {
      const form = new FormData()
      form.append("file", logoFile)
      const res = await axios.post("http://localhost:3001/menu/upload", form)
      return res.data.url
    } catch { return "" }
  }

  const add = async () => {
    if (!name || !price) return setMsg("Enter name and price")
    const imageUrl = await upload()
    await axios.post("http://localhost:3001/menu/create", {
      businessId, name, price: Number(price),
      category: category.trim().toLowerCase(),
      imageUrl, discount: discount ? Number(discount) : 0,
    })
    setName(""); setPrice(""); setCategory(""); setFile(null); setDiscount(""); setMsg("")
    showToast("Item added to menu")
    await load()
  }

  const saveBranding = async () => {
    const logo = await uploadLogo()
    await axios.post("http://localhost:3001/business/update-branding", { businessId, name: cafeName, logo })
    showToast("Branding saved")
  }

  const del = (id: any) => {
    axios.delete(`http://localhost:3001/menu/${id}`).then(() => { load(); showToast("Item removed") })
  }

  const hide = (id: any) => { axios.patch(`http://localhost:3001/menu/hide/${id}`).then(load) }

  const saveKitchen = () => {
    axios.post("http://localhost:3001/business/set-kitchen-password", { businessId, password: kitchenPass })
      .then(() => showToast("Password saved"))
  }

  const saveServiceFee = async () => {
    try {
      await axios.post("http://localhost:3001/business/set-service-fee", { businessId, fee: Number(serviceFee) })
      showToast("Service fee saved")
    } catch { showToast("Failed to save fee") }
  }

  const connectStripe = async () => {
    try {
      const res = await axios.post("http://localhost:3001/stripe/connect", { businessId })
      window.location.href = res.data.url
    } catch { showToast("Stripe connect failed") }
  }

  const withdraw = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/stripe/dashboard?businessId=${businessId}`)
      window.open(res.data.url, "_blank")
    } catch { showToast("Could not open dashboard") }
  }

  const grouped = menu.reduce((acc: any, item: any) => {
    const key = item.category || "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const nav = [
    { id: "menu",     icon: "🍽️", label: "Menu" },
    { id: "add",      icon: "✚",  label: "Add Item" },
    { id: "kitchen",  icon: "🔑", label: "Kitchen Access" },
    { id: "payments", icon: "💳", label: "Payments" },
    { id: "fee",      icon: "％", label: "Service Fee" },
    { id: "branding", icon: "✦",  label: "Branding" },
  ]

  return (
    <>
      <style>{css}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="owner-wrap">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-logo">
            <div className="topbar-logo-mark">🍴</div>
            CaviarQR
          </div>
          <div className="topbar-divider" />
          <div className="topbar-store">cafe1</div>
          <div className="topbar-right">
            <div className="topbar-pill">Active</div>
            <div className="topbar-avatar">OW</div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-section">Overview</div>
          {nav.map(n => (
            <button
              key={n.id}
              className={`sidebar-item${activeSection === n.id ? " active" : ""}`}
              onClick={() => setActiveSection(n.id)}
            >
              <div className="sidebar-icon">{n.icon}</div>
              {n.label}
            </button>
          ))}
        </div>

        {/* MAIN */}
        <div className="main">

          {/* ── MENU ── */}
          {activeSection === "menu" && (
            <div>
              <div className="page-header">
                <div className="page-title">Menu</div>
                <div className="page-sub">{menu.length} items · {Object.keys(grouped).length} categories</div>
              </div>

              {menu.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🍽️</div>
                  <div className="empty-text">No items yet</div>
                  <div className="empty-sub">Add your first item from the sidebar</div>
                </div>
              ) : Object.keys(grouped).map(cat => (
                <div key={cat}>
                  <div className="cat-row">{cat}</div>
                  <div className="menu-grid">
                    {grouped[cat].map((i: any) => (
                      <div key={i.id} className={`item-card${i.isHidden ? " hidden-item" : ""}`}>
                        <img
                          className="item-img"
                          src={i.imageUrl
                            ? (i.imageUrl.startsWith("http") ? i.imageUrl : `http://localhost:3001${i.imageUrl}`)
                            : "https://via.placeholder.com/200x106?text= "}
                          onError={(e: any) => e.currentTarget.src = "https://via.placeholder.com/200x106?text= "}
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
                          <button className="item-btn" onClick={() => hide(i.id)}>
                            {i.isHidden ? "Show" : "Hide"}
                          </button>
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
              <div className="page-header">
                <div className="page-title">Add Item</div>
                <div className="page-sub">New items appear on your store immediately</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">📋</div>
                  <div>
                    <div className="card-title">Item Details</div>
                    <div className="card-sub">Fill in the basics</div>
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <div className="field-label">Name</div>
                    <input type="text" className="inp" placeholder="e.g. Iced Latte" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label">Price</div>
                    <input type="number" className="inp" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <div className="field-label">Category</div>
                    <input type="text" className="inp" placeholder="food, drinks, desserts…" value={category} onChange={e => setCategory(e.target.value)} />
                  </div>
                  <div className="field">
                    <div className="field-label">Discount %</div>
                    <input type="number" className="inp" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid one">
                  <div className="field">
                    <div className="field-label">Photo</div>
                    <label className={`file-zone${file ? " loaded" : ""}`}>
                      <div className="file-zone-icon">📷</div>
                      <span>{file ? (file as any).name : "Click to upload photo"}</span>
                      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-blue" onClick={add}>Add to Menu</button>
                  {msg && <span style={{ fontSize: 12.5, color: "var(--red)" }}>{msg}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── KITCHEN ── */}
          {activeSection === "kitchen" && (
            <div>
              <div className="page-header">
                <div className="page-title">Kitchen Access</div>
                <div className="page-sub">Control how kitchen staff sign in</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-icon">📡</div>
                  <div>
                    <div className="card-title">Current Mode</div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <div className={`status-chip ${
                      kitchenMode === "passwordless" ? "chip-green"
                      : kitchenMode === "password" ? "chip-amber"
                      : "chip-gray"
                    }`}>
                      <div className="chip-dot" />
                      {kitchenMode === "password" ? "Password Protected"
                       : kitchenMode === "passwordless" ? "Passwordless"
                       : "Checking…"}
                    </div>
                  </div>
                </div>
                <table className="info-table">
                  <tbody>
                    <tr className="info-row-tr">
                      <td className="info-td label">Passwordless</td>
                      <td className="info-td val">Instant access — no login needed</td>
                    </tr>
                    <tr className="info-row-tr">
                      <td className="info-td label">Password mode</td>
                      <td className="info-td val">Staff must enter a password</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-icon">🔑</div>
                  <div>
                    <div className="card-title">Set Password</div>
                    <div className="card-sub">Leave blank and tap Enable Passwordless for instant access</div>
                  </div>
                </div>
                <div className="field-grid one" style={{ maxWidth: 360 }}>
                  <div className="field">
                    <div className="field-label">Kitchen Password</div>
                    <input type="password" className="inp" placeholder="Leave blank for passwordless" value={kitchenPass} onChange={e => setKitchenPass(e.target.value)} />
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-blue" onClick={saveKitchen}>Save Password</button>
                  <button className="btn btn-ghost" onClick={enablePasswordless}>Enable Passwordless</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeSection === "payments" && (
            <div>
              <div className="page-header">
                <div className="page-title">Payments</div>
                <div className="page-sub">Manage Stripe and payouts</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">💳</div>
                  <div>
                    <div className="card-title">Stripe Connect</div>
                    <div className="card-sub">Receive payments directly to your bank</div>
                  </div>
                </div>
                <table className="info-table">
                  <tbody>
                    <tr className="info-row-tr">
                      <td className="info-td label">Processor</td>
                      <td className="info-td val">Stripe</td>
                    </tr>
                    <tr className="info-row-tr">
                      <td className="info-td label">Payouts</td>
                      <td className="info-td val">Via Stripe Express dashboard</td>
                    </tr>
                  </tbody>
                </table>
                <div className="btn-row">
                  <button className="btn btn-blue" onClick={connectStripe}>Connect Stripe</button>
                  <button className="btn btn-ghost" onClick={withdraw}>Open Dashboard ↗</button>
                </div>
              </div>
            </div>
          )}

          {/* ── SERVICE FEE ── */}
          {activeSection === "fee" && (
            <div>
              <div className="page-header">
                <div className="page-title">Service Fee</div>
                <div className="page-sub">Added to every order at checkout</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">％</div>
                  <div>
                    <div className="card-title">Fee Configuration</div>
                    <div className="card-sub">Applies to every order subtotal</div>
                  </div>
                </div>
                <div className="field-grid one" style={{ maxWidth: 280 }}>
                  <div className="field">
                    <div className="field-label">Percentage</div>
                    <input type="number" className="inp" placeholder="e.g. 5" value={serviceFee} onChange={e => setServiceFee(e.target.value)} />
                  </div>
                </div>
                {serviceFee && (
                  <p style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 8 }}>
                    A <strong>{serviceFee}%</strong> fee will be added to every order.
                  </p>
                )}
                <div className="btn-row">
                  <button className="btn btn-blue" onClick={saveServiceFee}>Save</button>
                </div>
              </div>
            </div>
          )}

          {/* ── BRANDING ── */}
          {activeSection === "branding" && (
            <div>
              <div className="page-header">
                <div className="page-title">Branding</div>
                <div className="page-sub">Your store name and logo visible to customers</div>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-icon">✦</div>
                  <div>
                    <div className="card-title">Store Identity</div>
                    <div className="card-sub">Shown on your public menu page</div>
                  </div>
                </div>
                <div className="field-grid one" style={{ maxWidth: 400 }}>
                  <div className="field">
                    <div className="field-label">Cafe Name</div>
                    <input type="text" className="inp" placeholder="e.g. Barista Coffee" value={cafeName} onChange={e => setCafeName(e.target.value)} />
                  </div>
                </div>
                <div className="field-grid one" style={{ maxWidth: 400, marginTop: 10 }}>
                  <div className="field">
                    <div className="field-label">Logo</div>
                    <label className={`file-zone${logoFile ? " loaded" : ""}`}>
                      <div className="file-zone-icon">🖼️</div>
                      <span>{logoFile ? (logoFile as any).name : "Click to upload logo"}</span>
                      <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-blue" onClick={saveBranding}>Save Branding</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}