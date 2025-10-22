'use client'

import React, { useMemo, useState } from 'react'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { doc, getFirestore, setDoc } from 'firebase/firestore'

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

export default function BoxContentModal({ projectId = 'demo', canvasId = 'root' }: { projectId?: string; canvasId?: string }) {
  const open = useCanvasStore((s: any) => s.ui.showBoxModal)
  const close = useCanvasStore((s: any) => s.closeBoxModal)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const overlay = useCanvasStore((s: any) => s.overlay)
  const item = useMemo(() => overlay.find((o: any) => o.id === selectedId), [overlay, selectedId])

  const [tab, setTab] = useState<'background' | 'text' | 'image' | 'animation' | 'dune'>('background')
  const [draft, setDraft] = useState<any>({})

  if (!open || !selectedId) return null

  const save = async () => {
    if (!selectedId) return
    const ref = doc(db, 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay', selectedId)
    const payload: any = {}
    if (tab === 'background') payload.background = draft.background ?? { mode: 'none' }
    if (tab === 'text') Object.assign(payload, { contentType: 'text', text: draft.text, fontSize: draft.fontSize, color: draft.color, bold: !!draft.bold, align: draft.align })
    if (tab === 'image') Object.assign(payload, { contentType: 'image', imageSrc: draft.imageSrc })
    if (tab === 'animation') Object.assign(payload, { contentType: 'animation', lottieSrc: draft.lottieSrc })
    if (tab === 'dune') Object.assign(payload, { contentType: 'dune', duneQueryId: draft.duneQueryId })
    await setDoc(ref, payload, { merge: true })
    close()
  }

  const TabButton = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      className={`px-2 py-1 text-xs border rounded ${tab === id ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white text-gray-900 p-4 rounded-lg w-[560px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold truncate">Edit Box · {selectedId}</h3>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 text-xs border rounded" onClick={close}>Close</button>
            <button className="px-2 py-1 text-xs border rounded bg-blue-600 text-white" onClick={save}>Save</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          <TabButton id="background" label="Background" />
          <TabButton id="text" label="Text" />
          <TabButton id="image" label="Image" />
          <TabButton id="animation" label="Animation" />
          <TabButton id="dune" label="Dune" />
        </div>
        <div className="border rounded p-3 bg-gray-50">
          {tab === 'background' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Mode</span>
                <select value={draft.background?.mode ?? item?.background?.mode ?? 'none'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), mode: e.target.value } })}>
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span>From</span>
                <input type="color" value={draft.background?.from ?? item?.background?.from ?? '#000000'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), from: e.target.value } })} />
              </label>
              <label className="grid gap-1">
                <span>To</span>
                <input type="color" value={draft.background?.to ?? item?.background?.to ?? '#000000'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), to: e.target.value } })} />
              </label>
            </div>
          )}
          {tab === 'text' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Text</span>
                <input value={draft.text ?? item?.text ?? ''} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span>Font size</span>
                <input type="number" value={draft.fontSize ?? item?.fontSize ?? 18} onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })} />
              </label>
              <label className="grid gap-1">
                <span>Color</span>
                <input type="color" value={draft.color ?? item?.color ?? '#ffffff'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.bold ?? item?.bold ?? false} onChange={(e) => setDraft({ ...draft, bold: e.target.checked })} />
                <span>Bold</span>
              </label>
              <label className="grid gap-1">
                <span>Align</span>
                <select value={draft.align ?? item?.align ?? 'left'} onChange={(e) => setDraft({ ...draft, align: e.target.value })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          )}
          {tab === 'image' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Image URL</span>
                <input value={draft.imageSrc ?? item?.imageSrc ?? ''} onChange={(e) => setDraft({ ...draft, imageSrc: e.target.value })} />
              </label>
            </div>
          )}
          {tab === 'animation' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Lottie JSON URL</span>
                <input value={draft.lottieSrc ?? item?.lottieSrc ?? ''} onChange={(e) => setDraft({ ...draft, lottieSrc: e.target.value })} />
              </label>
            </div>
          )}
          {tab === 'dune' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Dune Query ID</span>
                <input value={draft.duneQueryId ?? item?.duneQueryId ?? ''} onChange={(e) => setDraft({ ...draft, duneQueryId: e.target.value })} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



