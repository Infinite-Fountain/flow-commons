'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { doc, getFirestore, setDoc, deleteField, collection, getDocs, query, limit, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

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

export default function BoxContentModal({ projectId = 'demo', canvasId = 'root', scope = { type: 'root' } as { type: 'root' } | { type: 'child'; childId: string } }: { projectId?: string; canvasId?: string; scope?: { type: 'root' } | { type: 'child'; childId: string } }) {
  const open = useCanvasStore((s: any) => s.ui.showBoxModal)
  const close = useCanvasStore((s: any) => s.closeBoxModal)
  const selectedId = useCanvasStore((s: any) => s.selectedId)
  const overlay = useCanvasStore((s: any) => s.overlay)
  const item = useMemo(() => overlay.find((o: any) => o.id === selectedId), [overlay, selectedId])

  const [tab, setTab] = useState<'background' | 'text' | 'image' | 'animation' | 'dune'>('background')
  const [draft, setDraft] = useState<any>({})

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [hasImages, setHasImages] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [images, setImages] = useState<Array<{ id: string; name: string; url: string }>>([])
  const [isDeleteArmed, setIsDeleteArmed] = useState(false)

  const toTimestampSuffix = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const MM = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`
  }

  const checkHasImages = async () => {
    try {
      const colRef = collection(db, 'interoperable-canvas', projectId, 'images')
      const q = query(colRef, limit(1))
      const snap = await getDocs(q)
      setHasImages(!snap.empty)
    } catch (e) {
      setHasImages(false)
    }
  }

  const loadImages = async () => {
    try {
      const colRef = collection(db, 'interoperable-canvas', projectId, 'images')
      const snap = await getDocs(colRef)
      const list: Array<{ id: string; name: string; url: string }> = []
      for (const docSnap of snap.docs) {
        const data: any = docSnap.data()
        const storagePath: string | undefined = data?.storagePath
        const name: string = data?.filename ?? docSnap.id
        if (storagePath) {
          try {
            const ref = storageRef(storage, storagePath)
            const url = await getDownloadURL(ref)
            list.push({ id: docSnap.id, name, url })
          } catch {
            // skip if cannot get URL
          }
        }
      }
      setImages(list)
    } catch {
      setImages([])
    }
  }

  useEffect(() => {
    if (open && tab === 'image') {
      checkHasImages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, projectId])

  // Auto-select tab based on existing content
  useEffect(() => {
    if (!open) return
    const existingType = (item?.contentType ?? 'none') as 'none' | 'text' | 'image' | 'animation' | 'dune'
    if (existingType === 'text' || existingType === 'image' || existingType === 'animation' || existingType === 'dune') {
      setTab(existingType)
    } else {
      setTab('background')
    }
  }, [open, selectedId, item?.contentType])

  if (!open || !selectedId) return null

  const handleUploadFile = async (file: File) => {
    setUploadError(null)
    if (!file) return
    const okType = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!okType) {
      setUploadError('Only JPG or PNG files are accepted.')
      return
    }
    if (file.size > 1 * 1024 * 1024) {
      setUploadError('Maximum size is 1MB.')
      return
    }
    setIsUploading(true)
    try {
      const originalName = file.name
      const dot = originalName.lastIndexOf('.')
      const base = dot > -1 ? originalName.slice(0, dot) : originalName
      const ext = dot > -1 ? originalName.slice(dot + 1) : 'jpg'
      const uniqueFilename = `${base}_${toTimestampSuffix()}.${ext}`
      const storagePath = (scope as any)?.type === 'child'
        ? `interoperable-canvas/assets/${projectId}/child-canvases/${(scope as any).childId}/images/${uniqueFilename}`
        : `interoperable-canvas/assets/${projectId}/images/${uniqueFilename}`
      const ref = storageRef(storage, storagePath)
      await uploadBytes(ref, file, {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      })
      const url = await getDownloadURL(ref)

      const objectUrl = URL.createObjectURL(file)
      setLocalPreviewUrl(objectUrl)
      const dims = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
          URL.revokeObjectURL(objectUrl)
        }
        img.src = objectUrl
      })

      const imgDocRef = doc(db, 'interoperable-canvas', projectId, 'images', uniqueFilename)
      await setDoc(imgDocRef, {
        filename: uniqueFilename,
        originalName,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        width: dims.width,
        height: dims.height,
        uploadedAt: serverTimestamp(),
      }, { merge: true })

      setDraft({ ...draft, imageSrc: url, imageBehavior: draft.imageBehavior ?? item?.imageBehavior ?? 'contain' })
      setHasImages(true)
    } catch (e: any) {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const onClickBrowse = async () => {
    const next = !showBrowse
    setShowBrowse(next)
    if (next && images.length === 0) {
      await loadImages()
    }
  }

  const pathForCanvasDoc = () => {
    const base: string[] = ['interoperable-canvas', projectId!]
    if ((scope as any)?.type === 'child') base.push('child-canvases', (scope as any).childId)
    base.push('canvases', canvasId!)
    return base
  }

  const save = async () => {
    if (!selectedId) return
    const ref = doc(db, pathForCanvasDoc().concat(['overlay', selectedId]).join('/'))
    // Merge polymorphic fields per chosen tab
    const payload: any = {}
    if (tab === 'background') {
      payload.background = draft.background ?? { mode: 'none' }
    }

    const nextType = tab === 'text' ? 'text' : tab === 'image' ? 'image' : tab === 'animation' ? 'animation' : tab === 'dune' ? 'dune' : null

    // Enforce one-asset-per-box rule with confirm when switching types (only if previous type is known)
    if (nextType && item?.contentType && item.contentType !== nextType) {
      const knownTypes: Record<string, string> = { text: 'text', image: 'image', animation: 'animation', dune: 'dune' }
      const prevLabel = knownTypes[item.contentType] ?? null
      if (prevLabel) {
        const proceed = window.confirm(`You can only add one asset per box. Adding ${knownTypes[nextType]} will remove ${prevLabel}. Continue?`)
        if (!proceed) return
      }
    }

    // Build payload per tab and clear conflicting fields
    if (tab === 'text') {
      payload.contentType = 'text'
      payload.text = {
        content: draft.text ?? item?.text?.content ?? '',
        fontSize: draft.fontSize !== undefined ? Number(draft.fontSize) : item?.text?.fontSize ?? 18,
        color: draft.color ?? item?.text?.color ?? '#ffffff',
        bold: draft.bold !== undefined ? !!draft.bold : item?.text?.bold ?? false,
        align: draft.align ?? item?.text?.align ?? 'left',
        fitToWidth: draft.fitToWidth !== undefined ? !!draft.fitToWidth : item?.text?.fitToWidth ?? false,
      }
      Object.assign(payload, { imageSrc: deleteField(), lottieSrc: deleteField(), duneQueryId: deleteField() })
    }
    if (tab === 'image') {
      const imageSrc = draft.imageSrc ?? item?.imageSrc
      if (!imageSrc) {
        window.alert('Please upload or select an image before saving.')
        return
      }
      Object.assign(payload, { contentType: 'image', imageSrc, imageBehavior: draft.imageBehavior ?? item?.imageBehavior ?? 'contain' })
      Object.assign(payload, { text: deleteField(), lottieSrc: deleteField(), duneQueryId: deleteField() })
    }
    if (tab === 'animation') {
      Object.assign(payload, { contentType: 'animation', lottieSrc: draft.lottieSrc })
      Object.assign(payload, { text: deleteField(), imageSrc: deleteField(), duneQueryId: deleteField() })
    }
    if (tab === 'dune') {
      Object.assign(payload, { contentType: 'dune', duneQueryId: draft.duneQueryId })
      Object.assign(payload, { text: deleteField(), imageSrc: deleteField(), lottieSrc: deleteField() })
    }
    await setDoc(ref, payload, { merge: true })
    close()
  }

  const deleteBox = async () => {
    if (!selectedId) return
    try {
      // 1) Delete overlay doc (hard delete)
      const overlayRef = doc(db, pathForCanvasDoc().concat(['overlay', selectedId]).join('/'))
      await deleteDoc(overlayRef)

      // 2) Remove from layers and reindex zIndexMap
      const canvasRef = doc(db, pathForCanvasDoc().join('/'))
      const snap = await getDoc(canvasRef)
      if (snap.exists()) {
        const data: any = snap.data()
        const layers: string[] = Array.isArray(data?.layers) ? [...data.layers] : []
        const newLayers = layers.filter((id) => id !== selectedId)
        const newMap: Record<string, number> = {}
        newLayers.forEach((id, idx) => { newMap[id] = idx })
        await setDoc(canvasRef, { layers: newLayers, zIndexMap: newMap }, { merge: true })
      }
    } finally {
      setIsDeleteArmed(false)
      close()
    }
  }

  const TabButton = ({ id, label }: { id: typeof tab; label: string }) => {
    const isSelected = tab === id
    const isSavedType = (item?.contentType ?? 'none') === id
    const base = 'px-2 py-1 text-xs border rounded'
    const saved = isSavedType ? ' bg-green-100 border-green-600 text-green-800' : ''
    const sel = isSelected && !isSavedType ? ' bg-gray-200' : ''
    const rest = !isSelected && !isSavedType ? ' bg-white hover:bg-gray-50' : ''
    return (
      <button
        className={`${base}${saved}${sel}${rest}`}
        onClick={() => setTab(id)}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white text-gray-900 p-4 rounded-lg w-[560px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <InlineNameEditor projectId={projectId} canvasId={canvasId} selectedId={selectedId} initialName={(item as any)?.name || selectedId} />
          </div>
          <div className="flex items-center gap-2">
            {!isDeleteArmed && (
              <button
                className="px-2 py-1 text-xs border rounded text-red-700 border-red-600 hover:bg-red-50"
                onClick={() => setIsDeleteArmed(true)}
              >
                Delete box
              </button>
            )}
            {isDeleteArmed && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-red-700">Delete this box? This cannot be undone.</span>
                <button className="px-2 py-1 text-xs border rounded bg-red-600 text-white" onClick={deleteBox}>Yes, delete</button>
                <button className="px-2 py-1 text-xs border rounded" onClick={() => setIsDeleteArmed(false)}>No, go back</button>
              </div>
            )}
            <button className="px-2 py-1 text-xs border rounded" onClick={close}>Close</button>
            <button className="px-2 py-1 text-xs border rounded bg-blue-600 text-white" onClick={save}>Save</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          <TabButton id="background" label="Background" />
          <TabButton id="text" label="Text" />
          <TabButton id="image" label="Image" />
          <TabButton id="animation" label="Animation" />
          <TabButton id="dune" label="Dune" />
        </div>
        <div className="border rounded p-3 bg-gray-50">
          {tab === 'background' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Mode</span>
                <select value={draft.background?.mode ?? item?.background?.mode ?? 'none'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), mode: e.target.value } })}>
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="linear">Linear</option>
                  <option value="radial">Radial</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span>From</span>
                <input type="color" value={draft.background?.from ?? item?.background?.from ?? '#000000'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), from: e.target.value } })} />
              </label>
              <label className="grid gap-1">
                <span>To</span>
                <input type="color" value={draft.background?.to ?? item?.background?.to ?? '#000000'} onChange={(e) => setDraft({ ...draft, background: { ...(draft.background ?? {}), to: e.target.value } })} />
              </label>
            </div>
          )}
          {tab === 'text' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Text</span>
                <input value={draft.text ?? item?.text?.content ?? ''} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </label>
              <label className="grid gap-1">
                <span>Font size</span>
                <input type="number" value={draft.fontSize ?? item?.text?.fontSize ?? 18} onChange={(e) => setDraft({ ...draft, fontSize: Number(e.target.value) })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.fitToWidth ?? item?.text?.fitToWidth ?? false} onChange={(e) => setDraft({ ...draft, fitToWidth: e.target.checked })} />
                <span>Auto fit width</span>
              </label>
              <label className="grid gap-1">
                <span>Color</span>
                <input type="color" value={draft.color ?? item?.text?.color ?? '#ffffff'} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.bold ?? item?.text?.bold ?? false} onChange={(e) => setDraft({ ...draft, bold: e.target.checked })} />
                <span>Bold</span>
              </label>
              <label className="grid gap-1">
                <span>Align</span>
                <select value={draft.align ?? item?.text?.align ?? 'left'} onChange={(e) => setDraft({ ...draft, align: e.target.value })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          )}
          {tab === 'image' && (
            <div className="grid gap-2 text-xs">
              <div className="text-[11px] text-gray-600">
                Accepted formats: JPG/PNG. Max size: 1MB.
              </div>
              {uploadError && (
                <div className="text-[11px] text-red-600">{uploadError}</div>
              )}
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading…' : 'Upload image'}
                </button>
                {hasImages && (
                  <button
                    className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                    onClick={onClickBrowse}
                  >
                    {showBrowse ? 'Hide uploaded' : 'Browse uploaded'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadFile(f)
                    e.currentTarget.value = ''
                  }}
                />
              </div>

              <label className="grid gap-1 mt-2 max-w-[240px]">
                <span>Image behavior</span>
                <select
                  value={draft.imageBehavior ?? item?.imageBehavior ?? 'contain'}
                  onChange={(e) => setDraft({ ...draft, imageBehavior: e.target.value })}
                >
                  <option value="contain">contain (default)</option>
                  <option value="cover">cover</option>
                </select>
              </label>

              {(draft.imageSrc ?? item?.imageSrc ?? localPreviewUrl) && (
                <div className="mt-2">
                  <div className="text-[11px] text-gray-600 mb-1">Preview</div>
                  <div className="w-[200px] h-[120px] bg-white border rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={(draft.imageSrc ?? item?.imageSrc ?? localPreviewUrl) as string}
                      style={{ objectFit: (draft.imageBehavior ?? item?.imageBehavior ?? 'contain') as 'contain' | 'cover', width: '100%', height: '100%', objectPosition: 'center' }}
                      alt="preview"
                    />
                  </div>
                </div>
              )}

              {showBrowse && (
                <div className="mt-2 border rounded p-2 bg-white max-h-[200px] overflow-auto">
                  {images.length === 0 ? (
                    <div className="text-[11px] text-gray-600">No uploaded images found.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((img) => (
                        <button
                          key={img.id}
                          className="border rounded overflow-hidden hover:ring-1 hover:ring-blue-500"
                          onClick={() => setDraft({ ...draft, imageSrc: img.url })}
                          title={img.name}
                        >
                          <img src={img.url} alt={img.name} className="w-full h-[80px] object-cover" />
                          <div className="text-[10px] px-1 py-1 truncate text-left">{img.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === 'animation' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Lottie JSON URL</span>
                <input value={draft.lottieSrc ?? item?.lottieSrc ?? ''} onChange={(e) => setDraft({ ...draft, lottieSrc: e.target.value })} />
              </label>
            </div>
          )}
          {tab === 'dune' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Dune Query ID</span>
                <input value={draft.duneQueryId ?? item?.duneQueryId ?? ''} onChange={(e) => setDraft({ ...draft, duneQueryId: e.target.value })} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InlineNameEditor({ projectId, canvasId, selectedId, initialName }: { projectId: string; canvasId: string; selectedId: string; initialName: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialName)
  useEffect(() => { setValue(initialName) }, [initialName])

  const toTimestampSuffix = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const MM = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    const ss = pad(d.getSeconds())
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`
  }

  const save = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) { setEditing(false); setValue(initialName); return }
    const uniqueKey = `${trimmed}_${toTimestampSuffix()}`
    const ref = doc(getFirestore(), 'interoperable-canvas', projectId, 'canvases', canvasId, 'overlay', selectedId)
    await setDoc(ref, { name: trimmed, nameKey: uniqueKey }, { merge: true })
    setEditing(false)
  }

  if (!editing) {
    return (
      <button className="text-sm font-semibold truncate" title={value} onClick={() => setEditing(true)}>
        {value}
      </button>
    )
  }
  return (
    <input
      className="text-sm font-semibold border rounded px-1 py-0.5 min-w-0"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => save(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(value) }
        if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setValue(initialName) }
      }}
    />
  )
}


