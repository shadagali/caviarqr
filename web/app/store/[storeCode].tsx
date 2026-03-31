'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function StorePage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const storeCode = params.storeCode as string
  const table = searchParams.get('table')

  const [menu, setMenu] = useState<any[]>([])

  useEffect(() => {
    if (!storeCode) return

    api.get(`/menu/store/${storeCode}`).then((res) => {
      setMenu(res.data)
    })
  }, [storeCode])

  const placeOrder = async (item: any) => {
    await api.post('/order', {
      storeCode,
      items: [item],
      totalAmount: item.price,
    })

    alert('Order placed!')
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-2xl mb-4">
        {storeCode} — Table {table}
      </h1>

      {menu.length === 0 && <p>No menu items</p>}

      {menu.map((item) => (
        <div key={item.id} className="border p-4 mb-3 rounded">
          <p className="font-semibold">{item.name}</p>
          <p>${item.price}</p>

          <button
            onClick={() => placeOrder(item)}
            className="bg-black text-white px-4 py-2 rounded mt-2"
          >
            Order
          </button>
        </div>
      ))}
    </div>
  )
}