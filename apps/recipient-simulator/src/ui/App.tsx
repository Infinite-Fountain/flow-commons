import React from 'react'
import { ThemeProvider } from '@flow-commons/canvas-ui'
import { CanvasHybrid } from './CanvasHybrid'
import { Toolbar } from './components/Toolbar'
import { RatioSelector } from './components/RatioSelector'
import { Canvas } from '@flow-commons/canvas-ui'

export function App() {
  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#2b2b2b' }}>
        <div style={{ width: 1040, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Toolbar />
          <RatioSelector />
        </div>
        <div style={{ width: 960 }}>
          <Canvas aspect={'1:1'} backgroundColor="#000" style={{ maxWidth: 960 }}>
            <div style={{ width: '100%', height: '100%' }}>
              <CanvasHybrid />
            </div>
          </Canvas>
        </div>
      </div>
    </ThemeProvider>
  )
}

