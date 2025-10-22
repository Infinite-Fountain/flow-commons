'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, doc, onSnapshot, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any)
const db = getFirestore(app)

export function FreeformOverlay({ projectId = 'demo', canvasId = 'root' }: { projectId?: string; canvasId?: string }) {
  const overlay = useCanvasStore((s) => s.overlay)
  const setOverlay = useCanvasStore((s) => s.setOverlay)
  const updateOverlay = useCanvasStore((s) => s.updateOverlay)
  const layers = useCanvasStore((s) => s.layers)
  const createBox = useCanvasStore((s) => s.createBox)
  const currentTool = useCanvasStore((s) => s.ui.currentTool)
  const setTool = useCanvasStore((s) => s.setTool)
  const openBoxModal = useCanvasStore((s) => s.openBoxModal)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const setSelectedId = useCanvasStore((s) => s.setSelectedId)

  const idToZ = useMemo(() => {
    const map: Record<string, number> = {}
    layers.forEach((l) => { map[l.id] = l.z })
    return map
  }, [layers])

  const onPointerDown = (e: React.PointerEvent) => {
    if (currentTool !== 'add-box') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDragStart({ x, y })
    setDraftRect({ x, y, w: 0, h: 0 })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (currentTool !== 'add-box' || !dragStart) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const x = Math.min(dragStart.x, cx)
    const y = Math.min(dragStart.y, cy)
    const w = Math.abs(cx - dragStart.x)
    const h = Math.abs(cy - dragStart.y)
    setDraftRect({ x, y, w, h })
  }

  const onPointerUp = () => {
    if (currentTool !== 'add-box' || !dragStart || !draftRect) return
    const minSize = 40
    const w = Math.max(minSize, draftRect.w)
    const h = Math.max(minSize, draftRect.h)
    const id = createBox({ x: draftRect.x, y: draftRect.y, w, h })
    const itemRef = doc(db, 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay', id)
    setDoc(itemRef, { id, x: Math.round(draftRect.x), y: Math.round(draftRect.y), w, h, contentType: 'none' }, { merge: true })
    setSelectedId(id)
    setDragStart(null)
    setDraftRect(null)
    setTool('none')
  }

  useEffect(() => {
    if (!projectId) return
    const col = collection(db, 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay')
    const unsub = onSnapshot(col, (snap) => {
      const items: any[] = []
      snap.forEach((d) => items.push(d.data()))
      setOverlay(items as any)
    })
    return () => unsub()
  }, [projectId, canvasId, setOverlay])

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0"
      style={{ zIndex: 1 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {overlay.map((it) => (
        <Rnd
          key={it.id}
          size={{ width: it.w, height: it.h }}
          position={{ x: it.x, y: it.y }}
          onDragStop={(_, d) => {
            const nx = Math.round(d.x)
            const ny = Math.round(d.y)
            updateOverlay(it.id, { x: nx, y: ny })
            const itemRef = doc(db, 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay', it.id)
            setDoc(itemRef, { x: nx, y: ny }, { merge: true })
          }}
          onResizeStop={(_, __, ref, ___, position) => {
            const nw = Math.round(ref.offsetWidth)
            const nh = Math.round(ref.offsetHeight)
            const nx = Math.round(position.x)
            const ny = Math.round(position.y)
            updateOverlay(it.id, { w: nw, h: nh, x: nx, y: ny })
            const itemRef = doc(db, 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay', it.id)
            setDoc(itemRef, { w: nw, h: nh, x: nx, y: ny }, { merge: true })
          }}
          bounds="parent"
          style={{
            border: it.id === selectedId ? '2px solid #ffcf33' : '1px solid transparent',
            background: 'transparent',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: idToZ[it.id] ?? 1,
          }}
          onClick={() => setSelectedId(it.id)}
          onDoubleClick={() => openBoxModal(it.id)}
        >
          <div className="w-full h-full" />
        </Rnd>
      ))}

      {currentTool === 'add-box' && draftRect && (
        <div
          className="absolute border-2 border-blue-400/70 bg-blue-400/10"
          style={{ left: draftRect.x, top: draftRect.y, width: draftRect.w, height: draftRect.h, pointerEvents: 'none' }}
        />
      )}
    </div>
  )
}


