import React, { useMemo, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useCanvasStore } from './store'
import { TextPrimitive, ImagePrimitive, PlaceholderPrimitive } from './components/Primitives'
import { Modal } from './components/Modal'

export function FreeformOverlay({ gridCols = 12, width = 960, rowHeight = 40 }: { gridCols?: number; width?: number; rowHeight?: number }) {
  const overlay = useCanvasStore((s) => s.overlay)
  const updateOverlay = useCanvasStore((s) => s.updateOverlay)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [textModalFor, setTextModalFor] = useState<string | null>(null)
  const [draft, setDraft] = useState({ text: '', fontSize: 18, color: '#ffffff', bold: false, align: 'center' as 'left' | 'center' | 'right' })

  const colWidth = useMemo(() => width / gridCols, [width, gridCols])
  const snapX = (x: number) => Math.round(x / colWidth) * colWidth
  const snapY = (y: number) => Math.round(y / rowHeight) * rowHeight

  const openTextModal = (id: string) => {
    const it = overlay.find((o) => o.id === id)
    setDraft({
      text: it?.text ?? 'Sample Text',
      fontSize: it?.fontSize ?? 18,
      color: it?.color ?? '#ffffff',
      bold: it?.bold ?? false,
      align: it?.align ?? 'center',
    })
    setTextModalFor(id)
  }

  const saveTextModal = () => {
    if (!textModalFor) return
    updateOverlay(textModalFor, { contentType: 'text', text: draft.text, fontSize: draft.fontSize, color: draft.color, bold: draft.bold, align: draft.align })
    setTextModalFor(null)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
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
          onDoubleClick={() => setSelectedId((s) => (s === it.id ? null : it.id))}
          bounds="parent"
          style={{
            border: it.id === selectedId ? '2px solid #ffcf33' : '1px solid transparent',
            background: '#0e0e12',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {it.id === selectedId && (
              <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2, display: 'flex', gap: 6, background: 'rgba(20,20,26,0.9)', padding: 6, borderRadius: 6 }}>
                <button onClick={() => openTextModal(it.id)}>Text</button>
                <button onClick={() => updateOverlay(it.id, { contentType: 'image', imageSrc: 'https://picsum.photos/seed/pgf/800/600' })}>Image</button>
                <button onClick={() => updateOverlay(it.id, { contentType: 'chart' })}>Chart</button>
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 8, textAlign: it.align ?? 'center' }}>
              {it.contentType === 'text' ? (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                  <div style={{ fontSize: it.fontSize ?? 18, color: it.color ?? '#ffffff', fontWeight: it.bold ? 700 : 400, textAlign: it.align ?? 'center', width: '100%' }}>
                    {it.text}
                  </div>
                </div>
              ) : it.contentType === 'image' ? (
                <ImagePrimitive src={it.imageSrc ?? ''} alt="" />
              ) : it.contentType === 'chart' ? (
                <PlaceholderPrimitive label="Chart Placeholder" />
              ) : (
                <PlaceholderPrimitive label="Double-click to edit" />
              )}
            </div>
          </div>
        </Rnd>
      ))}
      <Modal open={!!textModalFor} title="Text Settings" onClose={() => setTextModalFor(null)} onSubmit={saveTextModal}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Text</span>
            <input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Font size</span>
            <input type="number" value={draft.fontSize} onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Color</span>
            <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={draft.bold} onChange={(e) => setDraft({ ...draft, bold: e.target.checked })} />
            <span>Bold</span>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>Alignment</span>
            <select value={draft.align} onChange={(e) => setDraft({ ...draft, align: e.target.value as any })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  )
}

