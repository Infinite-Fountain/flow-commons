import React, { useEffect, useState } from 'react'
import { ThemeProvider } from '@flow-commons/canvas-ui'
import { CanvasHybrid } from './CanvasHybrid'
import { Toolbar } from './components/Toolbar'
import { RatioSelector } from './components/RatioSelector'
import { Canvas } from '@flow-commons/canvas-ui'
import { useCanvasStore } from './store'
import { BackgroundGradientModal } from './components/BackgroundGradientModal'

export function App() {
  const aspect = useCanvasStore((s) => s.aspect)
  const background = useCanvasStore((s) => s.background)
  const setBackground = useCanvasStore((s) => s.setBackground)
  const [openModal, setOpenModal] = useState<null | 'linear' | 'radial'>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<'linear' | 'radial'>
      setOpenModal(ce.detail)
    }
    window.addEventListener('open-bg-gradient' as any, handler)
    return () => window.removeEventListener('open-bg-gradient' as any, handler)
  }, [])

  const bgStyle = background.mode === 'linear'
    ? `linear-gradient(135deg, ${background.from}, ${background.to})`
    : background.mode === 'radial'
    ? `radial-gradient(circle, ${background.from}, ${background.to})`
    : '#000'

  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', display: 'flex', background: '#2b2b2b' }}>
        <div style={{ width: 200, padding: 16, background: '#1a1a1a', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Toolbar />
          <RatioSelector />
        </div>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: 960 }}>
            <Canvas aspect={aspect} backgroundColor={bgStyle} style={{ maxWidth: 960 }}>
              <div style={{ width: '100%', height: '100%' }}>
                <CanvasHybrid />
              </div>
            </Canvas>
          </div>
        </div>
      </div>
      <BackgroundGradientModal
        open={openModal !== null}
        mode={(openModal ?? 'linear')}
        from={background.from}
        to={background.to}
        onClose={() => setOpenModal(null)}
        onSave={(b) => { setBackground(b); setOpenModal(null) }}
      />
    </ThemeProvider>
  )
}

