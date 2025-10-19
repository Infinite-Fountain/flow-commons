import React, { useMemo } from 'react'
import GridLayout, { Layout } from 'react-grid-layout'
import { DndContext, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core'
import { useCanvasStore } from './store'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { TextPrimitive, ImagePrimitive, PlaceholderPrimitive } from './components/Primitives'
import { BackgroundLottieLayers } from './components/BackgroundLottieLayers'
import { FreeformOverlay } from './FreeformOverlay'

export function CanvasHybrid() {
  const { items, setItems } = useCanvasStore()

  const layout: Layout[] = useMemo(
    () => items.map((it) => ({ i: it.id, x: it.x, y: it.y, w: it.w, h: it.h })),
    [items]
  )

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 4 } })
  )

  return (
    <div style={{ width: '100%', height: '100%', padding: 16, position: 'relative' }}>
      <BackgroundLottieLayers />
      <DndContext sensors={sensors}>
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={40}
          width={960}
          margin={[8, 8]}
          containerPadding={[8, 8]}
          onLayoutChange={(next: Layout[]) => {
            const nextItems = items.map((it) => {
              const l = next.find((n: Layout) => n.i === it.id)
              return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it
            })
            setItems(nextItems)
          }}
        >
          {items.map((it) => (
            <div key={it.id} style={{ background: '#14141a', borderRadius: 8, color: '#f5f7fa', overflow: 'hidden' }}>
              {it.type === 'text' ? (
                <TextPrimitive text="Headline / Narrative" />
              ) : it.type === 'image' ? (
                <ImagePrimitive src="https://picsum.photos/seed/pgf/600/400" alt="placeholder" />
              ) : (
                <PlaceholderPrimitive label="Chart Placeholder" />
              )}
            </div>
          ))}
        </GridLayout>
      </DndContext>
      <FreeformOverlay />
    </div>
  )
}

