'use client'

import React from 'react'
import { FreeformOverlay } from './FreeformOverlay'

type CanvasScope = { type: 'root' } | { type: 'child'; childId: string }

export default function CanvasHybrid({ projectId = 'demo', scope = { type: 'root' }, canvasId = 'root' }: { projectId?: string; scope?: CanvasScope; canvasId?: string }) {
  return (
    <div className="w-full h-full relative">
      <FreeformOverlay projectId={projectId} canvasId={canvasId} scope={scope} />
    </div>
  )
}
