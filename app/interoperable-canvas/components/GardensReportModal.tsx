'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, setDoc, deleteDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any)
const db = getFirestore(app)
const storage = getStorage(app)

const CANVAS_WIDTH = 1100 // Fixed canvas width for landing-page

export default function GardensReportModal({ 
  projectId = 'demo', 
  canvasId = 'root', 
  scope = { type: 'root' } as { type: 'root' } | { type: 'child'; childId: string } 
}: { 
  projectId?: string
  canvasId?: string
  scope?: { type: 'root' } | { type: 'child'; childId: string }
}) {
  const open = useCanvasStore((s: any) => s.ui.showGardensReportModal)
  const close = useCanvasStore((s: any) => s.closeGardensReportModal)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const overlay = useCanvasStore((s: any) => s.overlay)
  const item = useMemo(() => overlay.find((o: any) => o.id === selectedId), [overlay, selectedId])

  const [widthPercent, setWidthPercent] = useState(90) // Default 90% of canvas width
  const [yPosition, setYPosition] = useState(0)
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number; height: number } | null>(null)

  // Load current box values when modal opens
  useEffect(() => {
    if (!open || !item) return

    // Calculate current width as percentage of canvas
    const currentWidth = item.w || CANVAS_WIDTH * 0.9
    const widthPct = Math.round((currentWidth / CANVAS_WIDTH) * 100)
    setWidthPercent(Math.max(50, Math.min(90, widthPct))) // Clamp between 50-90%

    setYPosition(item.y || 0)
    
    // Determine alignment based on x position
    const currentX = item.x || 0
    const currentWidthPx = item.w || CANVAS_WIDTH * 0.9
    const centerX = (CANVAS_WIDTH - currentWidthPx) / 2
    const leftX = 0
    const rightX = CANVAS_WIDTH - currentWidthPx
    
    if (Math.abs(currentX - centerX) < 5) {
      setAlignment('center')
    } else if (Math.abs(currentX - leftX) < 5) {
      setAlignment('left')
    } else if (Math.abs(currentX - rightX) < 5) {
      setAlignment('right')
    } else {
      setAlignment('center') // Default to center
    }

    // Load original image dimensions to calculate aspect ratio
    const loadImageDimensions = async () => {
      try {
        const imageSrc = (item as any)?.imageSrc
        if (!imageSrc) return

        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imageSrc
        })
        setOriginalImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      } catch (error) {
        console.error('Failed to load image dimensions:', error)
      }
    }
    loadImageDimensions()
  }, [open, item])

  if (!open || !selectedId || !item) return null

  const pathForCanvasDoc = () => {
    const base: string[] = ['interoperable-canvas', projectId!]
    if ((scope as any)?.type === 'child') base.push('child-canvases', (scope as any).childId)
    base.push('canvases', canvasId!)
    return base
  }

  const calculateNewBoxDimensions = () => {
    const newWidth = Math.round((widthPercent / 100) * CANVAS_WIDTH)
    
    // Calculate height maintaining aspect ratio
    let newHeight = item.h || newWidth
    if (originalImageDimensions) {
      const aspectRatio = originalImageDimensions.height / originalImageDimensions.width
      newHeight = Math.round(newWidth * aspectRatio)
    } else if (item.w && item.h) {
      // Fallback: use existing aspect ratio
      const aspectRatio = item.h / item.w
      newHeight = Math.round(newWidth * aspectRatio)
    }

    // Calculate x position based on alignment
    let newX = 0
    if (alignment === 'center') {
      newX = Math.round((CANVAS_WIDTH - newWidth) / 2)
    } else if (alignment === 'right') {
      newX = Math.round(CANVAS_WIDTH - newWidth)
    } else {
      newX = 0 // left
    }

    return { newWidth, newHeight, newX, newY: yPosition }
  }

  const save = async () => {
    if (!selectedId || !item) return

    setIsSaving(true)
    try {
      const { newWidth, newHeight, newX, newY } = calculateNewBoxDimensions()
      const overlayCollectionPath = pathForCanvasDoc().concat(['overlay']).join('/')
      
      // Update the PNG box
      const boxRef = doc(db, overlayCollectionPath, selectedId)
      await setDoc(boxRef, {
        x: newX,
        y: newY,
        w: newWidth,
        h: newHeight,
      }, { merge: true })

      // Find all overlay boxes for this gardens-report
      // Firestore doesn't support prefix queries directly, so we fetch all and filter
      const overlayCollectionRef = collection(db, overlayCollectionPath)
      const allOverlayBoxesSnapshot = await getDocs(overlayCollectionRef)
      
      // Filter to only overlay boxes that belong to this gardens-report
      const overlayBoxes = allOverlayBoxesSnapshot.docs.filter((docSnap) => {
        const overlayId = docSnap.id
        // Check if overlay ID starts with the PNG box ID followed by _overlay_
        return overlayId.startsWith(`${selectedId}_overlay_`)
      })

      if (overlayBoxes.length === 0) {
        // No overlay boxes found, just update the PNG box
        close()
        return
      }

      // Calculate scale factors
      const oldWidth = item.w || CANVAS_WIDTH * 0.9
      const oldHeight = item.h || (item.w ? item.w : CANVAS_WIDTH * 0.9)
      const oldX = item.x || 0
      const oldY = item.y || 0

      const scaleX = newWidth / oldWidth
      const scaleY = newHeight / oldHeight

      // Update each overlay box proportionally
      const updatePromises = overlayBoxes.map(async (docSnap) => {
        const overlayData = docSnap.data()
        const overlayId = docSnap.id

        // Calculate overlay position relative to old PNG box
        const relativeX = overlayData.x - oldX
        const relativeY = overlayData.y - oldY

        // Scale the relative position
        const newRelativeX = Math.round(relativeX * scaleX)
        const newRelativeY = Math.round(relativeY * scaleY)
        const newOverlayW = Math.round((overlayData.w || 0) * scaleX)
        const newOverlayH = Math.round((overlayData.h || 0) * scaleY)

        // Calculate new absolute position
        const newOverlayX = newX + newRelativeX
        const newOverlayY = newY + newRelativeY

        // Update overlay box
        const overlayRef = doc(db, overlayCollectionPath, overlayId)
        await setDoc(overlayRef, {
          x: newOverlayX,
          y: newOverlayY,
          w: newOverlayW,
          h: newOverlayH,
        }, { merge: true })
      })

      await Promise.all(updatePromises)
      close()
    } catch (error) {
      console.error('Error saving gardens report:', error)
      alert(`Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId || !item) return

    setIsDeleting(true)
    try {
      const overlayCollectionPath = pathForCanvasDoc().concat(['overlay']).join('/')
      const overlayCollectionRef = collection(db, overlayCollectionPath)
      
      // Get all overlay boxes to find ones belonging to this gardens-report
      const allBoxesSnapshot = await getDocs(overlayCollectionRef)
      
      // Find all overlay boxes that belong to this gardens-report
      const overlayBoxesToDelete = allBoxesSnapshot.docs.filter((docSnap) => {
        const overlayId = docSnap.id
        return overlayId.startsWith(`${selectedId}_overlay_`)
      })

      // Delete all overlay boxes
      const deleteOverlayPromises = overlayBoxesToDelete.map(async (docSnap) => {
        const overlayRef = doc(db, overlayCollectionPath, docSnap.id)
        await deleteDoc(overlayRef)
      })

      // Delete the main PNG box
      const mainBoxRef = doc(db, overlayCollectionPath, selectedId)
      await deleteDoc(mainBoxRef)

      // Wait for all deletions to complete
      await Promise.all(deleteOverlayPromises)

      // Remove from layers array
      const canvasRef = doc(db, pathForCanvasDoc().join('/'))
      const canvasSnap = await getDoc(canvasRef)
      if (canvasSnap.exists()) {
        const currentLayers = canvasSnap.data().layers || []
        const layersToRemove = [selectedId, ...overlayBoxesToDelete.map(d => d.id)]
        const newLayers = currentLayers.filter((id: string) => !layersToRemove.includes(id))
        const newZIndexMap: Record<string, number> = {}
        newLayers.forEach((id: string, idx: number) => {
          newZIndexMap[id] = idx
        })
        await setDoc(canvasRef, { layers: newLayers, zIndexMap: newZIndexMap }, { merge: true })
      }

      setShowDeleteConfirm(false)
      close()
    } catch (error) {
      console.error('Error deleting gardens report:', error)
      alert(`Error deleting: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const { newWidth, newHeight, newX, newY } = calculateNewBoxDimensions()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white text-gray-900 p-4 rounded-lg w-[560px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Gardens Report Settings</h2>
          <div className="flex items-center gap-2">
            <button 
              className="px-2 py-1 text-xs border rounded text-red-700 border-red-600 hover:bg-red-50 disabled:opacity-50" 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting || isSaving}
            >
              Delete
            </button>
            <button className="px-2 py-1 text-xs border rounded" onClick={close}>Close</button>
            <button 
              className="px-2 py-1 text-xs border rounded bg-blue-600 text-white disabled:opacity-50" 
              onClick={save}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Width slider */}
          <div className="grid gap-2 text-xs">
            <label className="grid gap-1">
              <span>Width: {widthPercent}% ({newWidth}px)</span>
              <input
                type="range"
                min="50"
                max="90"
                value={widthPercent}
                onChange={(e) => setWidthPercent(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-gray-500">
                Adjust the width of the report (50% to 90% of canvas width)
              </div>
            </label>
          </div>

          {/* Y Position */}
          <div className="grid gap-2 text-xs">
            <label className="grid gap-1">
              <span>Y Position (pixels from top)</span>
              <input
                type="number"
                min="0"
                value={yPosition}
                onChange={(e) => setYPosition(Math.max(0, Number(e.target.value)))}
                className="border rounded px-2 py-1"
              />
              <div className="text-[10px] text-gray-500">
                Vertical position of the report on the canvas
              </div>
            </label>
          </div>

          {/* Horizontal Alignment */}
          <div className="grid gap-2 text-xs">
            <label className="grid gap-1">
              <span>Horizontal Alignment</span>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-2 border rounded flex-1 ${
                    alignment === 'left' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setAlignment('left')}
                >
                  Left
                </button>
                <button
                  className={`px-3 py-2 border rounded flex-1 ${
                    alignment === 'center' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setAlignment('center')}
                >
                  Center
                </button>
                <button
                  className={`px-3 py-2 border rounded flex-1 ${
                    alignment === 'right' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setAlignment('right')}
                >
                  Right
                </button>
              </div>
              <div className="text-[10px] text-gray-500">
                Horizontal alignment of the report on the canvas
              </div>
            </label>
          </div>

          {/* Preview */}
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-xs font-medium mb-2">Preview</div>
            <div className="text-[10px] text-gray-600 space-y-1">
              <div>Width: {newWidth}px ({widthPercent}% of canvas)</div>
              <div>Height: {newHeight}px</div>
              <div>X Position: {newX}px ({alignment})</div>
              <div>Y Position: {newY}px</div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70]">
          <div className="bg-white text-gray-900 p-6 rounded-lg w-[400px] max-w-[95vw]">
            <h3 className="text-lg font-semibold mb-3">Delete Gardens Report?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete the gardens report and all its clickable overlays from the canvas. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm border rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
