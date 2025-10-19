import React, { useEffect } from 'react'
import { ThemeProvider } from '@flow-commons/canvas-ui'
import { CanvasHybrid } from './CanvasHybrid'
import { useCanvasStore } from './store'
import { Toolbar } from './components/Toolbar'
import { RatioSelector } from './components/RatioSelector'
import { Canvas } from '@flow-commons/canvas-ui'

export function App() {
  const setItems = useCanvasStore((s) => s.setItems)
  const aspect = useCanvasStore((s) => s.aspect)
  useEffect(() => {
    setItems([
      { id: 'a', x: 0, y: 0, w: 4, h: 6, type: 'chart' },
      { id: 'b', x: 4, y: 0, w: 4, h: 6, type: 'image' },
      { id: 'c', x: 8, y: 0, w: 4, h: 6, type: 'text' },
    ])
  }, [setItems])

  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#2b2b2b' }}>
        <div style={{ width: 1040, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Toolbar />
          <RatioSelector />
        </div>
        <div style={{ width: 960 }}>
          <Canvas aspect={aspect} backgroundColor="#000" style={{ maxWidth: 960 }}>
            <div style={{ width: '100%', height: '100%' }}>
              <CanvasHybrid />
            </div>
          </Canvas>
        </div>
      </div>
    </ThemeProvider>
  )
}

