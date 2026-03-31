"use client"

type MenuItem = {
  id: string
  name: string
  price: number
  imageUrl?: string
}

export default function MenuGrid({
  items,
  reload,
}: {
  items: MenuItem[]
  reload: () => void
}) {

  async function deleteItem(id: string) {

    await fetch(`http://localhost:3001/menu/${id}`, {
      method: "DELETE"
    })

    reload()
  }

  return (

    <div className="grid grid-cols-4 gap-6">

      {items.map((item) => (

        <div
          key={item.id}
          className="bg-white rounded-xl shadow hover:shadow-xl transition overflow-hidden group"
        >

          <div className="relative">

            {item.imageUrl ? (

              <img
                src={`http://localhost:3001/uploads/${item.imageUrl}`}
                className="w-full h-40 object-cover"
              />

            ) : (

              <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                No Image
              </div>

            )}

            <button
              onClick={() => deleteItem(item.id)}
              className="absolute top-2 right-2 bg-white rounded px-2 py-1 text-red-600 text-xs opacity-0 group-hover:opacity-100"
            >
              Delete
            </button>

          </div>

          <div className="p-4">

            <h3 className="font-bold text-lg">
              {item.name}
            </h3>

            <p className="text-gray-600">
              ${item.price}
            </p>

          </div>

        </div>

      ))}

    </div>
  )
}