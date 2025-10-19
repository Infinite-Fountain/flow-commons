import React, { useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useCanvasStore } from './store'
import { TextPrimitive, ImagePrimitive, PlaceholderPrimitive } from './components/Primitives'

export function FreeformOverlay({ gridCols = 12, width = 960, rowHeight = 40 }: { gridCols?: number; width?: number; rowHeight?: number }) {
  const overlay = useCanvasStore((s) => s.overlay)
  const addOverlay = useCanvasStore((s) => s.addOverlay)
  const updateOverlay = useCanvasStore((s) => s.updateOverlay)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const colWidth = useMemo(() => width / gridCols, [width, gridCols])
  const snapX = (x: number) => Math.round(x / colWidth) * colWidth
  const snapY = (y: number) => Math.round(y / rowHeight) * rowHeight

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 8 }}>
        <button onClick={() => addOverlay({ id: String(Date.now()), x: 0, y: 0, w: colWidth * 3, h: rowHeight * 4, contentType: 'none' })}>Add Box</button>
      </div>
      {overlay.map((it) => (
        <Rnd
          key={it.id}
          size={{ width: it.w, height: it.h }}
          position={{ x: it.x, y: it.y }}
          onDragStop={(_, d) => updateOverlay(it.id, { x: snapX(d.x), y: snapY(d.y) })}
          onResizeStop={(_, __, ref, ___, position) =>
            updateOverlay(it.id, {
              w: snapX(ref.offsetWidth),
              h: snapY(ref.offsetHeight),
              x: snapX(position.x),
              y: snapY(position.y),
            })
          }
          onClick={() => setSelectedId(it.id)}
          bounds="parent"
          style={{
            border: it.id === selectedId ? '2px solid #ffcf33' : '1px solid #666',
            background: '#0e0e12',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {it.id === selectedId && (
              <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', gap: 6, background: 'rgba(20,20,26,0.9)', padding: 6, borderRadius: 6 }}>
                <button onClick={() => updateOverlay(it.id, { contentType: 'text', text: 'Sample Text' })}>Text</button>
                <button onClick={() => updateOverlay(it.id, { contentType: 'image', imageSrc: 'https://picsum.photos/seed/pgf/800/600' })}>Image</button>
                <button onClick={() => updateOverlay(it.id, { contentType: 'chart' })}>Chart</button>
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              {it.contentType === 'text' ? (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                  <TextPrimitive text={it.text} />
                </div>
              ) : it.contentType === 'image' ? (
                <ImagePrimitive src={it.imageSrc ?? ''} alt="" />
              ) : it.contentType === 'chart' ? (
                <PlaceholderPrimitive label="Chart Placeholder" />
              ) : (
                <PlaceholderPrimitive label="Empty Box" />
              )}
            </div>
          </div>
        </Rnd>
      ))}
    </div>
  )
}

