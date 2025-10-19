import React from 'react'
import { BackgroundLottieLayers } from './components/BackgroundLottieLayers'
import { FreeformOverlay } from './FreeformOverlay'

export function CanvasHybrid() {
  return (
    <div style={{ width: '100%', height: '100%', padding: 16, position: 'relative' }}>
      <BackgroundLottieLayers />
      <FreeformOverlay />
    </div>
  )
}

