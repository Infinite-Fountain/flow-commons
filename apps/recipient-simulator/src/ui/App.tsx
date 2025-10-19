import React, { useEffect } from 'react'
import { ThemeProvider } from '@flow-commons/canvas-ui'
import { CanvasHybrid } from './CanvasHybrid'
import { useCanvasStore } from './store'
import { Toolbar } from './components/Toolbar'

export function App() {
  const setItems = useCanvasStore((s) => s.setItems)
  useEffect(() => {
    setItems([
      { id: 'a', x: 0, y: 0, w: 4, h: 6, type: 'chart' },
      { id: 'b', x: 4, y: 0, w: 4, h: 6, type: 'image' },
      { id: 'c', x: 8, y: 0, w: 4, h: 6, type: 'text' },
    ])
  }, [setItems])

  return (
    <ThemeProvider>
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b10' }}>
        <div style={{ width: 1040 }}>
          <Toolbar />
        </div>
        <div style={{ width: 1000, height: 640 }}>
          <CanvasHybrid />
        </div>
      </div>
    </ThemeProvider>
  )
}

