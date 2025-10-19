import React from 'react'
export { ThemeProvider, useTheme } from './theme/ThemeProvider'

export type CanvasAspect = '1:1' | '16:9' | '4:3'

export interface CanvasProps {
  aspect?: CanvasAspect
  children?: React.ReactNode
}

export function Canvas({ aspect = '1:1', children }: CanvasProps) {
  const [w, h] = aspect.split(':').map(Number)
  const paddingTop = `${(h / w) * 100}%`
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1024 }}>
      <div style={{ width: '100%', paddingTop }} />
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  )
}

