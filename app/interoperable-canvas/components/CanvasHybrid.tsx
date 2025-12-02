'use client'

import React from 'react'
import { FreeformOverlay } from './FreeformOverlay'

type CanvasScope = { type: 'root' } | { type: 'child'; childId: string }

export default function CanvasHybrid({ projectId = 'demo', scope = { type: 'root' }, canvasId = 'root', presentation = false, isAuthorized = false }: { projectId?: string; scope?: CanvasScope; canvasId?: string; presentation?: boolean; isAuthorized?: boolean }) {
  return (
    <div className="w-full h-full relative">
      <FreeformOverlay projectId={projectId} canvasId={canvasId} scope={scope} presentation={presentation} isAuthorized={isAuthorized} />
    </div>
  )
}
