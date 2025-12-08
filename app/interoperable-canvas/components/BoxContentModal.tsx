'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Lottie from 'lottie-react'
import { useCanvasStore } from './store'
import { initializeApp, getApps } from 'firebase/app'
import { doc, getFirestore, setDoc, deleteField, collection, getDocs, query, limit, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage'

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

  const [tab, setTab] = useState<'background' | 'text' | 'image' | 'animation' | 'dune' | 'kanban' | 'snapshot'>('background')
  const [draft, setDraft] = useState<any>({})
  const [duneValues, setDuneValues] = useState<string[]>([''])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lottieFileInputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [animationUrlError, setAnimationUrlError] = useState<string | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [lottieAnimationData, setLottieAnimationData] = useState<any>(null)
  const [hasImages, setHasImages] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [images, setImages] = useState<Array<{ id: string; name: string; url: string }>>([])
  const [isDeleteArmed, setIsDeleteArmed] = useState(false)
  const [animationType, setAnimationType] = useState<'lottie' | 'url'>('lottie')
  const [animationPreviewUrl, setAnimationPreviewUrl] = useState<string>('')
  const [kanbanUrlError, setKanbanUrlError] = useState<string | null>(null)
  const [isTestingScrape, setIsTestingScrape] = useState(false)
  const [scrapeTestResult, setScrapeTestResult] = useState<{ success?: boolean; message?: string; storagePath?: string } | null>(null)
  const [clickableUrlError, setClickableUrlError] = useState<string | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string>('')
  const [snapshotValidationResult, setSnapshotValidationResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null)
  const [isValidatingSnapshot, setIsValidatingSnapshot] = useState(false)

  const resolvedAnimationUrl = (draft.animationUrl ?? animationPreviewUrl ?? (item as any)?.animationUrl ?? '') as string

  // Extract proposal ID from Snapshot URL
  const extractProposalId = (url: string): string | null => {
    try {
      // Match proposal ID pattern: hex string after /proposal/
      // Supports both snapshot.box and snapshot.org URLs
      const match = url.match(/\/proposal\/(0x[a-fA-F0-9]+)/)
      if (match && match[1]) {
        return match[1]
      }
      return null
    } catch {
      return null
    }
  }

  // Fetch proposal data from Snapshot GraphQL API
  const fetchSnapshotProposal = async (proposalId: string) => {
    const query = `
      query Proposal($id: String!) {
        proposal(id: $id) {
          id
          state
          choices
          scores
          scores_total
          quorum
          end
        }
      }
    `

    try {
      const response = await fetch('https://hub.snapshot.org/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { id: proposalId },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error')
      }

      if (!result.data?.proposal) {
        throw new Error('Proposal not found')
      }

      return result.data.proposal
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch proposal data')
    }
  }

  // Validate snapshot URL and fetch proposal data
  const validateSnapshotUrl = async () => {
    if (!snapshotUrl.trim()) {
      setSnapshotValidationResult({ success: false, error: 'Please enter a Snapshot URL' })
      return
    }

    setIsValidatingSnapshot(true)
    setSnapshotValidationResult(null)

    try {
      const proposalId = extractProposalId(snapshotUrl.trim())
      
      if (!proposalId) {
        setSnapshotValidationResult({ 
          success: false, 
          error: 'Invalid URL format. Please use a snapshot.box or snapshot.org proposal URL.' 
        })
        setIsValidatingSnapshot(false)
        return
      }

      const proposalData = await fetchSnapshotProposal(proposalId)

      // Check if proposal has more than 3 choices
      if (proposalData.choices && proposalData.choices.length > 3) {
        setSnapshotValidationResult({ 
          success: false, 
          error: `This proposal has ${proposalData.choices.length} choices. We currently only support proposals with up to 3 choices (For, Against, Abstain).` 
        })
        setIsValidatingSnapshot(false)
        return
      }

      setSnapshotValidationResult({ 
        success: true, 
        data: {
          proposalId,
          choices: proposalData.choices || [],
          scores: proposalData.scores || [],
          scoresTotal: proposalData.scores_total || 0,
          quorum: proposalData.quorum || 0,
          end: proposalData.end || 0,
          state: proposalData.state || 'unknown',
        }
      })

      // Store the URL in Firestore immediately after successful validation
      if (selectedId) {
        const ref = doc(db, pathForCanvasDoc().concat(['overlay', selectedId]).join('/'))
        await setDoc(ref, { snapshotUrl: snapshotUrl.trim() }, { merge: true })
      }
    } catch (error: any) {
      setSnapshotValidationResult({ 
        success: false, 
        error: error.message || 'Failed to validate URL. Please check the URL and try again.' 
      })
    } finally {
      setIsValidatingSnapshot(false)
    }
  }

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
    const existingType = (item?.contentType ?? 'none') as 'none' | 'text' | 'image' | 'animation' | 'dune' | 'kanban' | 'snapshot'
    if (existingType === 'text' || existingType === 'image' || existingType === 'animation' || existingType === 'dune' || existingType === 'kanban' || existingType === 'snapshot') {
      setTab(existingType)
    } else {
      setTab('background')
    }
    if (existingType === 'dune' && item?.dune?.valueColumns) {
      setDuneValues(item.dune.valueColumns)
    } else if (duneValues.length === 0) {
      setDuneValues([''])
    }
    if (existingType === 'animation') {
      const savedType = (item as any)?.animationType as 'lottie' | 'url' | undefined
      if (savedType === 'url' || (!(item as any)?.lottieSrc && (item as any)?.animationUrl)) {
        setAnimationType('url')
        setAnimationPreviewUrl((item as any)?.animationUrl ?? '')
      } else {
        setAnimationType('lottie')
        setAnimationPreviewUrl('')
      }
    } else {
      setAnimationType('lottie')
      setAnimationPreviewUrl('')
    }
    setAnimationUrlError(null)
    setKanbanUrlError(null)
    setScrapeTestResult(null)
    setClickableUrlError(null)
    // Load snapshot URL from item if it exists
    if (item?.contentType === 'snapshot' && (item as any)?.snapshotUrl) {
      setSnapshotUrl((item as any).snapshotUrl)
    } else {
      setSnapshotUrl('')
    }
    setSnapshotValidationResult(null)
    setIsValidatingSnapshot(false)
  }, [open, selectedId, item?.contentType, (item as any)?.animationType, (item as any)?.animationUrl, (item as any)?.snapshotUrl])

  // Load existing Lottie animation data when modal opens with animation content
  useEffect(() => {
    if (!open || !item?.lottieSrc) return
    if (item.contentType !== 'animation') return
    
    // Load animation from Firebase Storage if we have a URL
    const loadAnimationData = async () => {
      try {
        // Extract storage path from Firebase Storage URL
        // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
        const urlParts = item.lottieSrc.split('/o/')
        if (urlParts.length !== 2) {
          console.error('Invalid Lottie URL format')
          return
        }
        const encodedPath = urlParts[1].split('?')[0] // Remove query params
        const storageRefPath = decodeURIComponent(encodedPath) // Decode URL encoding (%2F -> /)
        
        const ref = storageRef(storage, storageRefPath)
        const bytes = await getBytes(ref)
        const text = new TextDecoder().decode(bytes)
        const data = JSON.parse(text)
        setLottieAnimationData(data)
      } catch (err) {
        console.error('Failed to load existing Lottie animation:', err)
      }
    }
    
    loadAnimationData()
  }, [open, item?.lottieSrc, item?.contentType])

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

  const handleUploadLottie = async (file: File) => {
    setUploadError(null)
    setAnimationUrlError(null)
    setAnimationType('lottie')
    if (!file) return
    const okType = file.type === 'application/json' || file.name.endsWith('.json')
    if (!okType) {
      setUploadError('Only JSON files are accepted.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Maximum size is 4MB.')
      return
    }
    setIsUploading(true)
    try {
      const originalName = file.name
      const dot = originalName.lastIndexOf('.')
      const base = dot > -1 ? originalName.slice(0, dot) : originalName
      const uniqueFilename = `${base}_${toTimestampSuffix()}.json`
      const storagePath = (scope as any)?.type === 'child'
        ? `interoperable-canvas/assets/${projectId}/child-canvases/${(scope as any).childId}/animations/${uniqueFilename}`
        : `interoperable-canvas/assets/${projectId}/animations/${uniqueFilename}`
      const ref = storageRef(storage, storagePath)
      await uploadBytes(ref, file, {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
      })
      const url = await getDownloadURL(ref)

      // Parse and store JSON for preview
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string)
          setLottieAnimationData(json)
          setDraft({ ...draft, lottieSrc: url })
        } catch (err) {
          console.error('Failed to parse Lottie JSON:', err)
          setUploadError('Invalid Lottie JSON file.')
        }
      }
      reader.readAsText(file)

      // Store metadata in Firestore (animations collection)
      const animDocRef = doc(db, 'interoperable-canvas', projectId, 'animations', uniqueFilename)
      await setDoc(animDocRef, {
        filename: uniqueFilename,
        originalName,
        storagePath,
        mimeType: 'application/json',
        sizeBytes: file.size,
        uploadedAt: serverTimestamp(),
      }, { merge: true })
    } catch (e: any) {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
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

    const nextType = tab === 'text' ? 'text' : tab === 'image' ? 'image' : tab === 'animation' ? 'animation' : tab === 'dune' ? 'dune' : tab === 'kanban' ? 'kanban' : tab === 'snapshot' ? 'snapshot' : null

    // Enforce one-asset-per-box rule with confirm when switching types (only if previous type is known)
    if (nextType && item?.contentType && item.contentType !== nextType) {
      const knownTypes: Record<string, string> = { text: 'text', image: 'image', animation: 'animation', dune: 'dune', kanban: 'kanban', snapshot: 'snapshot' }
      const prevLabel = knownTypes[item.contentType] ?? null
      if (prevLabel) {
        const proceed = window.confirm(`You can only add one asset per box. Adding ${knownTypes[nextType]} will remove ${prevLabel}. Continue?`)
        if (!proceed) return
      }
    }

    // Build payload per tab and clear conflicting fields
    if (tab === 'text') {
      payload.contentType = 'text'
      const textOpacity = draft.textOpacity !== undefined ? draft.textOpacity : (item?.text?.opacity !== undefined ? item.text.opacity : 100)
      payload.text = {
        content: draft.text ?? item?.text?.content ?? '',
        fontSize: draft.fontSize !== undefined ? Number(draft.fontSize) : item?.text?.fontSize ?? 18,
        color: draft.color ?? item?.text?.color ?? '#ffffff',
        bold: draft.bold !== undefined ? !!draft.bold : item?.text?.bold ?? false,
        align: draft.align ?? item?.text?.align ?? 'left',
        fitToWidth: draft.fitToWidth !== undefined ? !!draft.fitToWidth : item?.text?.fitToWidth ?? false,
        opacity: textOpacity,
      }
      Object.assign(payload, {
        imageSrc: deleteField(),
        lottieSrc: deleteField(),
        animationUrl: deleteField(),
        animationType: deleteField(),
        loop: deleteField(),
        autoplay: deleteField(),
        duneQueryId: deleteField(),
      })
    }
    if (tab === 'image') {
      const imageSrc = draft.imageSrc ?? item?.imageSrc
      if (!imageSrc) {
        window.alert('Please upload or select an image before saving.')
        return
      }
      const imageOpacity = draft.imageOpacity !== undefined ? draft.imageOpacity : ((item as any)?.imageOpacity !== undefined ? (item as any).imageOpacity : 100)
      Object.assign(payload, { contentType: 'image', imageSrc, imageBehavior: draft.imageBehavior ?? item?.imageBehavior ?? 'contain', imageOpacity })
      Object.assign(payload, {
        text: deleteField(),
        lottieSrc: deleteField(),
        animationUrl: deleteField(),
        animationType: deleteField(),
        loop: deleteField(),
        autoplay: deleteField(),
        duneQueryId: deleteField(),
      })
    }
    if (tab === 'animation') {
      if (animationType === 'lottie') {
        const lottieSrc = draft.lottieSrc ?? item?.lottieSrc
        if (!lottieSrc) {
          window.alert('Please upload a Lottie JSON file before saving.')
          return
        }
        Object.assign(payload, {
          contentType: 'animation',
          animationType: 'lottie',
          lottieSrc,
          loop: draft.loop !== undefined ? draft.loop : item?.loop ?? true,
          autoplay: draft.autoplay !== undefined ? draft.autoplay : item?.autoplay ?? true,
        })
        Object.assign(payload, {
          animationUrl: deleteField(),
          text: deleteField(),
          imageSrc: deleteField(),
          duneQueryId: deleteField(),
        })
      } else {
        const rawAnimationUrl = (draft.animationUrl ?? animationPreviewUrl ?? (item as any)?.animationUrl ?? '').toString().trim()
        if (!rawAnimationUrl) {
          window.alert('Please provide an animation URL before saving.')
          setAnimationUrlError('Enter a valid URL (https://...).')
          return
        }
        try {
          const parsed = new URL(rawAnimationUrl)
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('URL must use http or https.')
          }
        } catch (err: any) {
          const message = err?.message ?? 'Invalid URL.'
          window.alert(message)
          setAnimationUrlError('Enter a valid URL (https://...).')
          return
        }

        Object.assign(payload, {
          contentType: 'animation',
          animationType: 'url',
          animationUrl: rawAnimationUrl,
        })
        Object.assign(payload, {
          lottieSrc: deleteField(),
          loop: deleteField(),
          autoplay: deleteField(),
          text: deleteField(),
          imageSrc: deleteField(),
          duneQueryId: deleteField(),
        })
      }
    }
    if (tab === 'dune') {
      const rawInput: string = (draft.duneInput ?? draft.duneQueryId ?? item?.dune?.sourceUrl ?? item?.dune?.queryId ?? item?.duneQueryId ?? '').toString().trim()
      const { queryId, vizId, sourceUrl } = parseDuneInput(rawInput)
      if (!queryId) {
        window.alert('Please provide a valid Dune URL or numeric query_id.')
        return
      }
      const resolvedSourceUrl = sourceUrl || `https://dune.com/queries/${queryId}${vizId ? '/' + vizId : ''}`
      const datesToShow = draft.datesToShow ?? item?.dune?.datesToShow ?? 4
      const datesColumn = draft.datesColumn ?? item?.dune?.datesColumn ?? ''
      const valueColumns = duneValues.filter((v) => v.trim() !== '')
      Object.assign(payload, {
        contentType: 'dune',
        dune: {
          provider: 'dune',
          queryId,
          ...(vizId ? { vizId } : {}),
          sourceUrl: resolvedSourceUrl,
          version: 0,
          datesToShow,
          datesColumn,
          valueColumns,
        },
        duneQueryId: deleteField(),
      })
      Object.assign(payload, {
        text: deleteField(),
        imageSrc: deleteField(),
        lottieSrc: deleteField(),
        animationUrl: deleteField(),
        animationType: deleteField(),
        loop: deleteField(),
        autoplay: deleteField(),
      })
    }
    if (tab === 'kanban') {
      // Always prioritize Firebase as source of truth (like Dune does)
      // Check Firebase first, then draft, then fallback to old fields
      const rawInput: string = (item?.kanban?.embedUrl ?? item?.kanban?.sourceUrl ?? draft.kanbanUrl ?? item?.kanbanUrl ?? '').toString().trim()
      const { embedUrl, sourceUrl, error } = parseNotionKanbanUrl(rawInput)
      if (error || (!embedUrl && !sourceUrl)) {
        window.alert(error || 'Please provide a valid Notion kanban board URL.')
        setKanbanUrlError(error || 'Invalid Notion URL')
        return
      }
      // Use Firebase value if it exists and draft hasn't changed, otherwise use parsed values
      const finalEmbedUrl = item?.kanban?.embedUrl && !draft.kanbanUrl 
        ? item.kanban.embedUrl 
        : (embedUrl || sourceUrl || rawInput)
      const finalSourceUrl = item?.kanban?.sourceUrl && !draft.kanbanUrl
        ? item.kanban.sourceUrl
        : (sourceUrl || rawInput)
      
      Object.assign(payload, {
        contentType: 'kanban',
        kanban: {
          provider: 'notion',
          sourceUrl: finalSourceUrl,
          embedUrl: finalEmbedUrl,
        },
        kanbanUrl: deleteField(),
      })
      Object.assign(payload, {
        text: deleteField(),
        imageSrc: deleteField(),
        lottieSrc: deleteField(),
        animationUrl: deleteField(),
        animationType: deleteField(),
        loop: deleteField(),
        autoplay: deleteField(),
        duneQueryId: deleteField(),
      })
    }
    if (tab === 'snapshot') {
      // Extract proposal ID from URL if available
      const proposalId = snapshotValidationResult?.success && snapshotValidationResult.data
        ? snapshotValidationResult.data.proposalId
        : extractProposalId(snapshotUrl.trim())

      // If we have validated data, store it in snapshot-proposals collection
      if (snapshotValidationResult?.success && snapshotValidationResult.data && proposalId) {
        const snapshotData = snapshotValidationResult.data
        const snapshotProposalRef = doc(
          db,
          pathForCanvasDoc()
            .concat(['snapshot-proposals', proposalId])
            .join('/')
        )
        
        await setDoc(
          snapshotProposalRef,
          {
            proposalId: snapshotData.proposalId,
            choices: snapshotData.choices,
            scores: snapshotData.scores,
            scoresTotal: snapshotData.scoresTotal,
            quorum: snapshotData.quorum,
            end: snapshotData.end,
            state: snapshotData.state,
            cachedAt: serverTimestamp(),
          },
          { merge: true }
        )
      }

      // Store snapshot reference in the box (even if not validated yet)
      Object.assign(payload, {
        contentType: 'snapshot',
        snapshotUrl: snapshotUrl.trim(),
        ...(proposalId ? { snapshotProposalId: proposalId } : {}),
        backgroundColor: draft.backgroundColor ?? item?.backgroundColor ?? '#ffffff',
        border: draft.border !== undefined ? draft.border : (item?.border !== undefined ? item.border : true),
        borderColor: draft.borderColor ?? item?.borderColor ?? '#000000',
        borderWidth: draft.borderWidth !== undefined ? Number(draft.borderWidth) : (item?.borderWidth !== undefined ? item.borderWidth : 1),
      })
      Object.assign(payload, {
        text: deleteField(),
        imageSrc: deleteField(),
        lottieSrc: deleteField(),
        animationUrl: deleteField(),
        animationType: deleteField(),
        loop: deleteField(),
        autoplay: deleteField(),
        duneQueryId: deleteField(),
        kanbanUrl: deleteField(),
      })
    }
    
    // Handle clickable box settings
    const isClickable = draft.clickable ?? (item as any)?.clickable ?? false
    if (isClickable) {
      const url = (draft.url ?? (item as any)?.url ?? '').toString().trim()
      if (!url) {
        window.alert('Please provide a URL when clickable is enabled.')
        setClickableUrlError('URL is required when clickable is enabled')
        return
      }
      // Basic URL validation
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('URL must use http or https protocol')
        }
        setClickableUrlError(null)
      } catch (err: any) {
        const message = err?.message ?? 'Invalid URL format'
        window.alert(message)
        setClickableUrlError(message)
        return
      }
      Object.assign(payload, {
        clickable: true,
        url: url,
        openIn: draft.openIn ?? (item as any)?.openIn ?? 'new-tab',
      })
    } else {
      // Remove clickable fields if disabled
      Object.assign(payload, {
        clickable: deleteField(),
        url: deleteField(),
        openIn: deleteField(),
      })
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
    } catch (error) {
      console.error('[BoxContentModal] Error deleting box:', error)
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
            <InlineNameEditor projectId={projectId} canvasId={canvasId} selectedId={selectedId} initialName={(item as any)?.name || selectedId} scope={scope} />
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
          <TabButton id="kanban" label="Kanban" />
          <TabButton id="snapshot" label="Snapshot" />
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
              <label className="grid gap-1">
                <span>Opacity %</span>
                <input
                  type="text"
                  placeholder="100"
                  value={draft.textOpacity !== undefined ? (draft.textOpacity === 100 ? '100' : String(draft.textOpacity)) : (item?.text?.opacity !== undefined ? String(item.text.opacity) : '100')}
                  onChange={(e) => {
                    const value = e.target.value.trim()
                    // Parse input: handle "50", "50%", or empty
                    let opacity: number | undefined = undefined
                    if (value === '') {
                      opacity = undefined
                    } else {
                      // Remove % if present
                      const numStr = value.replace('%', '').trim()
                      const num = parseInt(numStr, 10)
                      if (!isNaN(num)) {
                        // Clamp between 0 and 100
                        opacity = Math.max(0, Math.min(100, num))
                      }
                    }
                    setDraft({ ...draft, textOpacity: opacity })
                  }}
                  className="border rounded px-2 py-1"
                />
                <div className="text-[10px] text-gray-500">Enter 0-100 (e.g., "50" or "50%"). 100% = fully visible, 0% = invisible</div>
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
              <label className="grid gap-1 mt-2">
                <span>Opacity %</span>
                <input
                  type="text"
                  placeholder="100"
                  value={draft.imageOpacity !== undefined ? (draft.imageOpacity === 100 ? '100' : String(draft.imageOpacity)) : ((item as any)?.imageOpacity !== undefined ? String((item as any).imageOpacity) : '100')}
                  onChange={(e) => {
                    const value = e.target.value.trim()
                    // Parse input: handle "50", "50%", or empty
                    let opacity: number | undefined = undefined
                    if (value === '') {
                      opacity = undefined
                    } else {
                      // Remove % if present
                      const numStr = value.replace('%', '').trim()
                      const num = parseInt(numStr, 10)
                      if (!isNaN(num)) {
                        // Clamp between 0 and 100
                        opacity = Math.max(0, Math.min(100, num))
                      }
                    }
                    setDraft({ ...draft, imageOpacity: opacity })
                  }}
                  className="border rounded px-2 py-1"
                />
                <div className="text-[10px] text-gray-500">Enter 0-100 (e.g., "50" or "50%"). 100% = fully visible, 0% = invisible</div>
              </label>

              {(draft.imageSrc ?? item?.imageSrc ?? localPreviewUrl) && (
                <div className="mt-2">
                  <div className="text-[11px] text-gray-600 mb-1">Preview</div>
                  <div className="w-[200px] h-[120px] bg-white border rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={(draft.imageSrc ?? item?.imageSrc ?? localPreviewUrl) as string}
                      style={{
                        objectFit: (draft.imageBehavior ?? item?.imageBehavior ?? 'contain') as 'contain' | 'cover',
                        width: '100%',
                        height: '100%',
                        objectPosition: 'center',
                        opacity: ((draft.imageOpacity !== undefined ? draft.imageOpacity : ((item as any)?.imageOpacity !== undefined ? (item as any).imageOpacity : 100)) / 100),
                      }}
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
            <div className="grid gap-3 text-xs">
              <div className="grid gap-1">
                <span className="font-medium">Animation source</span>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="box-animation-type"
                      value="lottie"
                      checked={animationType === 'lottie'}
                      onChange={() => {
                        setAnimationType('lottie')
                        setAnimationUrlError(null)
                        setAnimationPreviewUrl('')
                      }}
                    />
                    <span>Lottie JSON upload</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="box-animation-type"
                      value="url"
                      checked={animationType === 'url'}
                      onChange={() => {
                        setAnimationType('url')
                        setAnimationUrlError(null)
                        const existingUrl = (draft.animationUrl ?? (item as any)?.animationUrl ?? '') as string
                        setAnimationPreviewUrl(existingUrl)
                      }}
                    />
                    <span>External URL (iframe)</span>
                  </label>
                </div>
              </div>

              {animationType === 'lottie' && (
                <div className="grid gap-2">
                  <div className="text-[11px] text-gray-600">
                    Upload Lottie JSON file (max 4MB).
                  </div>
                  {uploadError && (
                    <div className="text-[11px] text-red-600">{uploadError}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50"
                      onClick={() => lottieFileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading…' : 'Upload Lottie JSON'}
                    </button>
                    <input
                      ref={lottieFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadLottie(f)
                        e.currentTarget.value = ''
                      }}
                    />
                  </div>

                  {/* Loop Configuration */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.loopEnabled !== undefined ? draft.loopEnabled : (item?.loop ? typeof item.loop === 'boolean' && item.loop : true)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        if (checked) {
                          setDraft({ ...draft, loopEnabled: true, loop: true })
                        } else {
                          setDraft({ ...draft, loopEnabled: false, loop: false })
                        }
                      }}
                    />
                    <span>Loop animation</span>
                  </label>

                  {/* Loop count input - shown only when loop is enabled */}
                  {((draft.loopEnabled !== undefined ? draft.loopEnabled : (item?.loop ? typeof item.loop === 'boolean' && item.loop : true))) && (
                    <div className="grid gap-1">
                      <select
                        value={draft.loopMode ?? 'infinite'}
                        onChange={(e) => {
                          if (e.target.value === 'infinite') {
                            setDraft({ ...draft, loop: true, loopMode: 'infinite' })
                          } else {
                            const count = draft.loopCount ?? 3
                            setDraft({ ...draft, loop: count, loopMode: 'count' })
                          }
                        }}
                        className="text-xs border rounded p-1"
                      >
                        <option value="infinite">Infinite</option>
                        <option value="count">Count</option>
                      </select>
                      {draft.loopMode === 'count' && (
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={draft.loopCount ?? 3}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            setDraft({ ...draft, loopCount: val, loop: val })
                          }}
                          className="text-xs border rounded p-1"
                          placeholder="Loop count"
                        />
                      )}
                    </div>
                  )}

                  {/* Autoplay Toggle */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.autoplay !== undefined ? draft.autoplay : (item?.autoplay ?? true)}
                      onChange={(e) => setDraft({ ...draft, autoplay: e.target.checked })}
                    />
                    <span>Autoplay</span>
                  </label>

                  {/* 100x100 Preview */}
                  {(lottieAnimationData || (draft.lottieSrc || item?.lottieSrc)) && (
                    <div className="mt-2">
                      <div className="text-[11px] text-gray-600 mb-1">Preview</div>
                      <div className="w-[100px] h-[100px] bg-white border rounded overflow-hidden flex items-center justify-center">
                        <Lottie
                          animationData={lottieAnimationData}
                          loop={true}
                          autoplay={true}
                          style={{ width: '100%', height: '100%' }}
                          {...({
                            renderer: 'canvas' as const,
                            rendererSettings: {
                              progressiveLoad: true,
                              clearCanvas: true,
                              preserveAspectRatio: 'none',
                              dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
                            },
                          } as any)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {animationType === 'url' && (
                <div className="grid gap-2">
                  <div className="text-[11px] text-gray-600">
                    Paste a public animation URL (Figma presentation, deployed React app, etc.).
                  </div>
                  <label className="grid gap-1">
                    <span>Animation URL</span>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={resolvedAnimationUrl}
                      onChange={(e) => {
                        const value = e.target.value
                        setDraft({ ...draft, animationUrl: value })
                        setAnimationPreviewUrl(value)
                        if (!value) {
                          setAnimationUrlError(null)
                          return
                        }
                        try {
                          const parsed = new URL(value)
                          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                            setAnimationUrlError(null)
                          } else {
                            setAnimationUrlError('URL must start with http or https.')
                          }
                        } catch {
                          setAnimationUrlError('Enter a valid URL (https://...).')
                        }
                      }}
                      className="border rounded px-2 py-1"
                    />
                  </label>
                  {animationUrlError && (
                    <div className="text-[11px] text-red-600">{animationUrlError}</div>
                  )}
                  {resolvedAnimationUrl && !animationUrlError && (
                    <div className="mt-2">
                      <div className="text-[11px] text-gray-600 mb-1">Preview</div>
                      <div className="w-full min-h-[140px] h-[200px] bg-white border rounded overflow-hidden flex items-center justify-center">
                        <iframe
                          key={resolvedAnimationUrl}
                          src={resolvedAnimationUrl}
                          title="Embedded animation preview"
                          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none', display: 'block' }}
                          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                          allowFullScreen
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                          scrolling="no"
                        />
                      </div>
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded">
                    <div className="font-semibold">Tips</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Figma: Share → Presentation → copy the fullscreen URL.</li>
                      <li>Deployed React apps: paste the public `.vercel.app`, `.netlify.app`, or custom domain link.</li>
                      <li>The animation scales with the box. Resize the box on the canvas to frame it.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'dune' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Dune URL or Query ID</span>
                <input
                  placeholder="https://dune.com/queries/4880231/8081146 or 4880231"
                  value={draft.duneInput ?? draft.duneQueryId ?? item?.dune?.sourceUrl ?? item?.dune?.queryId ?? item?.duneQueryId ?? ''}
                  onChange={(e) => setDraft({ ...draft, duneInput: e.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span>Dates column (e.g. "week")</span>
                <input
                  placeholder="week"
                  value={draft.datesColumn ?? item?.dune?.datesColumn ?? ''}
                  onChange={(e) => setDraft({ ...draft, datesColumn: e.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span>Dates to show</span>
                <input
                  type="number"
                  min="2"
                  max="20"
                  placeholder="4"
                  value={draft.datesToShow ?? item?.dune?.datesToShow ?? 4}
                  onChange={(e) => setDraft({ ...draft, datesToShow: parseInt(e.target.value) || 4 })}
                />
              </label>
              <div className="grid gap-1">
                <span>Value(s) to visualize</span>
                {duneValues.map((val, idx) => (
                  <div key={idx} className="flex gap-1">
                    <input
                      placeholder="e.g. total_members_all_networks"
                      value={val}
                      onChange={(e) => {
                        const updated = [...duneValues]
                        updated[idx] = e.target.value
                        setDuneValues(updated)
                      }}
                    />
                    {duneValues.length > 1 && (
                      <button
                        className="px-2 py-1 text-xs border rounded bg-red-100 text-red-700 hover:bg-red-200"
                        onClick={() => setDuneValues(duneValues.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="px-2 py-1 text-xs border rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => setDuneValues([...duneValues, ''])}
                >
                  + Add another value
                </button>
              </div>
            </div>
          )}
          {tab === 'kanban' && (
            <div className="grid gap-2 text-xs">
              <div className="text-[11px] text-gray-600">
                Paste the full iframe embed code from Notion, or just the URL. The system will extract the URL automatically.
              </div>
              <label className="grid gap-1">
                <span>Notion Kanban Embed Code or URL</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder='<iframe src="https://notion.site/ebd/..." /> or just the URL'
                    value={draft.kanbanUrl ?? item?.kanban?.embedUrl ?? item?.kanban?.sourceUrl ?? item?.kanbanUrl ?? ''}
                    onChange={(e) => {
                      const value = e.target.value.trim()
                      
                      // Extract URL from iframe if user pasted full embed code
                      let extractedUrl = value
                      if (value.includes('<iframe') || value.includes('src=')) {
                        const srcMatch = value.match(/src=["']([^"']+)["']/)
                        if (srcMatch && srcMatch[1]) {
                          extractedUrl = srcMatch[1]
                        }
                      }
                      
                      setDraft({ ...draft, kanbanUrl: extractedUrl })
                      setKanbanUrlError(null)
                      setScrapeTestResult(null)
                      
                      if (!extractedUrl) {
                        return
                      }
                      
                      // Validate URL format - accept embed URLs (/ebd/) or regular URLs
                      try {
                        const parsed = new URL(extractedUrl)
                        if (!parsed.hostname.includes('notion.site') && !parsed.hostname.includes('notion.so')) {
                          setKanbanUrlError('URL must be from Notion (notion.site or notion.so)')
                          return
                        }
                        // Accept embed URLs with /ebd/ path OR regular URLs with database ID and v= parameter
                        const isEmbedUrl = parsed.pathname.includes('/ebd/')
                        const isRegularUrl = parsed.pathname.match(/^\/[a-f0-9]{32}/) && parsed.searchParams.has('v')
                        
                        if (!isEmbedUrl && !isRegularUrl) {
                          setKanbanUrlError('Please use a Notion embed URL (/ebd/...) or kanban board view URL (with ?v= parameter)')
                          return
                        }
                        setKanbanUrlError(null)
                      } catch {
                        setKanbanUrlError('Enter a valid URL or paste the iframe embed code')
                      }
                    }}
                    className="border rounded px-2 py-1 flex-1 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      // Always check Firebase first as source of truth
                      const notionUrl = (draft.kanbanUrl ?? item?.kanban?.embedUrl ?? item?.kanban?.sourceUrl ?? item?.kanbanUrl ?? '').trim()
                      if (!notionUrl) {
                        setScrapeTestResult({ success: false, message: 'Please enter a Notion embed URL first' })
                        return
                      }
                      if (kanbanUrlError) {
                        setScrapeTestResult({ success: false, message: 'Please fix URL errors before embedding' })
                        return
                      }
                      
                      setIsTestingScrape(true)
                      setScrapeTestResult(null)
                      
                      try {
                        // Validate the embed URL format
                        const parsed = new URL(notionUrl)
                        const isEmbedUrl = parsed.pathname.includes('/ebd/')
                        
                        if (!isEmbedUrl) {
                          setScrapeTestResult({ 
                            success: false, 
                            message: 'Please use a Notion embed URL (with /ebd/ in the path). Get it from Notion\'s "Embed" option.' 
                          })
                          return
                        }
                        
                        // Success - URL is valid embed URL
                        setScrapeTestResult({
                          success: true,
                          message: 'Embed URL validated! Click "Save" to add it to your canvas.'
                        })
                      } catch (error: any) {
                        console.error('Embed validation error:', error)
                        setScrapeTestResult({
                          success: false,
                          message: `Invalid URL format: ${error.message}`
                        })
                      } finally {
                        setIsTestingScrape(false)
                      }
                    }}
                    disabled={isTestingScrape || !projectId || !!kanbanUrlError}
                    className="px-3 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isTestingScrape ? 'Validating...' : 'Embed'}
                  </button>
                </div>
              </label>
              {kanbanUrlError && (
                <div className="text-[11px] text-red-600">{kanbanUrlError}</div>
              )}
              {scrapeTestResult && (
                <div className={`text-[11px] p-2 rounded ${scrapeTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="font-semibold">{scrapeTestResult.success ? '✓ Valid' : '✗ Error'}</div>
                  <div className="mt-1">{scrapeTestResult.message}</div>
                </div>
              )}
              <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded">
                <div className="font-semibold">How to get the embed code:</div>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>Open your Notion kanban board</li>
                  <li>Click the "..." menu (three dots) in the top right</li>
                  <li>Select "Embed" or "Copy link" → "Embed"</li>
                  <li>Copy the entire embed code (starts with <code className="bg-white px-1 rounded">&lt;iframe</code>)</li>
                  <li>Paste it here and click "Embed" - the URL will be extracted automatically</li>
                </ul>
                <div className="mt-2 text-[9px] text-gray-400">
                  You can paste: <code className="bg-white px-1 rounded">&lt;iframe src="https://..."&gt;</code> or just <code className="bg-white px-1 rounded">https://workspace.notion.site/ebd/...</code>
                </div>
              </div>
            </div>
          )}
          {tab === 'snapshot' && (
            <div className="grid gap-2 text-xs">
              <label className="grid gap-1">
                <span>Snapshot URL</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://snapshot.box/#/s:gitcoindao.eth/proposal/0x13c3..."
                    value={snapshotUrl}
                    onChange={(e) => {
                      setSnapshotUrl(e.target.value)
                      setSnapshotValidationResult(null)
                    }}
                    className="border rounded px-2 py-1 flex-1 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={validateSnapshotUrl}
                    disabled={isValidatingSnapshot || !snapshotUrl.trim()}
                    className="px-3 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isValidatingSnapshot ? 'Validating...' : 'Validate URL'}
                  </button>
                </div>
              </label>
              {snapshotValidationResult && (
                <div className={`text-[10px] p-2 rounded ${snapshotValidationResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="font-semibold">{snapshotValidationResult.success ? '✓ Valid' : '✗ Error'}</div>
                  {snapshotValidationResult.error && (
                    <div className="mt-1">{snapshotValidationResult.error}</div>
                  )}
                  {snapshotValidationResult.success && snapshotValidationResult.data && (
                    <div className="mt-2">
                      <div className="font-semibold mb-2">Proposal Data:</div>
                      <div className="bg-white p-2 rounded text-[9px] font-mono overflow-auto max-h-[100px]">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><strong>Proposal ID:</strong></div>
                          <div className="break-all">{snapshotValidationResult.data.proposalId}</div>
                          
                          <div><strong>State:</strong></div>
                          <div>{snapshotValidationResult.data.state}</div>
                          
                          <div><strong>Choices:</strong></div>
                          <div>{JSON.stringify(snapshotValidationResult.data.choices)}</div>
                          
                          <div><strong>Scores:</strong></div>
                          <div>{JSON.stringify(snapshotValidationResult.data.scores)}</div>
                          
                          <div><strong>Total Score:</strong></div>
                          <div>{snapshotValidationResult.data.scoresTotal}</div>
                          
                          <div><strong>Quorum:</strong></div>
                          <div>{snapshotValidationResult.data.quorum}</div>
                          
                          <div><strong>End Date:</strong></div>
                          <div>{new Date(snapshotValidationResult.data.end * 1000).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><strong>Percentages:</strong></div>
                          <div></div>
                          {snapshotValidationResult.data.choices.map((choice: string, index: number) => {
                            const score = snapshotValidationResult.data.scores[index] || 0
                            const percentage = snapshotValidationResult.data.scoresTotal > 0 
                              ? ((score / snapshotValidationResult.data.scoresTotal) * 100).toFixed(2)
                              : '0.00'
                            return (
                              <React.Fragment key={index}>
                                <div className="ml-2">{choice}:</div>
                                <div>{percentage}%</div>
                              </React.Fragment>
                            )
                          })}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-x-4">
                          <div><strong>Quorum %:</strong></div>
                          <div>{
                            snapshotValidationResult.data.quorum > 0
                              ? Math.round((snapshotValidationResult.data.scoresTotal / snapshotValidationResult.data.quorum) * 100)
                              : 'N/A'
                          }%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Border and Clickable sections - snapshot tab uses columns, others use normal layout */}
          {tab === 'snapshot' ? (
          <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="grid grid-cols-2 gap-4">
                {/* Left column - Border section */}
                <div className="grid gap-2 text-xs">
                  <div className="font-medium mb-1">Border Settings</div>
                  <label className="grid gap-1">
                    <span>Background Color</span>
                    <input
                      type="color"
                      value={draft.backgroundColor ?? item?.backgroundColor ?? '#ffffff'}
                      onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.border !== undefined ? draft.border : (item?.border !== undefined ? item.border : true)}
                      onChange={(e) => setDraft({ ...draft, border: e.target.checked })}
                    />
                    <span>Show Border</span>
                  </label>
                  {(draft.border !== undefined ? draft.border : (item?.border !== undefined ? item.border : true)) && (
                    <>
                      <label className="grid gap-1">
                        <span>Border Color</span>
                        <input
                          type="color"
                          value={draft.borderColor ?? item?.borderColor ?? '#000000'}
                          onChange={(e) => setDraft({ ...draft, borderColor: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span>Border Width (px)</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={draft.borderWidth !== undefined ? draft.borderWidth : (item?.borderWidth !== undefined ? item.borderWidth : 1)}
                          onChange={(e) => setDraft({ ...draft, borderWidth: Number(e.target.value) })}
                        />
                      </label>
                    </>
                  )}
                </div>
                {/* Right column - Clickable section */}
                <div className="grid gap-2 text-xs">
                  <div className="font-medium mb-1">Clickable Settings</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.clickable !== undefined ? draft.clickable : ((item as any)?.clickable ?? false)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setDraft({ ...draft, clickable: checked })
                        if (!checked) {
                          setDraft({ ...draft, clickable: false, url: '', openIn: 'new-tab' })
                          setClickableUrlError(null)
                        }
                      }}
                    />
                    <span>Make this box clickable</span>
                  </label>
                  
                  {(draft.clickable !== undefined ? draft.clickable : ((item as any)?.clickable ?? false)) && (
                    <div className="grid gap-2 pl-6">
                      <label className="grid gap-1">
                        <span>URL <span className="text-red-600">*</span></span>
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={draft.url ?? (item as any)?.url ?? ''}
                          onChange={(e) => {
                            const value = e.target.value.trim()
                            setDraft({ ...draft, url: value })
                            if (!value) {
                              setClickableUrlError(null)
                              return
                            }
                            // Basic URL validation
                            try {
                              const parsed = new URL(value)
                              if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                                setClickableUrlError(null)
                              } else {
                                setClickableUrlError('URL must start with http or https')
                              }
                            } catch {
                              setClickableUrlError('Enter a valid URL (https://...)')
                            }
                          }}
                          className="border rounded px-2 py-1"
                        />
                      </label>
                      {clickableUrlError && (
                        <div className="text-[11px] text-red-600">{clickableUrlError}</div>
                      )}
                      <label className="grid gap-1">
                        <span>Open in</span>
                        <select
                          value={draft.openIn ?? (item as any)?.openIn ?? 'new-tab'}
                          onChange={(e) => setDraft({ ...draft, openIn: e.target.value as 'new-tab' | 'same-tab' })}
                          className="border rounded px-2 py-1"
                        >
                          <option value="new-tab">New tab (default)</option>
                          <option value="same-tab">Same tab</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="grid gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.clickable !== undefined ? draft.clickable : ((item as any)?.clickable ?? false)}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setDraft({ ...draft, clickable: checked })
                    if (!checked) {
                      setDraft({ ...draft, clickable: false, url: '', openIn: 'new-tab' })
                      setClickableUrlError(null)
                    }
                  }}
                />
                <span className="font-medium">Make this box clickable</span>
              </label>
              
              {(draft.clickable !== undefined ? draft.clickable : ((item as any)?.clickable ?? false)) && (
                <div className="grid gap-2 pl-6">
                  <label className="grid gap-1">
                    <span>URL <span className="text-red-600">*</span></span>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={draft.url ?? (item as any)?.url ?? ''}
                      onChange={(e) => {
                        const value = e.target.value.trim()
                        setDraft({ ...draft, url: value })
                        if (!value) {
                          setClickableUrlError(null)
                          return
                        }
                        // Basic URL validation
                        try {
                          const parsed = new URL(value)
                          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                            setClickableUrlError(null)
                          } else {
                            setClickableUrlError('URL must start with http or https')
                          }
                        } catch {
                          setClickableUrlError('Enter a valid URL (https://...)')
                        }
                      }}
                      className="border rounded px-2 py-1"
                    />
                  </label>
                  {clickableUrlError && (
                    <div className="text-[11px] text-red-600">{clickableUrlError}</div>
                  )}
                  <label className="grid gap-1">
                    <span>Open in</span>
                    <select
                      value={draft.openIn ?? (item as any)?.openIn ?? 'new-tab'}
                      onChange={(e) => setDraft({ ...draft, openIn: e.target.value as 'new-tab' | 'same-tab' })}
                      className="border rounded px-2 py-1"
                    >
                      <option value="new-tab">New tab (default)</option>
                      <option value="same-tab">Same tab</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

function parseNotionKanbanUrl(input: string): { embedUrl?: string; sourceUrl?: string; error?: string } {
  const trimmed = (input || '').trim()
  if (!trimmed) {
    return { error: 'Please provide a Notion embed URL.' }
  }

  try {
    const url = new URL(trimmed)
    
    // Validate it's a Notion URL
    if (!url.hostname.includes('notion.site') && !url.hostname.includes('notion.so')) {
      return { error: 'URL must be from Notion (notion.site or notion.so)' }
    }

    // Check if it's an embed URL (has /ebd/ in path)
    const isEmbedUrl = url.pathname.includes('/ebd/')
    
    if (isEmbedUrl) {
      // It's already an embed URL - use it directly
      return { embedUrl: trimmed, sourceUrl: trimmed }
    }

    // Fallback: Try to extract from regular URL format
    // Path format: /{databaseId}?v={viewId}
    const pathMatch = url.pathname.match(/\/([a-f0-9]{32})/i)
    if (pathMatch) {
      const databaseId = pathMatch[1]
      const viewId = url.searchParams.get('v')
      
      if (viewId) {
        // Construct embed URL from regular URL
        const embedUrl = `https://${url.hostname}/ebd/${databaseId}?v=${viewId}`
        return { embedUrl, sourceUrl: trimmed }
      }
    }

    return { error: 'Please use a Notion embed URL (with /ebd/ in the path) or a kanban board view URL (with ?v= parameter).' }
  } catch (err) {
    return { error: 'Invalid URL format. Please enter a valid Notion URL (https://...)' }
  }
}

function parseDuneInput(input: string): { queryId?: string; vizId?: string; sourceUrl?: string } {
  const trimmed = (input || '').trim()
  if (!trimmed) return {}
  // If it's a raw numeric id, accept directly
  if (/^\d+$/.test(trimmed)) {
    return { queryId: trimmed }
  }
  // Try to parse as URL
  try {
    const u = new URL(trimmed)
    const parts = u.pathname.split('/').filter(Boolean)
    // Look for /queries/<queryId>/<vizId?>
    const qi = parts.findIndex((p) => p.toLowerCase() === 'queries')
    if (qi >= 0 && parts[qi + 1]) {
      const queryId = parts[qi + 1]
      const vizId = parts[qi + 2]
      return { queryId, vizId, sourceUrl: trimmed }
    }
    // Some links might come as /embeds/<...> – keep original as sourceUrl and try to extract numbers
    const nums = parts.map((p) => p.match(/^(\d+)$/)?.[1]).filter(Boolean)
    if (nums.length > 0) {
      return { queryId: nums[0], vizId: nums[1], sourceUrl: trimmed }
    }
    return { sourceUrl: trimmed }
  } catch {
    // Not a URL; return as-is
    return {}
  }
}

function InlineNameEditor({ projectId, canvasId, selectedId, initialName, scope }: { projectId: string; canvasId: string; selectedId: string; initialName: string; scope?: { type: 'root' } | { type: 'child'; childId: string } }) {
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

  const pathForCanvasDoc = () => {
    const base: string[] = ['interoperable-canvas', projectId]
    if ((scope as any)?.type === 'child') base.push('child-canvases', (scope as any).childId)
    base.push('canvases', canvasId)
    return base
  }

  const save = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) { setEditing(false); setValue(initialName); return }
    const uniqueKey = `${trimmed}_${toTimestampSuffix()}`
    const ref = doc(db, pathForCanvasDoc().concat(['overlay', selectedId]).join('/'))
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


