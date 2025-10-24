'use client'

import React, { useEffect, useRef, useState } from 'react'
import CanvasHybrid from './CanvasHybrid'
import { Toolbar } from './Toolbar'
import { RatioSelector } from './RatioSelector'
import { Canvas } from './Canvas'
import { useCanvasStore } from '@/app/interoperable-canvas/components/store'
import { BackgroundGradientModal } from './BackgroundGradientModal'
import LayersModal from '@/app/interoperable-canvas/components/LayersModal'
import BoxContentModal from '@/app/interoperable-canvas/components/BoxContentModal'
import ConnectWalletButton from './ConnectWalletButton'

import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, onSnapshot, setDoc, collection, getDocs } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'

type CanvasScope = { type: 'root' } | { type: 'child'; childId: string }
type Props = { projectId?: string; scope?: CanvasScope; canvasId?: string }

// Basic client-side Firebase init using env vars already used elsewhere in app
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
const storage = getStorage(app)

export function CanvasApp({ projectId, scope: initialScope = { type: 'root' }, canvasId = 'root' }: Props) {
  const [scope, setScope] = useState<CanvasScope>(initialScope)
  const [childIds, setChildIds] = useState<string[]>([])
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

  // Removed window events; use Zustand UI slice instead

  const bgStyle = background.mode === 'linear'
    ? `linear-gradient(135deg, ${background.from}, ${background.to})`
    : background.mode === 'radial'
    ? `radial-gradient(circle, ${background.from}, ${background.to})`
    : background.mode === 'solid'
    ? background.from
    : ''

  const buildPath = (...tail: string[]) => {
    if (!projectId) return tail
    const base: string[] = ['interoperable-canvas', projectId]
    if (scope.type === 'child') base.push('child-canvases', scope.childId)
    base.push('canvases', canvasId)
    return [...base, ...tail]
  }

  // Load list of child canvases for selector
  useEffect(() => {
    if (!projectId) { setChildIds([]); return }
    const load = async () => {
      try {
        const col = collection(db, ['interoperable-canvas', projectId, 'child-canvases'].join('/'))
        const snap = await getDocs(col)
        const ids: string[] = []
        snap.forEach((d) => ids.push(d.id))
        setChildIds(ids.sort())
      } catch {
        setChildIds([])
      }
    }
    load()
  }, [projectId])

  // Sync background, aspect ratio, and layers with Firestore (scoped canvas)
  useEffect(() => {
    if (!projectId) return
    const rootCanvasRef = doc(db, buildPath().join('/'))
    const unsub = onSnapshot(rootCanvasRef, (snap) => {
      const data = snap.data() as any
      if (data?.background && typeof data.background === 'object') {
        setBackground({
          mode: (data.background.mode ?? 'none'),
          from: data.background.from ?? '#000000',
          to: data.background.to ?? '#000000',
        })
      } else {
        // Set default gradient colors when no background saved
        setBackground({
          mode: 'linear',
          from: 'rgb(50, 250, 150)',
          to: 'rgb(150, 200, 250)',
        })
        // Also seed Firestore so returning users see it
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
        // Merge overlay names into layers display
        // We read names from overlay collection for display purposes
        const rebuilt = withBg.map((id: string, idx: number) => ({ id, name: id === 'background' ? 'Background' : id, z: idx }))
        setLayers(rebuilt)
      } else {
        setLayers([{ id: 'background', name: 'Background', z: 0 }])
      }
    })
    return () => unsub()
  }, [projectId, scope, canvasId, setBackground, setAspect, setLayers])

  const persistBackground = async (next: { mode: 'none' | 'solid' | 'linear' | 'radial'; from: string; to: string }) => {
    setBackground(next)
    if (!projectId) return
    const rootCanvasRef = doc(db, buildPath().join('/'))
    await setDoc(rootCanvasRef, { background: next }, { merge: true })
  }

  const persistAspect = async (next: '1:1' | '16:9' | '4:3' | '9:16' | '4:6' | 'mini-app') => {
    setAspect(next)
    if (!projectId) return
    const rootCanvasRef = doc(db, buildPath().join('/'))
    await setDoc(rootCanvasRef, { aspect: next }, { merge: true })
  }

  // Debounced layers persistence (150–250ms)
  const layersDebounceRef = useRef<any>(null)
  const persistLayersDebounced = (nextLayers: any[]) => {
    if (!projectId) return
    if (layersDebounceRef.current) clearTimeout(layersDebounceRef.current)
    layersDebounceRef.current = setTimeout(async () => {
      const ids = nextLayers.map((l: any) => l.id).filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx)
      const ensured = ids[0] === 'background' ? ids : ['background', ...ids.filter((i) => i !== 'background')]
      const zIndexMap: Record<string, number> = {}
      ensured.forEach((id: string, idx: number) => { zIndexMap[id] = idx })
      const rootCanvasRef = doc(db, buildPath().join('/'))
      await setDoc(rootCanvasRef, { layers: ensured, zIndexMap }, { merge: true })
    }, 200)
  }

  // Persist whenever local layers change
  useEffect(() => {
    if (!projectId) return
    persistLayersDebounced(layers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, layers])

  return (
    <div className="min-h-screen flex bg-gray-800">
      <div className="w-48 p-4 bg-gray-900 flex flex-col gap-3">
        <ConnectWalletButton />
        <Toolbar />
        <RatioSelector onAspectChange={persistAspect} />
        {/* Scope selector for root vs child group */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Canvas Scope</label>
          <select
            value={scope.type === 'root' ? 'root' : `child:${scope.childId}`}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'root') setScope({ type: 'root' })
              else if (v.startsWith('child:')) setScope({ type: 'child', childId: v.split(':')[1] || 'mini-app-test' })
            }}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
          >
            <option value="root">Root</option>
            {childIds.map((id) => (
              <option key={id} value={`child:${id}`}>Child: {id}</option>
            ))}
          </select>
        </div>
        {/* Create child canvas */}
        <button
          className="w-full px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          onClick={async () => {
            if (!projectId) return
            const childId = prompt('New child canvas id (e.g., mini-app-test-2)')?.trim()
            if (!childId) return
            // Create child metadata doc and root canvas doc
            const childMetaPath = ['interoperable-canvas', projectId, 'child-canvases', childId].join('/')
            await setDoc(doc(db, childMetaPath), { createdAt: Date.now() }, { merge: true })
            const path = ['interoperable-canvas', projectId, 'child-canvases', childId, 'canvases', 'root'].join('/')
            await setDoc(doc(db, path), { aspect: aspect ?? '1:1', createdAt: Date.now() }, { merge: true })
            // Create storage folders by uploading a placeholder file under images/
            try {
              const keepPath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/images/.keep`
              const bytes = new Blob(['placeholder'], { type: 'text/plain' })
              await uploadBytes(storageRef(storage, keepPath), bytes, { cacheControl: 'no-store' })
            } catch {}
            setScope({ type: 'child', childId })
            // refresh list
            try {
              const col = collection(db, ['interoperable-canvas', projectId, 'child-canvases'].join('/'))
              const snap = await getDocs(col)
              const ids: string[] = []
              snap.forEach((d) => ids.push(d.id))
              setChildIds(ids.sort())
            } catch {}
          }}
        >
          New Child Canvas
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Canvas aspect={aspect} backgroundColor={bgStyle}>
          <div className="w-full h-full">
            <CanvasHybrid projectId={projectId ?? 'demo'} scope={scope} canvasId={canvasId} />
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
      {/* scope-aware modals */}
      {/* @ts-ignore add scope prop */}
      <LayersModal open={ui.showLayersModal} onClose={() => closeLayers()} projectId={projectId ?? 'demo'} canvasId={canvasId} scope={scope} />
      {/* @ts-ignore add scope prop */}
      <BoxContentModal projectId={projectId ?? 'demo'} canvasId={canvasId} scope={scope} />
    </div>
  )
}
