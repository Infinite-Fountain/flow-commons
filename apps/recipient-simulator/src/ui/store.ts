import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type GridItem = {
  id: string
  x: number
  y: number
  w: number
  h: number
  type: 'chart' | 'image' | 'text' | 'snapshot'
}

type CanvasState = {
  items: GridItem[]
  addItem: (item: GridItem) => void
  updateItem: (id: string, partial: Partial<GridItem>) => void
  setItems: (items: GridItem[]) => void
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    items: [],
    addItem: (item) => set((s) => { s.items.push(item) }),
    updateItem: (id, partial) => set((s) => {
      const i = s.items.findIndex((it) => it.id === id)
      if (i >= 0) Object.assign(s.items[i], partial)
    }),
    setItems: (items) => set((s) => { s.items = items }),
  }))
)

