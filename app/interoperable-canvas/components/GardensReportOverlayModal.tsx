'use client'

import React, { useMemo } from 'react'
import { useCanvasStore } from './store'

export default function GardensReportOverlayModal() {
  const open = useCanvasStore((s: any) => s.ui.showGardensReportOverlayModal)
  const close = useCanvasStore((s: any) => s.closeGardensReportOverlayModal)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const overlay = useCanvasStore((s: any) => s.overlay)
  const item = useMemo(() => overlay.find((o: any) => o.id === selectedId), [overlay, selectedId])

  if (!open || !selectedId || !item) return null

  const linkType = (item as any)?.linkType || 'unknown'
  const url = (item as any)?.url || ''
  const proposalId = (item as any)?.proposalId || ''

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white text-gray-900 p-4 rounded-lg w-[560px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Gardens Report Overlay (Read-Only)</h2>
          <button className="px-2 py-1 text-xs border rounded" onClick={close}>Close</button>
        </div>

        <div className="space-y-4">
          <div className="text-xs text-gray-600 mb-4">
            This is a clickable overlay box for a Gardens report. It cannot be modified directly.
            To change the report size or position, edit the main Gardens Report box.
          </div>

          <div className="border rounded p-3 bg-gray-50 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="font-medium">Link Type:</div>
              <div className="capitalize">{linkType}</div>
              
              <div className="font-medium">Proposal ID:</div>
              <div className="font-mono text-[10px] break-all">{proposalId || 'N/A'}</div>
              
              <div className="font-medium">URL:</div>
              <div className="break-all">
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {url || 'N/A'}
                </a>
              </div>
              
              <div className="font-medium">Position:</div>
              <div>X: {item.x}px, Y: {item.y}px</div>
              
              <div className="font-medium">Size:</div>
              <div>W: {item.w}px, H: {item.h}px</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
