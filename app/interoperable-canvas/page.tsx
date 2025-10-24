'use client'

import React, { Suspense, useState } from 'react'
import ConnectWalletButton from './components/ConnectWalletButton'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useSearchParams } from 'next/navigation'
import { CanvasApp } from './components/CanvasApp'

// Note: In the open-source version, admin access is simplified to wallet-based
// Replace this with your preferred admin authentication method

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
const storage = getStorage(app)

function HomeContent() {
  // Simplified admin check for open-source version
  // Replace with your preferred authentication method
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)
    if (!projectId.trim() || !projectName.trim()) {
      setError('Project ID and Name are required.')
      return
    }
    try {
      setIsSubmitting(true)
      const pid = projectId.trim()
      const pname = projectName.trim()

      // 1) Project doc
      const projectRef = doc(db, 'interoperable-canvas', pid)
      await setDoc(projectRef, {
        name: pname,
        slug: pid,
        createdAt: serverTimestamp(),
        ownerWallet: 'admin', // Simplified for open-source version
      }, { merge: true })

      // 2) Root canvas doc
      const rootCanvasRef = doc(db, 'interoperable-canvas', pid, 'canvases', 'root')
      await setDoc(rootCanvasRef, {
        name: 'Root Canvas',
        createdAt: serverTimestamp(),
        aspect: '16:9',
      }, { merge: true })

      // 3) Storage placeholder to establish folder structure
      try {
        const keepPath = `interoperable-canvas/assets/${pid}/.keep`
        const bytes = new Blob(['placeholder'], { type: 'text/plain' })
        await uploadBytes(storageRef(storage, keepPath), bytes, { cacheControl: 'no-store' })
      } catch {}

      setMessage('Project created successfully.')
      setProjectId('')
      setProjectName('')
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900">Interoperable Canvas — Projects</h1>
        <p className="text-sm text-gray-600 mt-1">Create and manage projects. This homepage does not edit canvases.</p>

        <div className="mt-6">
          <div className="mb-4">
            <ConnectWalletButton />
          </div>
          <div className="text-sm text-gray-600 mb-4">
            <p>For demo purposes, project creation is enabled for all users.</p>
            <p>In production, implement proper admin authentication.</p>
          </div>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Project ID (slug)</label>
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-black"
                placeholder="e.g., gardens-fund"
              />
              <p className="text-xs text-gray-500 mt-1">Storage: interoperable-canvas/assets/{projectId || 'your-id'}/</p>
              <p className="text-xs text-gray-500">Firestore: interoperable-canvas/{projectId || 'your-id'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Project Name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 text-black"
                placeholder="e.g., PGF Gardens"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {isSubmitting ? 'Creating…' : 'Create Project'}
              </button>
            </div>
            {message && (
              <div className="text-green-700 bg-green-50 border border-green-200 rounded p-2 text-sm">{message}</div>
            )}
            {error && (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded p-2 text-sm">{error}</div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default function InteroperableCanvasHomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 text-gray-700 p-6">Loading…</div>}>
      <ProjectRouter />
    </Suspense>
  )
}

function ProjectRouter() {
  const searchParams = useSearchParams()
  const requestedProjectId = searchParams?.get('projectId') || null
  
  if (requestedProjectId) {
    return (
      <div className="min-h-screen bg-gray-900">
        <CanvasApp projectId={requestedProjectId} />
      </div>
    )
  }
  
  return <HomeContent />
}
