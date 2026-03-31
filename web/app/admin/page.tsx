'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export default function AdminPage() {
  const [stores, setStores] = useState<any[]>([])
  const [storeCodeInput, setStoreCodeInput] = useState('cafe1')
  const [tables, setTables] = useState(25)
  const [generatedStore, setGeneratedStore] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const BASE_URL =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'

  const fetchStores = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/business')
      const data = await res.json()
      setStores(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchStores()
  }, [])

  // 🔥 FIXED: SAFE STORE CREATE (handles existing + errors properly)
  const createStoreDirect = async () => {
    if (!storeCodeInput) {
      alert('Enter store code')
      return
    }

    setLoading(true)

    const cleanCode = storeCodeInput.toLowerCase().trim()
    const match = cleanCode.match(/\d+/)
    const number = match ? parseInt(match[0]) : 1

    try {
      const res = await fetch(
        'http://127.0.0.1:3001/business/admin/bulk-create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: number,
            count: 1,
          }),
        }
      )

      const data = await res.json()

      // 🔥 KEY FIX: even if already exists, allow QR generation
      setGeneratedStore(cleanCode)

      if (data.createdCount === 0) {
        alert('Store already exists — loading QR kit')
      }

      fetchStores()
    } catch (e) {
      console.error(e)
      alert('Backend not reachable. Is backend running?')
    }

    setLoading(false)
  }

  const urls = useMemo(() => {
    if (!generatedStore) return []
    return Array.from({ length: tables }).map((_, i) => {
      return `${BASE_URL}/store/${generatedStore}?table=${i + 1}`
    })
  }, [generatedStore, tables, BASE_URL])

  const withdraw = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:3001/order/admin/withdraw',
        { method: 'POST' }
      )
      const data = await res.json()
      alert(data.message || 'Withdraw attempted')
    } catch {
      alert('Withdraw failed — check backend')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">

      <h1 className="text-3xl mb-6">Maintenance Panel</h1>

      {/* CREATE STORE */}
      <div className="mb-6 border border-gray-700 p-4 rounded">
        <h2 className="mb-3">Create QR Kit</h2>

        <div className="flex flex-wrap gap-2 mb-3 items-center">

          <input
            value={storeCodeInput}
            onChange={(e) => setStoreCodeInput(e.target.value)}
            placeholder="cafe1"
            className="bg-gray-900 p-2"
          />

          <input
            type="number"
            value={tables}
            onChange={(e) => setTables(Number(e.target.value))}
            className="bg-gray-900 p-2 w-24"
          />

          <button
            onClick={createStoreDirect}
            disabled={loading}
            className="bg-white text-black px-4 py-2 rounded"
          >
            {loading ? 'Generating...' : 'Generate Kit'}
          </button>

        </div>

        <p className="text-xs text-gray-400">
          Works even if store already exists
        </p>
      </div>

      {/* STORE LIST */}
      <div className="mb-6 border border-gray-700 p-3 max-h-40 overflow-y-scroll">
        {stores.map((s) => (
          <div
            key={s.id}
            onClick={() => setGeneratedStore(s.storeCode)}
            className="cursor-pointer mb-2 hover:text-green-400"
          >
            {s.storeCode}
          </div>
        ))}
      </div>

      {/* QR OUTPUT */}
      {generatedStore && (
        <div>
          <h2 className="mb-3">
            QR Kit: <span className="text-green-400">{generatedStore}</span>
          </h2>

          <div className="mb-4 max-h-32 overflow-y-scroll border border-gray-700 p-2 text-xs">
            {urls.map((u, i) => (
              <div key={i} className="break-all">
                {u}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {urls.map((u, i) => (
              <div
                key={i}
                className="bg-white text-black p-2 rounded text-center"
              >
                <QRCodeCanvas value={u} size={140} />
                <div className="text-xs mt-1">Table {i + 1}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.print()}
            className="mt-6 bg-green-500 px-4 py-2 rounded"
          >
            Print QR Kit
          </button>
        </div>
      )}

      {/* WITHDRAW */}
      <div className="mt-10">
        <button
          onClick={withdraw}
          className="bg-green-500 px-4 py-2 rounded"
        >
          Withdraw Platform Earnings
        </button>
      </div>

    </div>
  )
}