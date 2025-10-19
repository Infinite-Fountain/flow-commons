import React from 'react'
import { useCanvasStore } from '../store'

export function RatioSelector() {
  const aspect = useCanvasStore((s) => s.aspect)
  const setAspect = useCanvasStore((s) => s.setAspect)
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      Aspect:
      <select value={aspect} onChange={(e) => setAspect(e.target.value as any)}>
        <option value="1:1">1:1</option>
        <option value="16:9">16:9</option>
        <option value="4:3">4:3</option>
      </select>
    </label>
  )
}

