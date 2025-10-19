import React from 'react'

export type CanvasAspect = '1:1' | '16:9' | '4:3'

export interface CanvasProps {
  aspect?: CanvasAspect
  backgroundColor?: string
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function Canvas({ aspect = '1:1', backgroundColor = '#000', children, style }: CanvasProps) {
  const [w, h] = aspect.split(':').map(Number)
  const paddingTop = `${(h / w) * 100}%`
  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <div style={{ width: '100%', paddingTop }} />
      <div style={{ position: 'absolute', inset: 0, background: backgroundColor }}>{children}</div>
    </div>
  )
}

