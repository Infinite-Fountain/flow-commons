'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { CanvasApp } from '../interoperable-canvas/components/CanvasApp'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any)
const db = getFirestore(app)

// Reserved routes that should not be handled by the catch-all route
const RESERVED_ROUTES = ['interoperable-canvas', 'api', 'firestore-config']

function ProjectSlugRouter() {
  const params = useParams()
  const searchParams = useSearchParams()
  
  // Extract slug from actual URL pathname (not pre-rendered params)
  // This ensures we get the real URL even when Firebase rewrite serves /_/index.html
  const [slug, setSlug] = useState<string | null>(null)
  const childId = searchParams?.get('childId') || null
  
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Extract slug from URL pathname on client side
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const pathname = window.location.pathname
    // Remove leading and trailing slashes, then get first segment
    const cleanPath = pathname.replace(/^\/+|\/+$/g, '')
    const segments = cleanPath.split('/').filter(Boolean)
    const firstSegment = segments.length > 0 ? segments[0] : null
    
    setSlug(firstSegment)
  }, [])

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      return
    }

    // Check if this is a reserved route
    if (RESERVED_ROUTES.includes(slug)) {
      setNotFound(true)
      setIsLoading(false)
      return
    }

    // CRITICAL: Project slug URLs require presentation=true parameter
    // This prevents unauthorized access to the editor via clean URLs
    // Only presentation mode is allowed for project slug routes
    const isPresentation = searchParams?.get('presentation') === 'true'
    if (!isPresentation) {
      // Block access - show 404 if presentation parameter is missing
      setNotFound(true)
      setIsLoading(false)
      return
    }

    // Look up project by slug (slug is the same as projectId in Firestore)
    const checkProject = async () => {
      try {
        const projectRef = doc(db, 'interoperable-canvas', slug)
        const projectSnap = await getDoc(projectRef)
        
        if (projectSnap.exists()) {
          // Project found - use slug as projectId
          setProjectId(slug)
          setIsLoading(false)
        } else {
          // Project not found
          setNotFound(true)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error looking up project:', error)
        setNotFound(true)
        setIsLoading(false)
      }
    }

    checkProject()
  }, [slug, searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-2">404</h1>
          <p>Project not found</p>
        </div>
      </div>
    )
  }

  if (!projectId) {
    return null
  }

  // Render CanvasApp with the projectId from slug
  const scope = childId ? { type: 'child' as const, childId } : { type: 'root' as const }
  
  return (
    <div className="min-h-screen bg-gray-900">
      <CanvasApp projectId={projectId} scope={scope} />
    </div>
  )
}

export default function ProjectSlugClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ProjectSlugRouter />
    </Suspense>
  )
}

