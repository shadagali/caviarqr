import "./globals.css"
import Sidebar from "@/components/Sidebar"
import Topbar from "@/components/Topbar"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>

        <div className="flex">

          <Sidebar />

          <div className="flex-1">

            <Topbar />

            <main className="p-6 bg-gray-50 min-h-screen">
              {children}
            </main>

          </div>

        </div>

      </body>
    </html>
  )
}