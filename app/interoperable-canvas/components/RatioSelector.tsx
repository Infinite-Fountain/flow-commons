'use client'

import React from 'react'
import { useCanvasStore } from './store'

interface RatioSelectorProps {
  onAspectChange?: (aspect: '1:1' | '16:9' | '4:3' | '9:16' | '4:6' | 'mini-app') => void
}

export function RatioSelector({ onAspectChange }: RatioSelectorProps) {
  const { aspect, setAspect } = useCanvasStore()

  const handleChange = (newAspect: '1:1' | '16:9' | '4:3' | '9:16' | '4:6' | 'mini-app') => {
    setAspect(newAspect)
    onAspectChange?.(newAspect)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">Aspect Ratio</label>
      <select 
        value={aspect} 
        onChange={(e) => handleChange(e.target.value as any)}
        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
      >
        <option value="16:9">16:9 (Widescreen)</option>
        <option value="4:3">4:3 (Standard)</option>
        <option value="1:1">1:1 (Square)</option>
        <option value="4:6">4:6 (Vertical Post)</option>
        <option value="9:16">9:16 (Vertical Stories)</option>
        <option value="mini-app">Mini App (9:16 safe)</option>
      </select>
    </div>
  )
}
