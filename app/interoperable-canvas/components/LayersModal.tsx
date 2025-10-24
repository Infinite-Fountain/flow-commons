'use client'

import React, { useRef, useState } from 'react'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

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

export default function LayersModal({ open, onClose, projectId, canvasId = 'root', scope = { type: 'root' } as { type: 'root' } | { type: 'child'; childId: string } }: { open: boolean; onClose: () => void; projectId: string; canvasId?: string; scope?: { type: 'root' } | { type: 'child'; childId: string } }) {
  const layers = useCanvasStore((s: any) => s.layers)
  const overlay = useCanvasStore((s: any) => s.overlay)
  const moveLayerUp = useCanvasStore((s: any) => s.moveLayerUp)
  const moveLayerDown = useCanvasStore((s: any) => s.moveLayerDown)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const setSelectedId = useCanvasStore((s: any) => s.setSelectedId)
  // projectId and canvasId are passed via props now

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const toTimestampSuffix = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const MM = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`
  }

  const pathForCanvasDoc = () => {
    const base: string[] = ['interoperable-canvas', projectId]
    if ((scope as any)?.type === 'child') base.push('child-canvases', (scope as any).childId)
    base.push('canvases', canvasId!)
    return base
  }

  const saveName = async (id: string, name: string) => {
    if (!name.trim() || !projectId) { setEditingId(null); return }
    const uniqueKey = `${name.trim()}_${toTimestampSuffix()}`
    const ref = doc(db, pathForCanvasDoc().concat(['overlay', id]).join('/'))
    await setDoc(ref, { name: name.trim(), nameKey: uniqueKey }, { merge: true })
    setEditingId(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white text-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Layers</h3>
          <button onClick={onClose} className="px-3 py-1 border rounded hover:bg-gray-50">Close</button>
        </div>
        <div className="space-y-2 max-h-80 overflow-auto">
          {layers.length === 0 && (
            <div className="text-sm text-gray-500">No layers yet. Add items to populate.</div>
          )}
          {[...layers]
            .sort((a: any, b: any) => b.z - a.z)
            .map((l: any) => (
            <div
              key={l.id}
              className={`flex items-center justify-between border rounded px-3 py-2 ${selectedId === l.id ? 'bg-gray-100' : ''}`}
              onClick={() => l.id !== 'background' && setSelectedId(l.id)}
            >
              <div className="truncate">
                {editingId === l.id ? (
                  <input
                    className="text-sm border rounded px-1 py-0.5 w-40"
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      const currentName = (overlay.find((it: any) => it.id === l.id)?.name) || l.name || l.id
                      if (e.key === 'Enter') { e.preventDefault(); saveName(l.id, draftName || currentName) }
                      if (e.key === 'Escape') { setEditingId(null) }
                    }}
                    onBlur={() => { const currentName = (overlay.find((it: any) => it.id === l.id)?.name) || l.name || l.id; saveName(l.id, draftName || currentName) }}
                  />
                ) : (
                  <button className="font-medium text-left truncate" onClick={(e) => { e.stopPropagation(); const currentName = (overlay.find((it: any) => it.id === l.id)?.name) || l.name || l.id; setEditingId(l.id); setDraftName(currentName) }}>
                    {(overlay.find((it: any) => it.id === l.id)?.name) || l.name || l.id}
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {l.id !== 'background' && (
                  <button
                    className="w-6 h-6 grid place-items-center text-xs border rounded hover:bg-gray-50"
                    title="Move Up"
                    onClick={(e) => { e.stopPropagation(); moveLayerUp(l.id) }}
                  >
                    ▲
                  </button>
                )}
                {l.id !== 'background' && l.z > 1 && (
                  <button
                    className="w-6 h-6 grid place-items-center text-xs border rounded hover:bg-gray-50"
                    title="Move Down"
                    onClick={(e) => { e.stopPropagation(); moveLayerDown(l.id) }}
                  >
                    ▼
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


