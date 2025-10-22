'use client'

import React from 'react'
import { FreeformOverlay } from './FreeformOverlay'

export default function CanvasHybrid({ projectId = 'demo' }: { projectId?: string }) {
  return (
    <div className="w-full h-full relative">
      <FreeformOverlay projectId={projectId} />
    </div>
  )
}


