```ts
import { create } from "zustand"

interface CartItem {
  id: number
  name: string
  price: number
}

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: number) => void
  clear: () => void
  total: () => number
}

export const useCart = create<CartState>((set, get) => ({

  items: [],

  addItem: (item) =>
    set(state => ({
      items: [...state.items, item]
    })),

  removeItem: (id) =>
    set(state => ({
      items: state.items.filter(i => i.id !== id)
    })),

  clear: () =>
    set({ items: [] }),

  total: () =>
    get().items.reduce((sum, i) => sum + i.price, 0)

}))
```
