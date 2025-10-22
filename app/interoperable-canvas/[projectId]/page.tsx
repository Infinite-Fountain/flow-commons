'use client'

import React from 'react'
import { CanvasApp } from '../components/CanvasApp'

export default function ProjectCanvasPage({ params }: { params: { projectId: string } }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <CanvasApp projectId={params.projectId} />
    </div>
  )
}


