'use client'

import React from 'react'

interface CanvasProps {
  aspect: '1:1' | '16:9' | '4:3' | '9:16' | '4:6' | 'mini-app'
  backgroundColor: string
  className?: string
  children: React.ReactNode
  presentation?: boolean // when true, hide header simulator
}

export function Canvas({ aspect, backgroundColor, className = '', children, presentation = false }: CanvasProps) {
  const getAspectRatio = () => {
    switch (aspect) {
      case '1:1': return 'aspect-square'
      case '16:9': return 'aspect-video'
      case '4:3': return 'aspect-[4/3]'
      case '9:16': return 'aspect-[9/16]'
      case '4:6': return 'aspect-[4/6]'
      case 'mini-app': return 'aspect-[9/16]'
      default: return 'aspect-square'
    }
  }

  const getContainerClasses = () => {
    // For horizontal aspect ratios, use full width
    if (aspect === '1:1' || aspect === '16:9' || aspect === '4:3') {
      return 'w-full h-screen flex items-center justify-center'
    }
    // For vertical aspect ratios, constrain to screen height
    return 'w-full h-screen flex items-center justify-center'
  }

  const getCanvasClasses = () => {
    // For square, fit to height to maintain square shape on any screen
    if (aspect === '1:1') {
      return `${getAspectRatio()} h-[95%] max-w-full mx-[10px]`
    }
    // For 16:9, use full width with margins
    if (aspect === '16:9') {
      return `${getAspectRatio()} w-full max-h-full mx-[20px]`
    }
    // For 4:3, use 95% height
    if (aspect === '4:3') {
      return `${getAspectRatio()} h-[95%] max-w-full mx-[20px]`
    }
    // For vertical aspect ratios, constrain to screen height (ensure explicit height)
    return `${getAspectRatio()} h-[95%] max-w-full mx-[10px]`
  }

  if (aspect === 'mini-app') {
    return (
      <div className={`${getContainerClasses()} ${className}`}>
        <div className={getCanvasClasses()}>
          <div 
            className="w-full h-full relative overflow-hidden"
            style={{ background: backgroundColor || 'transparent' }}
          >
            {/* Header simulator */}
            {!presentation && (
              <div
                style={{
                  position: 'absolute',
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  top: 0,
                  height: '10%', // chosen per user: Option B
                  background: '#ffffff',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />
            )}
            {/* Safe region for overlays */}
            <div
              style={{
                position: 'absolute',
                insetInlineStart: 0,
                insetInlineEnd: 0,
                top: presentation ? '0%' : '10%',
                bottom: '2.5%', // Option A bottom padding
              }}
            >
              <div className="w-full h-full relative" style={{ zIndex: 1 }}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
