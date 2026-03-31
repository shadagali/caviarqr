'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {

  const router = useRouter()

  useEffect(() => {

    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/login')
    }

  }, [])

  return (

    <div className="p-10">

      <h1 className="text-3xl font-bold mb-6">
        TapServe Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-6">

        <div className="bg-white p-6 shadow rounded">
          Revenue Today
        </div>

        <div className="bg-white p-6 shadow rounded">
          Orders Today
        </div>

        <div className="bg-white p-6 shadow rounded">
          Active Tables
        </div>

      </div>

    </div>
  )
}