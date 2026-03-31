import Link from "next/link"

export default function Sidebar() {
  return (
    <div className="w-64 h-screen border-r bg-white p-6">

      <h1 className="text-2xl font-bold mb-10">
        TapServe
      </h1>

      <nav className="flex flex-col gap-4">

        <Link href="/dashboard">Dashboard</Link>
        <Link href="/menu">Menu</Link>
        <Link href="/orders">Orders</Link>
        <Link href="/kitchen">Kitchen</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/payouts">Payouts</Link>
        <Link href="/settings">Settings</Link>

      </nav>

    </div>
  )
}