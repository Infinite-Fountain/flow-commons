'use client'

import React from 'react'
import { useCanvasStore } from './store'

export default function LayersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layers = useCanvasStore((s: any) => s.layers)
  const moveLayerUp = useCanvasStore((s: any) => s.moveLayerUp)
  const moveLayerDown = useCanvasStore((s: any) => s.moveLayerDown)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const setSelectedId = useCanvasStore((s: any) => s.setSelectedId)

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
                <div className="font-medium">{l.name || l.id}</div>
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


