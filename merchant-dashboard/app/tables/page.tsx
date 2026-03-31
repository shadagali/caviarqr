"use client"

import { useState } from "react"
import QRCode from "qrcode"
import { jsPDF } from "jspdf"

export default function TablesPage() {

  const [storeCode, setStoreCode] = useState("")
  const [tableCount, setTableCount] = useState("")
  const [tables, setTables] = useState<number[]>([])

  function generateTables() {

    const count = Number(tableCount)

    if (!storeCode || !count) return

    const arr = []

    for (let i = 1; i <= count; i++) {
      arr.push(i)
    }

    setTables(arr)
  }

  async function downloadPDF() {

    const pdf = new jsPDF()

    let x = 10
    let y = 20

    for (let table of tables) {

      const url =
        `https://tapserve.app/store/${storeCode}?table=${table}`

      const qr = await QRCode.toDataURL(url)

      pdf.text(`Table ${table}`, x, y)

      pdf.addImage(qr, "PNG", x, y + 5, 40, 40)

      x += 60

      if (x > 150) {
        x = 10
        y += 60
      }

    }

    pdf.save(`${storeCode}-table-qrs.pdf`)
  }

  return (

    <div className="p-6">

      <h1 className="text-3xl font-bold mb-6">
        Table QR Generator
      </h1>

      <div className="bg-white p-6 rounded-xl shadow mb-8 max-w-md">

        <input
          className="border p-2 w-full mb-4"
          placeholder="Store Code (example: BURGER1)"
          value={storeCode}
          onChange={(e)=>setStoreCode(e.target.value)}
        />

        <input
          className="border p-2 w-full mb-4"
          placeholder="Number of Tables"
          value={tableCount}
          onChange={(e)=>setTableCount(e.target.value)}
        />

        <button
          onClick={generateTables}
          className="bg-black text-white px-4 py-2 rounded w-full"
        >
          Generate QR Codes
        </button>

      </div>

      {tables.length > 0 && (

        <>
          <button
            onClick={downloadPDF}
            className="bg-green-600 text-white px-4 py-2 rounded mb-6"
          >
            Download QR Sheet
          </button>

          <div className="grid grid-cols-4 gap-6">

            {tables.map((table)=>{

              const url =
                `https://tapserve.app/store/${storeCode}?table=${table}`

              return (

                <div
                  key={table}
                  className="bg-white p-4 rounded-xl shadow text-center"
                >

                  <p className="font-bold mb-2">
                    Table {table}
                  </p>

                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`}
                    className="mx-auto"
                  />

                  <p className="text-xs mt-2 break-all">
                    {url}
                  </p>

                </div>

              )

            })}

          </div>

        </>

      )}

    </div>
  )
}