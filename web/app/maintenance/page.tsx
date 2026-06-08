'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

export default function Maintenance() {
  const [storeCode, setStoreCode] = useState('')
  const [tables, setTables] = useState(10)
  const [stores, setStores] = useState<string[]>([])
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    const res = await apiFetch(`${API}/maintenance/stores`)
    if (res.success) setStores(res.stores)
  }

  const create = async () => {
    const res = await apiFetch(`${API}/maintenance/create-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeCode, tables }),
    })

    if (res.success) {
      setUrls(res.urls || [])
      loadStores()
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">

      <h1 className="text-xl font-bold text-center">
        CaviarQR Maintenance
      </h1>

      <input
        placeholder="Store Code"
        className="w-full p-3 border rounded"
        onChange={e => setStoreCode(e.target.value)}
      />

      <input
        type="number"
        placeholder="Tables"
        className="w-full p-3 border rounded"
        value={tables}
        onChange={e => setTables(Number(e.target.value))}
      />

      <button
        onClick={create}
        className="w-full bg-black text-white p-3 rounded"
      >
        Create Store + Tables
      </button>

      {/* CREATED STORES */}
      <div>
        <h2 className="font-semibold">Stores</h2>
        {stores.map(s => (
          <div key={s}>{s}</div>
        ))}
      </div>

      {/* QR LINKS */}
      {urls.length > 0 && (
        <div>
          <h2 className="font-semibold">QR URLs</h2>
          {urls.map(u => (
            <div key={u} className="text-sm break-all">
              {u}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}