'use client'

import React, { useEffect, useRef } from 'react'
import CanvasHybrid from './CanvasHybrid'
import { Toolbar } from './Toolbar'
import { RatioSelector } from './RatioSelector'
import { Canvas } from './Canvas'
import { useCanvasStore } from '@/app/interoperable-canvas/components/store'
import { BackgroundGradientModal } from './BackgroundGradientModal'
import LayersModal from '@/app/interoperable-canvas/components/LayersModal'
import BoxContentModal from '@/app/interoperable-canvas/components/BoxContentModal'

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore'

type Props = { projectId?: string }

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

export function CanvasApp({ projectId }: Props) {
  const aspect = useCanvasStore((s: any) => s.aspect)
  const setAspect = useCanvasStore((s: any) => s.setAspect)
  const background = useCanvasStore((s: any) => s.background)
  const setBackground = useCanvasStore((s: any) => s.setBackground)
  const layers = useCanvasStore((s: any) => s.layers)
  const setLayers = useCanvasStore((s: any) => s.setLayers)
  const ui = useCanvasStore((s: any) => s.ui)
  const openLayers = useCanvasStore((s: any) => s.openLayersModal)
  const closeLayers = useCanvasStore((s: any) => s.closeLayersModal)
  const closeBackground = useCanvasStore((s: any) => s.closeBackgroundModal)

  const bgStyle = background.mode === 'linear'
    ? `linear-gradient(135deg, ${background.from}, ${background.to})`
    : background.mode === 'radial'
    ? `radial-gradient(circle, ${background.from}, ${background.to})`
    : background.mode === 'solid'
    ? background.from
    : ''

  useEffect(() => {
    if (!projectId) return
    const rootCanvasRef = doc(db, 'interoperable-canvas', projectId, 'canvases', 'root')
    const unsub = onSnapshot(rootCanvasRef, (snap) => {
      const data = snap.data() as any
      if (data?.background && typeof data.background === 'object') {
        setBackground({
          mode: (data.background.mode ?? 'none'),
          from: data.background.from ?? '#000000',
          to: data.background.to ?? '#000000',
        })
      } else {
        setBackground({
          mode: 'linear',
          from: 'rgb(50, 250, 150)',
          to: 'rgb(150, 200, 250)',
        })
        setDoc(rootCanvasRef, {
          background: { mode: 'linear', from: 'rgb(50, 250, 150)', to: 'rgb(150, 200, 250)' }
        }, { merge: true })
      }
      if (data?.aspect) {
        setAspect(data.aspect)
      }
      if (Array.isArray(data?.layers)) {
        const ids = (data.layers as string[])
        const withBg = ids[0] === 'background' ? ids : ['background', ...ids.filter((i) => i !== 'background')]
        const rebuilt = withBg.map((id: string, idx: number) => ({ id, name: id === 'background' ? 'Background' : id, z: idx }))
        setLayers(rebuilt)
      } else {
        setLayers([{ id: 'background', name: 'Background', z: 0 }])
      }
    })
    return () => unsub()
  }, [projectId, setBackground, setAspect, setLayers])

  const persistBackground = async (next: { mode: 'none' | 'solid' | 'linear' | 'radial'; from: string; to: string }) => {
    setBackground(next)
    if (!projectId) return
    const rootCanvasRef = doc(db, 'interoperable-canvas', projectId, 'canvases', 'root')
    await setDoc(rootCanvasRef, { background: next }, { merge: true })
  }

  const persistAspect = async (next: '1:1' | '16:9' | '4:3' | '9:16' | '4:6') => {
    setAspect(next)
    if (!projectId) return
    const rootCanvasRef = doc(db, 'interoperable-canvas', projectId, 'canvases', 'root')
    await setDoc(rootCanvasRef, { aspect: next }, { merge: true })
  }

  const layersDebounceRef = useRef<any>(null)
  const persistLayersDebounced = (nextLayers: any[]) => {
    if (!projectId) return
    if (layersDebounceRef.current) clearTimeout(layersDebounceRef.current)
    layersDebounceRef.current = setTimeout(async () => {
      const ids = nextLayers.map((l: any) => l.id).filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx)
      const ensured = ids[0] === 'background' ? ids : ['background', ...ids.filter((i) => i !== 'background')]
      const zIndexMap: Record<string, number> = {}
      ensured.forEach((id: string, idx: number) => { zIndexMap[id] = idx })
      const rootCanvasRef = doc(db, 'interoperable-canvas', projectId, 'canvases', 'root')
      await setDoc(rootCanvasRef, { layers: ensured, zIndexMap }, { merge: true })
    }, 200)
  }

  useEffect(() => {
    if (!projectId) return
    persistLayersDebounced(layers)
  }, [projectId, layers])

  return (
    <div className="min-h-screen flex bg-gray-800">
      <div className="w-48 p-4 bg-gray-900 flex flex-col gap-3">
        <Toolbar />
        <RatioSelector onAspectChange={persistAspect} />
      </div>
      <div className="flex-1 overflow-hidden">
        <Canvas aspect={aspect} backgroundColor={bgStyle}>
          <div className="w-full h-full">
            <CanvasHybrid projectId={projectId ?? 'demo'} />
          </div>
        </Canvas>
      </div>
      <BackgroundGradientModal
        open={ui.showBackgroundModal}
        mode={background.mode}
        from={background.from}
        to={background.to}
        onClose={() => closeBackground()}
        onSave={(b) => { persistBackground(b); closeBackground() }}
      />
      <LayersModal open={ui.showLayersModal} onClose={() => closeLayers()} />
      <BoxContentModal projectId={projectId ?? 'demo'} />
    </div>
  )
}


