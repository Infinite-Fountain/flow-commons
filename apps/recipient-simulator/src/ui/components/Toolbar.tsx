import React from 'react'
import { useCanvasStore } from '../store'

export function Toolbar() {
  const { addItem, items, setItems } = useCanvasStore()
  return (
    <div style={{ display: 'flex', gap: 8, padding: 8, background: '#14141a', color: '#f5f7fa', borderRadius: 8 }}>
      <button onClick={() => addItem({ id: String(Date.now()), x: 0, y: 0, w: 4, h: 4, type: 'text' })}>Add Text</button>
      <button onClick={() => addItem({ id: String(Date.now()), x: 2, y: 0, w: 4, h: 4, type: 'image' })}>Add Image</button>
      <button onClick={() => addItem({ id: String(Date.now()), x: 4, y: 0, w: 4, h: 4, type: 'chart' })}>Add Chart</button>
      <button onClick={() => setItems(items.slice(0, -1))}>Remove last</button>
    </div>
  )
}

