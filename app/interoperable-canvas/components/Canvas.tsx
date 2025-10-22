'use client'

import React from 'react'

interface CanvasProps {
  aspect: '1:1' | '16:9' | '4:3' | '9:16' | '4:6'
  backgroundColor: string
  className?: string
  children: React.ReactNode
}

export function Canvas({ aspect, backgroundColor, className = '', children }: CanvasProps) {
  const getAspectRatio = () => {
    switch (aspect) {
      case '1:1': return 'aspect-square'
      case '16:9': return 'aspect-video'
      case '4:3': return 'aspect-[4/3]'
      case '9:16': return 'aspect-[9/16]'
      case '4:6': return 'aspect-[4/6]'
      default: return 'aspect-square'
    }
  }

  const getContainerClasses = () => {
    if (aspect === '1:1' || aspect === '16:9' || aspect === '4:3') {
      return 'w-full h-screen flex items-center justify-center'
    }
    return 'w-full h-screen flex items-center justify-center'
  }

  const getCanvasClasses = () => {
    if (aspect === '1:1') {
      return `${getAspectRatio()} h-[95%] max-w-full mx-[10px]`
    }
    if (aspect === '16:9') {
      return `${getAspectRatio()} w-full max-h-full mx-[20px]`
    }
    if (aspect === '4:3') {
      return `${getAspectRatio()} h-[95%] max-w-full mx-[20px]`
    }
    return `${getAspectRatio()} max-w-full max-h-full`
  }

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      <div className={getCanvasClasses()}>
        <div 
          className="w-full h-full relative overflow-hidden"
          style={{ background: backgroundColor || 'transparent' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}


