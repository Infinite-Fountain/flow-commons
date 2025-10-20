import React, { useState } from 'react'
import { useCanvasStore } from '../store'

export function Toolbar() {
  const { addOverlay } = useCanvasStore()
  const setBackground = useCanvasStore((s) => s.setBackground)
  const [showBgMenu, setShowBgMenu] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#14141a', color: '#f5f7fa', borderRadius: 8 }}>
      <button onClick={() => addOverlay({ id: String(Date.now()), x: 0, y: 0, w: 200, h: 160, contentType: 'none' })}>Add Box</button>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowBgMenu((s) => !s)}>Background Gradient</button>
        {showBgMenu && (
          <div style={{ position: 'absolute', top: '100%', left: 0, background: '#0e0e12', padding: 6, borderRadius: 6, display: 'grid', gap: 6 }}>
            <button onClick={() => { setBackground({ mode: 'linear', from: '#000000', to: '#111111' }); setShowBgMenu(false); window.dispatchEvent(new CustomEvent('open-bg-gradient', { detail: 'linear' })) }}>Linear…</button>
            <button onClick={() => { setBackground({ mode: 'radial', from: '#000000', to: '#111111' }); setShowBgMenu(false); window.dispatchEvent(new CustomEvent('open-bg-gradient', { detail: 'radial' })) }}>Radial…</button>
          </div>
        )}
      </div>
    </div>
  )
}

