import { create } from 'zustand'

export const useCart = create((set) => ({
  items: [],
  storeCode: null,

  setStoreCode: (code: string) => set({ storeCode: code }),

  addItem: (item: any) =>
    set((state: any) => ({
      items: [...state.items, item],
    })),

  clear: () => set({ items: [] }),
}))