'use client'

import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="p-10">
      <h1 className="text-3xl font-semibold mb-6">
        Owner Dashboard
      </h1>

      <div className="flex flex-col gap-4">
        <Link href="/dashboard/menu">Menu</Link>
        <Link href="/dashboard/kitchen">Kitchen</Link>
        <Link href="/dashboard/tags">Register Tags</Link>
      </div>
    </div>
  )
}