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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Generate</label>
        <select
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value
            if (value === 'gardens-pool-report') {
              // Get current URL parameters
              const urlParams = new URLSearchParams(window.location.search)
              const projectId = urlParams.get('projectId')
              const childId = urlParams.get('childId')
              
              // Build the gardens report builder URL
              const builderUrl = new URL('/interoperable-canvas/gardens-report-builder', window.location.origin)
              if (projectId) builderUrl.searchParams.set('projectId', projectId)
              if (childId) builderUrl.searchParams.set('childId', childId)
              
              // Open in new tab
              window.open(builderUrl.toString(), '_blank')
              // Reset select to default
              e.target.value = ''
            }
          }}
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
        >
          <option value="" disabled>Select...</option>
          <option value="gardens-pool-report">Gardens Pool Report</option>
        </select>
      </div>

    </div>
  )
}


