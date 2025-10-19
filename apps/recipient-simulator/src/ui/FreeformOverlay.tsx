import React, { useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useCanvasStore } from './store'

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
        <button onClick={() => addOverlay({ id: String(Date.now()), x: 0, y: 0, w: colWidth * 2, h: rowHeight * 2 })}>Add Freeform Box</button>
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
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
          }}
        />
      ))}
    </div>
  )
}

