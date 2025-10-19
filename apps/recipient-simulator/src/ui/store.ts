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

export type OverlayItem = {
  id: string
  x: number // px
  y: number // px
  w: number // px
  h: number // px
}

type CanvasState = {
  aspect: '1:1' | '16:9' | '4:3'
  setAspect: (a: '1:1' | '16:9' | '4:3') => void
  items: GridItem[]
  overlay: OverlayItem[]
  addItem: (item: GridItem) => void
  updateItem: (id: string, partial: Partial<GridItem>) => void
  setItems: (items: GridItem[]) => void
  addOverlay: (item: OverlayItem) => void
  updateOverlay: (id: string, partial: Partial<OverlayItem>) => void
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    aspect: '1:1',
    setAspect: (a) => set((s) => { s.aspect = a }),
    items: [],
    overlay: [],
    addItem: (item) => set((s) => { s.items.push(item) }),
    updateItem: (id, partial) => set((s) => {
      const i = s.items.findIndex((it) => it.id === id)
      if (i >= 0) Object.assign(s.items[i], partial)
    }),
    setItems: (items) => set((s) => { s.items = items }),
    addOverlay: (item) => set((s) => { s.overlay.push(item) }),
    updateOverlay: (id, partial) => set((s) => {
      const i = s.overlay.findIndex((it) => it.id === id)
      if (i >= 0) Object.assign(s.overlay[i], partial)
    }),
  }))
)

