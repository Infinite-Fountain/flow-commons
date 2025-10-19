import React from 'react'
import { useCanvasStore } from '../store'

export function Toolbar() {
  const { addOverlay } = useCanvasStore()
  return (
    <div style={{ display: 'flex', gap: 8, padding: 8, background: '#14141a', color: '#f5f7fa', borderRadius: 8 }}>
      <button onClick={() => addOverlay({ id: String(Date.now()), x: 0, y: 0, w: 200, h: 160, contentType: 'none' })}>Add Box</button>
    </div>
  )
}

