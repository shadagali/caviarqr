"use client"

type MenuItem = {
  id: string
  name: string
  price: number
  imageUrl?: string
}

export default function MenuTable({
  items,
  reload,
}: {
  items: MenuItem[]
  reload: () => void
}) {

  async function deleteItem(id: string) {
    await fetch(`http://localhost:3001/menu/${id}`, {
      method: "DELETE",
    })

    reload()
  }

  return (
    <div className="bg-white border rounded-xl">

      <table className="w-full">

        <thead className="border-b">
          <tr className="text-left">
            <th className="p-4">Photo</th>
            <th className="p-4">Name</th>
            <th className="p-4">Price</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>

        <tbody>

          {items.map((item) => (
            <tr key={item.id} className="border-b">

              <td className="p-4">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
              </td>

              <td className="p-4">{item.name}</td>

              <td className="p-4">${item.price}</td>

              <td className="p-4">

                <button
                  onClick={() => deleteItem(item.id)}
                  className="text-red-600"
                >
                  Delete
                </button>

              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>
  )
}