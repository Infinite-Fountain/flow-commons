'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useCanvasStore } from './store'
import { ZigzagGradient } from './ZigzagGradient'

interface CanvasProps {
  aspect: '1:1' | '16:9' | '4:3' | '9:16' | '4:6' | 'mini-app' | 'landing-page' | 'mobile-landing-page'
  backgroundColor: string
  backgroundMode?: 'none' | 'solid' | 'linear' | 'radial' | 'zigzag'
  backgroundFrom?: string
  backgroundTo?: string
  className?: string
  children: React.ReactNode
  presentation?: boolean // when true, hide header simulator
  fullscreen?: boolean // when true, remove all margins and fill entire viewport
}

export function Canvas({ aspect, backgroundColor, backgroundMode, backgroundFrom, backgroundTo, className = '', children, presentation = false, fullscreen = false }: CanvasProps) {
  const overlay = useCanvasStore((s) => s.overlay)
  const [viewportHeight, setViewportHeight] = useState(() => 
    typeof window !== 'undefined' ? window.innerHeight : 800
  )
  const [viewportWidth, setViewportWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1920
  )
  
  // Update viewport dimensions on window resize
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      setViewportHeight(window.innerHeight)
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const getAspectRatio = () => {
    switch (aspect) {
      case '1:1': return 'aspect-square'
      case '16:9': return 'aspect-video'
      case '4:3': return 'aspect-[4/3]'
      case '9:16': return 'aspect-[9/16]'
      case '4:6': return 'aspect-[4/6]'
      case 'mini-app': return 'aspect-[9/16]'
      case 'landing-page': return '' // No aspect ratio constraint for landing-page
      case 'mobile-landing-page': return '' // No aspect ratio constraint for mobile landing-page
      default: return 'aspect-square'
    }
  }
  
  // Calculate dynamic height for landing-page based on box positions
  const calculatedHeight = useMemo(() => {
    if (aspect !== 'landing-page' && aspect !== 'mobile-landing-page') return null
    
    if (overlay.length === 0) {
      // If no boxes, use viewport height as minimum
      return viewportHeight
    }
    
    // Find the bottom-most box (y + h)
    const bottomMostBox = overlay.reduce((max, box) => {
      const bottom = box.y + box.h
      return bottom > max ? bottom : max
    }, 0)
    
    // Add padding (50% of viewport height) to ensure there's always space below
    const padding = viewportHeight * 0.5
    const minHeight = viewportHeight
    
    return Math.max(minHeight, bottomMostBox + padding)
  }, [aspect, overlay, viewportHeight])

  const getContainerClasses = () => {
    // For landing-page, use flex container to center canvas
    if (aspect === 'landing-page' || aspect === 'mobile-landing-page') {
      return 'w-full flex justify-center'
    }
    // For horizontal aspect ratios, use full width
    if (aspect === '1:1' || aspect === '16:9' || aspect === '4:3') {
      return 'w-full h-screen flex items-center justify-center'
    }
    // For vertical aspect ratios, constrain to screen height
    return 'w-full h-screen flex items-center justify-center'
  }

  const getCanvasClasses = () => {
    // In fullscreen mode, remove all margins and use full viewport
    if (fullscreen) {
      return `${getAspectRatio()} w-full h-full`
    }
    
    // For landing-page, fixed 1100px in presentation, responsive in edit
    if (aspect === 'landing-page') {
      return presentation ? `block mt-[20px] box-border` : `block mt-[20px] box-border w-full max-w-full`
    }
    // For mobile-landing-page, fixed 390px in both presentation and edit mode
    if (aspect === 'mobile-landing-page') {
      return `block mt-[20px] box-border`
    }
    
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
            style={{ background: backgroundColor || 'transparent', position: 'relative' }}
          >
            {backgroundMode === 'zigzag' && backgroundFrom && backgroundTo && (
              <ZigzagGradient from={backgroundFrom} to={backgroundTo} />
            )}
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

  // Special handling for landing-page with dynamic height
  if (aspect === 'landing-page') {
    // Calculate responsive width for presentation mode
    // Desktop/Tablet: 1100px fixed, Mobile (≤768px): scale to fit viewport width
    const isMobile = presentation && viewportWidth <= 768
    const presentationWidth = presentation && !isMobile ? '1100px' : '100%'
    const scale = isMobile ? viewportWidth / 1100 : 1
    const scaledHeight = isMobile && calculatedHeight ? calculatedHeight * scale : calculatedHeight
    
    return (
      <div 
        className={isMobile ? `w-full ${className}` : `${getContainerClasses()} ${className}`} 
        style={isMobile ? { width: '100vw', overflowX: 'hidden', display: 'block' } : {}}
      >
        <div 
          className={getCanvasClasses()}
          style={{ 
            minHeight: scaledHeight || '100vh',
            height: scaledHeight ? `${scaledHeight}px` : 'auto',
            width: presentation ? (isMobile ? `${viewportWidth}px` : presentationWidth) : '100%',
            maxWidth: presentation ? (isMobile ? `${viewportWidth}px` : presentationWidth) : '100%',
            boxSizing: 'border-box',
            border: 'none',
            overflow: isMobile ? 'visible' : 'hidden',
            margin: isMobile ? '0' : undefined
          }}
        >
          <div 
            className="w-full relative mx-auto"
            style={{ 
              background: backgroundColor || 'transparent',
              minHeight: calculatedHeight || '100vh',
              height: calculatedHeight ? `${calculatedHeight}px` : 'auto',
              width: '1100px',
              maxWidth: '1100px',
              boxSizing: 'border-box',
              border: 'none',
              zIndex: presentation ? 1 : 'auto',
              position: 'relative',
              transform: isMobile ? `scale(${scale})` : 'none',
              transformOrigin: 'top left'
            }}
          >
            {backgroundMode === 'zigzag' && backgroundFrom && backgroundTo && (
              <ZigzagGradient from={backgroundFrom} to={backgroundTo} />
            )}
            {children}
          </div>
        </div>
      </div>
    )
  }

  // Special handling for mobile-landing-page with dynamic height (390px width)
  if (aspect === 'mobile-landing-page') {
    return (
      <div className={`${getContainerClasses()} ${className}`}>
        <div 
          className={getCanvasClasses()}
          style={{ 
            minHeight: calculatedHeight || '100vh',
            height: calculatedHeight ? `${calculatedHeight}px` : 'auto',
            width: '390px',
            maxWidth: '390px',
            boxSizing: 'border-box',
            border: 'none'
          }}
        >
          <div 
            className="w-full relative mx-auto"
            style={{ 
              background: backgroundColor || 'transparent',
              minHeight: calculatedHeight || '100vh',
              height: calculatedHeight ? `${calculatedHeight}px` : 'auto',
              width: '390px',
              maxWidth: '390px',
              boxSizing: 'border-box',
              border: 'none',
              zIndex: presentation ? 1 : 'auto',
              position: 'relative'
            }}
          >
            {backgroundMode === 'zigzag' && backgroundFrom && backgroundTo && (
              <ZigzagGradient from={backgroundFrom} to={backgroundTo} />
            )}
            {children}
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
          style={{ background: backgroundColor || 'transparent', position: 'relative' }}
        >
          {backgroundMode === 'zigzag' && backgroundFrom && backgroundTo && (
            <ZigzagGradient from={backgroundFrom} to={backgroundTo} />
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
