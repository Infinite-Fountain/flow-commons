'use client'

import React from 'react'
import { useCanvasStore } from './store'

export function Toolbar() {
  const openBackground = useCanvasStore((s) => s.openBackgroundModal)
  const setTool = useCanvasStore((s) => s.setTool)

  return (
    <div className="space-y-2 relative">
      <button
        className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => setTool('add-box')}
      >
        Add Box
      </button>
      <button
        className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        onClick={() => openBackground()}
      >
        Background
      </button>
      <button
        className="w-full px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        onClick={useCanvasStore.getState().openLayersModal}
      >
        Layers
      </button>

    </div>
  )
}


