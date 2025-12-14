'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { toPng } from 'html-to-image'

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
const functions = getFunctions(app)

// Types for Gardens proposal data
interface GardensProposal {
  id: string
  proposalNumber: number
  title?: string
  description?: string
  requestedAmount: string
  tokenSymbol?: string
  tokenAddress?: string
  executionStatus: string
  createdAt: string
  metadataHash?: string
  status: 'success' | 'ipfs_failed' | 'subgraph_failed'
  error?: string
  summary?: string
  github?: string | null
  karmaProfile?: string | null
  proposalUrl?: string | null
}

interface ParsedGardensUrl {
  chainId: number
  address1: string
  address2: string
  poolId: number
}

function GardensReportBuilderContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams?.get('projectId') || 'gardens-fund'
  const childId = searchParams?.get('childId') || ''
  const [aspect, setAspect] = useState<string | null>(null)
  const [loadingAspect, setLoadingAspect] = useState(true)
  const [gardensUrl, setGardensUrl] = useState('')
  const [parsedUrl, setParsedUrl] = useState<ParsedGardensUrl | null>(null)
  const [sanitizedUrl, setSanitizedUrl] = useState<string | null>(null)
  const [proposals, setProposals] = useState<GardensProposal[]>([])
  const [proposalDescriptions, setProposalDescriptions] = useState<Record<string, string>>({}) // Store descriptions by proposal ID
  const [isFetchingDescriptions, setIsFetchingDescriptions] = useState(false) // Track if descriptions are being fetched
  const [isExtracting, setIsExtracting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{
    test4?: { success: boolean; data?: any; error?: string; query?: string }
    refresh?: { success: boolean; data?: any; error?: string; query?: string }
  }>({})
  const [detectedNetwork, setDetectedNetwork] = useState<{ chainId: number; name: string; queryUrl?: string } | null>(null)

  // AI Form State
  const [aiAgent, setAiAgent] = useState<string>('openai')
  const [aiModel, setAiModel] = useState<string>('gpt-5.1')
  const [aiTemperature, setAiTemperature] = useState<number>(0.7)
  const [aiReasoningEffort, setAiReasoningEffort] = useState<string>('medium')
  const [aiTask, setAiTask] = useState<string>('Extract summary and links from proposal description')
  const [aiSummaryDescription, setAiSummaryDescription] = useState<string>('Extract a concise summary focusing only on the main problem being solved and the solution')
  const [aiSummaryRequired, setAiSummaryRequired] = useState<boolean>(true)
  const [aiSummaryPrefix, setAiSummaryPrefix] = useState<string>('AI Summary: ')
  const [aiSummaryFocus, setAiSummaryFocus] = useState<string>('problem, solution')
  const [aiWordCountMin, setAiWordCountMin] = useState<number>(40)
  const [aiWordCountMax, setAiWordCountMax] = useState<number>(50)
  const [aiGithubRequired, setAiGithubRequired] = useState<boolean>(true)
  const [aiGithubDescription, setAiGithubDescription] = useState<string>('Extract GitHub repository link if available in the description')
  const [aiKarmaRequired, setAiKarmaRequired] = useState<boolean>(true)
  const [aiKarmaDescription, setAiKarmaDescription] = useState<string>('Extract Karma GAP profile link if available in the description')
  const [aiOutputFormat, setAiOutputFormat] = useState<string>('json')
  const [aiOutputDestination, setAiOutputDestination] = useState<string>('return')
  const [jsonPreview, setJsonPreview] = useState<string>('')
  const [isAiSectionVisible, setIsAiSectionVisible] = useState<boolean>(false)
  const [isProposalsTableVisible, setIsProposalsTableVisible] = useState<boolean>(true)
  const [isBoxPreviewVisible, setIsBoxPreviewVisible] = useState<boolean>(true)
  const [boxPreviewBackgroundColor, setBoxPreviewBackgroundColor] = useState<string>('#adaba9')
  const [boxPreviewCardColorType, setBoxPreviewCardColorType] = useState<'solid' | 'gradient'>('solid')
  const [boxPreviewCardColor, setBoxPreviewCardColor] = useState<string>('#c9fdc9') // Light green default
  const [boxPreviewCardGradientColor, setBoxPreviewCardGradientColor] = useState<string>('#a8e6a8') // Second color for gradient
  const [boxPreviewCardBorderColor, setBoxPreviewCardBorderColor] = useState<string>('#006400') // Dark green default
  const [boxPreviewCardBorderSize, setBoxPreviewCardBorderSize] = useState<number>(3) // px
  const [boxPreviewSpaceBetweenCards, setBoxPreviewSpaceBetweenCards] = useState<number>(8) // px
  const [boxPreviewSpaceBetweenColumns, setBoxPreviewSpaceBetweenColumns] = useState<number>(1) // px
  const [boxPreviewFontSize, setBoxPreviewFontSize] = useState<number>(10) // pt
  const [boxPreviewColumnWidths, setBoxPreviewColumnWidths] = useState<{ title: number; summary: number; amount: number; links: number }>({ title: 25, summary: 40, amount: 20, links: 15 }) // percentages
  const [boxPreviewLinksColor, setBoxPreviewLinksColor] = useState<string>('#0066cc') // Default blue
  const [boxPreviewSortBy, setBoxPreviewSortBy] = useState<'amount-desc' | 'number-asc' | 'title-asc'>('amount-desc')
  const [isResizingColumn, setIsResizingColumn] = useState<string | null>(null) // Track which column is being resized
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; proposal: GardensProposal | null }>({ show: false, proposal: null })
  const [boxPreviewRef, setBoxPreviewRef] = useState<HTMLDivElement | null>(null)
  const [savingPng, setSavingPng] = useState(false)
  const [savedPngFilename, setSavedPngFilename] = useState<string | null>(null)
  const [addingToCanvas, setAddingToCanvas] = useState(false)
  const [showSavePngModal, setShowSavePngModal] = useState(false)
  const [pngFilename, setPngFilename] = useState<string>('')
  const [existingPngFiles, setExistingPngFiles] = useState<Array<{ name: string; fullPath: string }>>([])
  const [showSendToCanvasModal, setShowSendToCanvasModal] = useState(false)
  const [sendToCanvasWidth, setSendToCanvasWidth] = useState(90) // Default 90%
  const [sendToCanvasY, setSendToCanvasY] = useState(0)
  const [sendToCanvasAlignment, setSendToCanvasAlignment] = useState<'left' | 'center' | 'right'>('center')
  const [loadingExistingReport, setLoadingExistingReport] = useState(false)

  // Build Firestore path
  const firestorePath = childId
    ? `interoperable-canvas/${projectId}/child-canvases/${childId}/canvases/root`
    : `interoperable-canvas/${projectId}/canvases/root`

  const overlayPath = childId
    ? `interoperable-canvas/${projectId}/child-canvases/${childId}/canvases/root/overlay`
    : `interoperable-canvas/${projectId}/canvases/root/overlay`

  // Fetch aspect ratio from Firestore
  useEffect(() => {
    if (!projectId || !childId) {
      setLoadingAspect(false)
      return
    }

    const fetchAspect = async () => {
      try {
        const canvasRef = doc(db, firestorePath)
        const snap = await getDoc(canvasRef)
        if (snap.exists()) {
          const data = snap.data()
          setAspect(data?.aspect || null)
        } else {
          setAspect(null)
        }
      } catch (error) {
        console.error('Error fetching aspect ratio:', error)
        setAspect(null)
      } finally {
        setLoadingAspect(false)
      }
    }

    fetchAspect()
  }, [projectId, childId, firestorePath])

  // Update JSON preview when form values change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Use placeholder text for description in preview
      const sampleDescription = '(we will add the full description of each proposal)'

      // Convert focus string to array
      const focusArray = aiSummaryFocus
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      const previewJson = {
        model: aiModel,
        temperature: aiTemperature,
        reasoning: {
          effort: aiReasoningEffort
        },
        task: aiTask,
        instructions: {
          summary: {
            required: aiSummaryRequired,
            description: aiSummaryDescription,
            prefix: aiSummaryPrefix,
            wordCount: {
              min: aiWordCountMin,
              max: aiWordCountMax
            },
            focus: focusArray
          },
          github: {
            required: aiGithubRequired,
            description: aiGithubDescription
          },
          karmaProfile: {
            required: aiKarmaRequired,
            description: aiKarmaDescription
          }
        },
        outputFormat: aiOutputFormat,
        outputDestination: {
          type: aiOutputDestination
        },
        input: {
          description: sampleDescription
        }
      }

      setJsonPreview(JSON.stringify(previewJson, null, 2))
    }, 300)

    return () => clearTimeout(timer)
  }, [
    aiModel, aiTemperature, aiReasoningEffort, aiTask,
    aiSummaryDescription, aiSummaryRequired, aiSummaryPrefix, aiSummaryFocus,
    aiWordCountMin, aiWordCountMax,
    aiGithubRequired, aiGithubDescription,
    aiKarmaRequired, aiKarmaDescription,
    aiOutputFormat, aiOutputDestination,
    proposals
  ])

  // Get network info from chainId
  const getNetworkInfo = (chainId: number): { name: string; queryUrl?: string; coingeckoChainId?: string } => {
    const networkMap: Record<number, { name: string; queryUrl?: string; coingeckoChainId?: string }> = {
      10: {
        name: 'Optimism',
        queryUrl: 'https://gateway.thegraph.com/api/{apiKey}/subgraphs/id/FmcVWeR9xdJyjM53DPuCvEdH24fSXARdq4K5K8EZRZVp',
        coingeckoChainId: 'optimistic-ethereum'
      },
      // Add other networks as we discover them
    }
    
    if (networkMap[chainId]) {
      return networkMap[chainId]
    }
    
    return {
      name: `Chain ID ${chainId}`,
      queryUrl: undefined,
      coingeckoChainId: undefined
    }
  }

  // Fetch token symbol from CoinGecko API
  const fetchTokenSymbolFromCoinGecko = async (tokenAddress: string, chainId: number): Promise<string | undefined> => {
    const networkInfo = getNetworkInfo(chainId)
    if (!networkInfo.coingeckoChainId) {
      return undefined
    }

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${networkInfo.coingeckoChainId}/contract/${tokenAddress.toLowerCase()}`
      )
      
      if (!response.ok) {
        return undefined
      }

      const data = await response.json()
      return data.symbol?.toUpperCase()
    } catch (err) {
      console.log('CoinGecko API error:', err)
      return undefined
    }
  }

  // Parse Gardens URL
  const parseGardensUrl = (url: string): { parsed: ParsedGardensUrl | null; error: string | null } => {
    try {
      const urlObj = new URL(url)
      
      // Validate domain
      if (!urlObj.hostname.includes('gardens.fund')) {
        return { parsed: null, error: 'Invalid domain. URL must be from app.gardens.fund' }
      }

      // Parse path: /gardens/{chainId}/{address1}/{address2}/{poolId}
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      
      if (pathParts.length < 4 || pathParts[0] !== 'gardens') {
        return { parsed: null, error: 'Invalid URL format. Expected: /gardens/{chainId}/{address1}/{address2}/{poolId}' }
      }

      const chainId = parseInt(pathParts[1], 10)
      const address1 = pathParts[2]
      const address2 = pathParts[3]
      const poolId = parseInt(pathParts[4], 10)

      // Validate chainId
      if (isNaN(chainId) || chainId <= 0) {
        return { parsed: null, error: 'Invalid chain ID. Must be a positive number.' }
      }

      // Validate addresses (hex format: 0x + 40 characters)
      const hexAddressRegex = /^0x[a-fA-F0-9]{40}$/
      if (!hexAddressRegex.test(address1)) {
        return { parsed: null, error: 'Invalid address1 format. Must be a valid hex address (0x + 40 characters).' }
      }
      if (!hexAddressRegex.test(address2)) {
        return { parsed: null, error: 'Invalid address2 format. Must be a valid hex address (0x + 40 characters).' }
      }

      // Validate poolId
      if (isNaN(poolId) || poolId <= 0) {
        return { parsed: null, error: 'Invalid pool ID. Must be a positive number.' }
      }

      return {
        parsed: { chainId, address1, address2, poolId },
        error: null
      }
    } catch (err) {
      return { parsed: null, error: `Invalid URL: ${err instanceof Error ? err.message : 'Unknown error'}` }
    }
  }

  // Query subgraph for executed proposals
  const fetchExecutedProposals = async (parsed: ParsedGardensUrl): Promise<GardensProposal[]> => {
    // TODO: Replace with actual subgraph version once we test
    const subgraphUrl = `https://api.studio.thegraph.com/query/102093/gardens-v2---optimism/latest`
    
    // GraphQL query - will need to refine based on actual schema
    const query = `
      query GetExecutedProposals($poolId: BigInt!) {
        cvproposals(
          where: { 
            strategy_: { poolId: $poolId },
            proposalStatus: 4
          }
          orderBy: createdAt
          orderDirection: desc
        ) {
          id
          proposalNumber
          proposalStatus
          requestedAmount
          metadataHash
          createdAt
          metadata {
            title
          }
        }
      }
    `

    try {
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            poolId: parsed.poolId.toString()
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Subgraph query failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`)
      }

      // Transform subgraph data to our format
      const proposals: GardensProposal[] = (result.data?.cvproposals || []).map((p: any) => ({
        id: p.id,
        proposalNumber: p.proposalNumber || 0,
        title: p.metadata?.title || undefined,
        requestedAmount: p.requestedAmount || '0',
        executionStatus: p.proposalStatus === 4 ? 'executed' : 'unknown',
        createdAt: p.createdAt ? new Date(parseInt(p.createdAt) * 1000).toISOString() : '',
        metadataHash: p.metadataHash || undefined,
        status: 'success' as const
      }))

      return proposals
    } catch (err) {
      console.error('Error fetching proposals:', err)
      throw err
    }
  }

  // Test a GraphQL query
  const testGraphQLQuery = async (url: string, query: string, testName: string) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query
        })
      })

      const result = await response.json()
      
      return {
        success: response.ok && !result.errors && !result.message,
        data: result,
        error: result.errors ? JSON.stringify(result.errors, null, 2) : result.message ? `Message: ${result.message}` : undefined,
        query: query
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        query: query
      }
    }
  }

  // Sanitize URL for Firestore document ID (convert slashes to dashes)
  const sanitizeUrlForFirestore = (parsed: ParsedGardensUrl): string => {
    return `${parsed.chainId}-${parsed.address1}-${parsed.address2}-${parsed.poolId}`
  }

  // Get Firestore document path for gardens-pools
  const getGardensPoolDocPath = (sanitizedUrl: string): string => {
    return `${firestorePath}/gardens-pools/${sanitizedUrl}`
  }

  // Check if gardens pool document exists in Firestore
  const checkFirestoreForPool = async (sanitizedUrl: string): Promise<{ exists: boolean; data?: any }> => {
    try {
      const docPath = getGardensPoolDocPath(sanitizedUrl)
      const docRef = doc(db, docPath)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { exists: true, data: docSnap.data() }
      }
      return { exists: false }
    } catch (error) {
      console.error('Error checking Firestore:', error)
      return { exists: false }
    }
  }

  // Save proposals to Firestore (without description)
  const saveProposalsToFirestore = async (
    sanitizedUrl: string,
    proposals: GardensProposal[],
    gardensUrl: string,
    parsed: ParsedGardensUrl
  ): Promise<void> => {
    try {
      const docPath = getGardensPoolDocPath(sanitizedUrl)
      const docRef = doc(db, docPath)
      
      // Prepare proposals for Firestore (exclude description)
      const proposalsForFirestore = proposals.map(p => ({
        id: p.id,
        proposalNumber: p.proposalNumber,
        proposalStatus: p.executionStatus === 'executed' ? '4' : p.executionStatus,
        requestedAmount: p.requestedAmount,
        createdAt: p.createdAt,
        title: p.title || null,
        tokenAddress: p.tokenAddress || null,
        tokenSymbol: p.tokenSymbol || null,
        metadataHash: p.metadataHash || null,
        proposalUrl: gardensUrl ? `${gardensUrl}/${p.id}` : null,
        // AI-enriched fields (initially empty)
        summary: p.summary || null,
        github: p.github || null,
        karmaProfile: p.karmaProfile || null,
        aiFilledAt: null,
        aiFilledBy: null
      }))

      // Check if document exists to preserve boxPreview settings
      const docSnap = await getDoc(docRef)
      const existingBoxPreview = docSnap.exists() ? docSnap.data()?.boxPreview : null

      await setDoc(docRef, {
        url: gardensUrl,
        chainId: parsed.chainId,
        poolId: parsed.poolId.toString(),
        createdAt: serverTimestamp(),
        lastRefreshedAt: serverTimestamp(),
        proposals: proposalsForFirestore,
        boxPreview: existingBoxPreview || {
          backgroundColor: '#adaba9',
          cardColorType: 'solid',
          cardColor: '#c9fdc9', // Light green
          cardGradientColor: '#a8e6a8', // Second color for gradient
          cardBorderColor: '#006400', // Dark green
          cardBorderSize: 3,
          spaceBetweenCards: 8,
          spaceBetweenColumns: 1,
          fontSize: 10,
          columnWidths: { title: 25, summary: 40, amount: 20, links: 15 }, // percentages
          linksColor: '#0066cc',
          sortBy: 'amount-desc'
        }
      }, { merge: false }) // Use merge: false to overwrite if exists (fresh query)
      
      console.log('Proposals saved to Firestore successfully')
    } catch (error) {
      console.error('Error saving to Firestore:', error)
      throw error
    }
  }

  // Update a single proposal's AI fields in Firestore
  const updateProposalAiFieldsInFirestore = async (
    sanitizedUrl: string,
    proposalId: string,
    aiFields: {
      summary: string
      github: string | null
      karmaProfile: string | null
    }
  ): Promise<void> => {
    try {
      const docPath = getGardensPoolDocPath(sanitizedUrl)
      const docRef = doc(db, docPath)
      const docSnap = await getDoc(docRef)
      
      if (!docSnap.exists()) {
        throw new Error(`Firestore document not found at path: ${docPath}`)
      }

      const data = docSnap.data()
      const proposals = data.proposals || []
      
      // Check if proposal exists
      const proposalExists = proposals.some((p: any) => p.id === proposalId)
      if (!proposalExists) {
        throw new Error(`Proposal ${proposalId} not found in Firestore document`)
      }
      
      // Find and update the specific proposal
      // Note: Cannot use serverTimestamp() inside arrays, so use regular Date
      const updatedProposals = proposals.map((p: any) => {
        if (p.id === proposalId) {
          return {
            ...p,
            summary: aiFields.summary,
            github: aiFields.github,
            karmaProfile: aiFields.karmaProfile,
            aiFilledAt: new Date().toISOString()
          }
        }
        return p
      })

      // Update Firestore document - use merge: false to replace entire document
      // This ensures the proposals array is properly updated
      await setDoc(docRef, {
        url: data.url,
        chainId: data.chainId,
        poolId: data.poolId,
        createdAt: data.createdAt,
        lastRefreshedAt: data.lastRefreshedAt,
        proposals: updatedProposals
      }, { merge: false })

      console.log(`Updated AI fields for proposal ${proposalId} in Firestore`)
    } catch (error) {
      console.error('Error updating proposal AI fields in Firestore:', error)
      console.error('Error details:', {
        sanitizedUrl,
        proposalId,
        aiFields,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // Load proposals from Firestore
  const loadProposalsFromFirestore = (firestoreData: any): { proposals: GardensProposal[], lastRefreshedAt: Date | null } => {
    const proposals = firestoreData.proposals || []
    const loadedProposals = proposals.map((p: any) => ({
      id: p.id,
      proposalNumber: p.proposalNumber || 0,
      title: p.title || undefined,
      // description is NOT loaded from Firestore (never stored)
      requestedAmount: p.requestedAmount || '0',
      tokenSymbol: p.tokenSymbol || undefined,
      tokenAddress: p.tokenAddress || undefined,
      executionStatus: p.proposalStatus === '4' || p.proposalStatus === 4 ? 'executed' : 'unknown',
      createdAt: p.createdAt || '',
      metadataHash: p.metadataHash || undefined,
      status: 'success' as const,
      summary: p.summary || undefined,
      github: p.github || undefined,
      karmaProfile: p.karmaProfile || undefined,
      proposalUrl: p.proposalUrl || undefined
    }))

    // Extract lastRefreshedAt timestamp
    let lastRefreshed: Date | null = null
    if (firestoreData.lastRefreshedAt) {
      // Firestore Timestamp object
      if (firestoreData.lastRefreshedAt.toDate) {
        lastRefreshed = firestoreData.lastRefreshedAt.toDate()
      } else if (firestoreData.lastRefreshedAt.seconds) {
        lastRefreshed = new Date(firestoreData.lastRefreshedAt.seconds * 1000)
      } else if (typeof firestoreData.lastRefreshedAt === 'string') {
        lastRefreshed = new Date(firestoreData.lastRefreshedAt)
      }
    }

    return { proposals: loadedProposals, lastRefreshedAt: lastRefreshed }
  }

  // Handle extract information button click - Check Firestore first, then query subgraph if needed
  const handleExtractInformation = async () => {
    setIsExtracting(true)
    setError(null)
    setProposals([])
    setTestResults({})

    if (!parsedUrl) {
      setError('Please enter a Gardens URL first')
      setIsExtracting(false)
      return
    }

    // Sanitize URL for Firestore document ID
    const sanitizedUrlValue = sanitizeUrlForFirestore(parsedUrl)
    setSanitizedUrl(sanitizedUrlValue)

    // STEP 1: Check if document exists in Firestore
    const firestoreCheck = await checkFirestoreForPool(sanitizedUrlValue)
    
    // Set sanitizedUrl in state for PNG filename
    setSanitizedUrl(sanitizedUrlValue)
    
    if (firestoreCheck.exists && firestoreCheck.data) {
      // Load from Firestore
      console.log('Loading proposals from Firestore')
      const { proposals: loadedProposals, lastRefreshedAt } = loadProposalsFromFirestore(firestoreCheck.data)
      
      // Check if any proposals are missing proposalUrl and fill them
      const poolUrl = firestoreCheck.data.url || gardensUrl
      let needsUpdate = false
      const updatedProposals = loadedProposals.map(p => {
        if (!p.proposalUrl && poolUrl) {
          needsUpdate = true
          return { ...p, proposalUrl: `${poolUrl}/${p.id}` }
        }
        return p
      })
      
      // If any proposalUrls were missing, update Firestore
      if (needsUpdate && poolUrl) {
        console.log('Filling missing proposalUrl fields in Firestore')
        const docPath = getGardensPoolDocPath(sanitizedUrlValue)
        const docRef = doc(db, docPath)
        
        // Get current proposals from Firestore and update them
        const currentProposals = firestoreCheck.data.proposals || []
        const updatedProposalsForFirestore = currentProposals.map((p: any) => {
          if (!p.proposalUrl && poolUrl) {
            return { ...p, proposalUrl: `${poolUrl}/${p.id}` }
          }
          return p
        })
        
        // Update Firestore with proposalUrls (preserve all other fields)
        await setDoc(docRef, {
          proposals: updatedProposalsForFirestore
        }, { merge: true })
        
        console.log('Proposal URLs updated in Firestore')
      }
      
      setProposals(updatedProposals)
      setLastRefreshedAt(lastRefreshedAt)
      
      // Load box preview settings
      if (firestoreCheck.data.boxPreview) {
        const bp = firestoreCheck.data.boxPreview
        if (bp.backgroundColor) setBoxPreviewBackgroundColor(bp.backgroundColor)
        if (bp.cardColorType) setBoxPreviewCardColorType(bp.cardColorType)
        if (bp.cardColor) setBoxPreviewCardColor(bp.cardColor)
        if (bp.cardGradientColor) setBoxPreviewCardGradientColor(bp.cardGradientColor)
        if (bp.cardBorderColor) setBoxPreviewCardBorderColor(bp.cardBorderColor)
        if (bp.cardBorderSize !== undefined) setBoxPreviewCardBorderSize(bp.cardBorderSize)
        if (bp.spaceBetweenCards !== undefined) setBoxPreviewSpaceBetweenCards(bp.spaceBetweenCards)
        if (bp.spaceBetweenColumns !== undefined) setBoxPreviewSpaceBetweenColumns(bp.spaceBetweenColumns)
        if (bp.fontSize !== undefined) setBoxPreviewFontSize(bp.fontSize)
        if (bp.columnWidths) setBoxPreviewColumnWidths(bp.columnWidths)
        if (bp.linksColor) setBoxPreviewLinksColor(bp.linksColor)
        if (bp.sortBy) setBoxPreviewSortBy(bp.sortBy)
      }
      
      setIsExtracting(false)
      return
    }

    // STEP 2: Document doesn't exist, query subgraph
    console.log('Document not found in Firestore, querying subgraph')
    
    // Subgraph ID: FmcVWeR9xdJyjM53DPuCvEdH24fSXARdq4K5K8EZRZVp
    const subgraphId = 'FmcVWeR9xdJyjM53DPuCvEdH24fSXARdq4K5K8EZRZVp'
    const apiKey = process.env.NEXT_PUBLIC_SUBGRAPH_KEY || ''
    
    if (!apiKey) {
      setError('API key not found. Please add NEXT_PUBLIC_SUBGRAPH_KEY to .env.local')
      setIsExtracting(false)
      return
    }

    // Use the working Gateway URL format
    const subgraphUrl = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`

    // Query proposals with token info from strategy and metadata
    const test4Query = `{ cvproposals(where: { strategy_: { poolId: "${parsedUrl.poolId}" }, proposalStatus: 4 }) { id proposalNumber proposalStatus requestedAmount createdAt metadataHash metadata { title description } strategy { id poolId token } } }`
    const result4 = await testGraphQLQuery(subgraphUrl, test4Query, 'test4')
    setTestResults(prev => ({ ...prev, test4: result4 }))

    // If query succeeded, fetch token info and populate proposals
    if (result4.success && result4.data?.data?.cvproposals) {
      const proposalsData = result4.data.data.cvproposals
      const tokenAddress = proposalsData[0]?.strategy?.token

      // Try to get token symbol - first from CoinGecko, then fallback to subgraph
      let tokenSymbol: string | undefined = undefined
      if (tokenAddress && parsedUrl) {
        // Try CoinGecko first (most reliable)
        tokenSymbol = await fetchTokenSymbolFromCoinGecko(tokenAddress, parsedUrl.chainId)
        
        // Fallback to subgraph if CoinGecko fails
        if (!tokenSymbol) {
          try {
            const tokenQuery = `{ tokens(where: { id: "${tokenAddress}" }, first: 1) { id symbol name decimals } }`
            const tokenResult = await testGraphQLQuery(subgraphUrl, tokenQuery, 'token')
            if (tokenResult.success && tokenResult.data?.data?.tokens && tokenResult.data.data.tokens.length > 0) {
              tokenSymbol = tokenResult.data.data.tokens[0].symbol
            }
          } catch (err) {
            console.log('Could not fetch token info from subgraph')
          }
        }
      }

      // Transform subgraph data to our format and store descriptions separately
      const descriptionsMap: Record<string, string> = {}
      const proposals: GardensProposal[] = proposalsData.map((p: any) => {
        // Handle proposalStatus as number or string
        const proposalStatus = typeof p.proposalStatus === 'string' 
          ? parseInt(p.proposalStatus) 
          : p.proposalStatus
        
        let executionStatus = 'failed'
        if (proposalStatus === 4) {
          executionStatus = 'executed'
        } else if (proposalStatus === 0) {
          executionStatus = 'pending'
        }

        // Store description separately (not in proposal object for Firestore)
        if (p.metadata?.description) {
          descriptionsMap[p.id] = p.metadata.description
        }

        return {
          id: p.id,
          proposalNumber: parseInt(p.proposalNumber) || 0,
          title: p.metadata?.title || undefined,
          description: p.metadata?.description || undefined, // Keep in component state for AI, NOT saved to Firestore
          requestedAmount: p.requestedAmount || '0',
          tokenSymbol: tokenSymbol,
          tokenAddress: p.strategy?.token,
          executionStatus: executionStatus,
          createdAt: p.createdAt ? new Date(parseInt(p.createdAt) * 1000).toISOString() : '',
          metadataHash: p.metadataHash || undefined,
          status: 'success' as const
        }
      })

      // Store descriptions in component state (for AI Fill button)
      setProposalDescriptions(descriptionsMap)

      // Save to Firestore (without description)
      try {
        const urlToUse = sanitizedUrl || sanitizedUrlValue
        await saveProposalsToFirestore(urlToUse, proposals, gardensUrl, parsedUrl)
        console.log('Proposals saved to Firestore')
        setLastRefreshedAt(new Date())
      } catch (firestoreError) {
        console.error('Failed to save to Firestore:', firestoreError)
        // Continue anyway - show proposals even if Firestore save fails
        setError('Proposals loaded but failed to save to Firestore. Please try again.')
      }

      setProposals(proposals)
    } else {
      setError('No executed proposals found or query failed')
    }

    setIsExtracting(false)
  }

  // Refresh: Query subgraph and add only new proposals to Firestore
  const handleRefresh = async () => {
    if (!parsedUrl) {
      setError('No Gardens URL parsed. Please query first.')
      return
    }

    setIsRefreshing(true)
    setError(null)

    try {
      if (!parsedUrl) {
        setError('No parsed URL available. Please parse URL first.')
        setIsRefreshing(false)
        return
      }
      const sanitizedUrlValue = sanitizeUrlForFirestore(parsedUrl)
      setSanitizedUrl(sanitizedUrlValue)
      
      // Get existing proposal IDs from Firestore
      const firestoreCheck = await checkFirestoreForPool(sanitizedUrlValue)
      if (!firestoreCheck.exists || !firestoreCheck.data) {
        setError('No existing data found. Please use "Generate Table" first.')
        setIsRefreshing(false)
        return
      }

      const existingProposalIds = new Set((firestoreCheck.data.proposals || []).map((p: any) => p.id))

      // Query subgraph
      const subgraphId = 'FmcVWeR9xdJyjM53DPuCvEdH24fSXARdq4K5K8EZRZVp'
      const apiKey = process.env.NEXT_PUBLIC_SUBGRAPH_KEY || ''
      
      if (!apiKey) {
        setError('API key not found. Please add NEXT_PUBLIC_SUBGRAPH_KEY to .env.local')
        setIsRefreshing(false)
        return
      }

      const subgraphUrl = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
      const test4Query = `{ cvproposals(where: { strategy_: { poolId: "${parsedUrl.poolId}" }, proposalStatus: 4 }) { id proposalNumber proposalStatus requestedAmount createdAt metadataHash metadata { title description } strategy { id poolId token } } }`
      
      const result4 = await testGraphQLQuery(subgraphUrl, test4Query, 'refresh')
      
      // Store JSON data for display (similar to testResults.test4)
      setTestResults(prev => ({ ...prev, refresh: result4 }))
      
      if (!result4.success || !result4.data?.data?.cvproposals) {
        setError('Failed to query subgraph for refresh')
        setIsRefreshing(false)
        return
      }

      const proposalsData = result4.data.data.cvproposals
      const tokenAddress = proposalsData[0]?.strategy?.token

      // Get token symbol
      let tokenSymbol: string | undefined = undefined
      if (tokenAddress && parsedUrl) {
        tokenSymbol = await fetchTokenSymbolFromCoinGecko(tokenAddress, parsedUrl.chainId)
        if (!tokenSymbol) {
          try {
            const tokenQuery = `{ tokens(where: { id: "${tokenAddress}" }, first: 1) { id symbol name decimals } }`
            const tokenResult = await testGraphQLQuery(subgraphUrl, tokenQuery, 'token')
            if (tokenResult.success && tokenResult.data?.data?.tokens && tokenResult.data.data.tokens.length > 0) {
              tokenSymbol = tokenResult.data.data.tokens[0].symbol
            }
          } catch (err) {
            console.log('Could not fetch token info from subgraph')
          }
        }
      }

      // Filter to only new proposals
      const newProposalsData = proposalsData.filter((p: any) => !existingProposalIds.has(p.id))
      
      if (newProposalsData.length === 0) {
        setError('No new proposals found')
        setIsRefreshing(false)
        return
      }

      // Transform new proposals
      const descriptionsMap: Record<string, string> = {}
      const newProposals: GardensProposal[] = newProposalsData.map((p: any) => {
        const proposalStatus = typeof p.proposalStatus === 'string' 
          ? parseInt(p.proposalStatus) 
          : p.proposalStatus
        
        let executionStatus = 'failed'
        if (proposalStatus === 4) {
          executionStatus = 'executed'
        } else if (proposalStatus === 0) {
          executionStatus = 'pending'
        }

        if (p.metadata?.description) {
          descriptionsMap[p.id] = p.metadata.description
        }

        return {
          id: p.id,
          proposalNumber: parseInt(p.proposalNumber) || 0,
          title: p.metadata?.title || undefined,
          description: p.metadata?.description || undefined,
          requestedAmount: p.requestedAmount || '0',
          tokenSymbol: tokenSymbol,
          tokenAddress: p.strategy?.token,
          executionStatus: executionStatus,
          createdAt: p.createdAt ? new Date(parseInt(p.createdAt) * 1000).toISOString() : '',
          metadataHash: p.metadataHash || undefined,
          status: 'success' as const
        }
      })

      // Merge new proposals with existing ones in Firestore
      // Preserve existing proposals' AI fields (summary, github, karmaProfile)
      const existingProposals = firestoreCheck.data.proposals || []
      const existingProposalsMap = new Map(existingProposals.map((p: any) => [p.id, p]))
      
      // Get the pool URL from Firestore to construct proposal URLs
      const poolUrl = firestoreCheck.data.url || ''
      
      const newProposalsForFirestore = newProposals.map(p => ({
        id: p.id,
        proposalNumber: p.proposalNumber,
        proposalStatus: p.executionStatus === 'executed' ? '4' : p.executionStatus,
        requestedAmount: p.requestedAmount,
        createdAt: p.createdAt,
        title: p.title || null,
        tokenAddress: p.tokenAddress || null,
        tokenSymbol: p.tokenSymbol || null,
        metadataHash: p.metadataHash || null,
        proposalUrl: poolUrl ? `${poolUrl}/${p.id}` : null,
        // New proposals start with empty AI fields
        summary: null,
        github: null,
        karmaProfile: null,
        aiFilledAt: null,
        aiFilledBy: null
      }))

      // Combine: existing proposals (with their AI fields preserved) + new proposals
      const allProposals = [...existingProposals, ...newProposalsForFirestore]
      
      // Update Firestore with merged proposals (sanitizedUrlValue is already set above)
      const docPath = getGardensPoolDocPath(sanitizedUrlValue)
      const docRef = doc(db, docPath)
      
      // Preserve boxPreview settings
      const existingBoxPreview = firestoreCheck.data.boxPreview || {
        backgroundColor: '#adaba9',
        cardColorType: 'solid',
        cardColor: '#c9fdc9',
        cardGradientColor: '#a8e6a8',
        cardBorderColor: '#006400',
        cardBorderSize: 3,
        spaceBetweenCards: 8,
        spaceBetweenColumns: 1,
        fontSize: 10,
        columnWidths: { title: 25, summary: 40, amount: 20, links: 15 },
        linksColor: '#0066cc',
        sortBy: 'amount-desc'
      }

      await setDoc(docRef, {
        url: gardensUrl,
        chainId: parsedUrl.chainId,
        poolId: parsedUrl.poolId.toString(),
        createdAt: firestoreCheck.data.createdAt || serverTimestamp(),
        lastRefreshedAt: serverTimestamp(),
        proposals: allProposals,
        boxPreview: existingBoxPreview
      }, { merge: false }) // Use merge: false to replace entire document with updated proposals array

      // Update component state
      setProposalDescriptions(prev => ({ ...prev, ...descriptionsMap }))
      setProposals(prev => [...prev, ...newProposals])
      setLastRefreshedAt(new Date())

      console.log(`Added ${newProposals.length} new proposals to Firestore`)
    } catch (error) {
      console.error('Error refreshing proposals:', error)
      setError(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    setIsRefreshing(false)
  }

  // Calculate days ago from lastRefreshedAt
  const getDaysAgo = (): number | null => {
    if (!lastRefreshedAt) return null
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - lastRefreshedAt.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Get color class for days ago message
  const getDaysAgoColor = (days: number): string => {
    if (days <= 10) return 'text-green-600'
    if (days <= 20) return 'text-orange-600'
    return 'text-red-600'
  }

  // Format amount from wei to readable format with comma separators, no decimals
  const formatAmount = (amount: string): string => {
    try {
      const amountBigInt = BigInt(amount)
      const divisor = BigInt('1000000000000000000') // 10^18
      const wholePart = amountBigInt / divisor
      
      // Format with comma separators for thousands
      return wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    } catch {
      return amount
    }
  }

  // Format date to "Dec-2025" format
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const year = date.getFullYear()
      return `${month}-${year}`
    } catch {
      return dateString
    }
  }

  // Fetch all proposals' descriptions from subgraph
  const fetchAllProposalDescriptions = async (): Promise<Record<string, string>> => {
    if (!parsedUrl) {
      throw new Error('No Gardens URL parsed')
    }

    const subgraphId = 'FmcVWeR9xdJyjM53DPuCvEdH24fSXARdq4K5K8EZRZVp'
    const apiKey = process.env.NEXT_PUBLIC_SUBGRAPH_KEY || ''
    
    if (!apiKey) {
      throw new Error('API key not found')
    }

    const subgraphUrl = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`
    const query = `{ cvproposals(where: { strategy_: { poolId: "${parsedUrl.poolId}" }, proposalStatus: 4 }) { id metadata { description } } }`
    
    const result = await testGraphQLQuery(subgraphUrl, query, 'fetchDescriptions')
    
    if (!result.success || !result.data?.data?.cvproposals) {
      throw new Error('Failed to fetch descriptions from subgraph')
    }

    const descriptionsMap: Record<string, string> = {}
    result.data.data.cvproposals.forEach((p: any) => {
      if (p.metadata?.description) {
        descriptionsMap[p.id] = p.metadata.description
      }
    })

    return descriptionsMap
  }

  // Check if proposal has AI-generated data
  const hasAiData = (proposal: GardensProposal): boolean => {
    return !!(proposal.summary || proposal.github || proposal.karmaProfile)
  }

  // Handle AI Fill button click
  const handleAiFill = async (proposal: GardensProposal, skipConfirmation: boolean = false) => {
    // Check if proposal already has AI data and show confirmation modal
    if (!skipConfirmation && hasAiData(proposal)) {
      setConfirmModal({ show: true, proposal })
      return
    }

    setProcessingProposalId(proposal.id)
    setError(null)

    try {
      // STEP 1: Check if description is available
      let description = proposal.description || proposalDescriptions[proposal.id]

      if (!description) {
        // Description not available - check if we're already fetching descriptions
        if (isFetchingDescriptions) {
          setError('Descriptions are being fetched. Please wait...')
          setProcessingProposalId(null)
          return
        }

        // Fetch ALL descriptions from subgraph (only once)
        setIsFetchingDescriptions(true)
        setError('Querying the subgraph for descriptions...')
        
        try {
          const descriptionsMap = await fetchAllProposalDescriptions()
          
          // Store ALL descriptions locally for future use
          setProposalDescriptions(prev => ({ ...prev, ...descriptionsMap }))
          
          // Update proposals state with descriptions so they're available immediately
          setProposals(prev => prev.map(p => ({
            ...p,
            description: descriptionsMap[p.id] || p.description
          })))

          // Get description for this proposal
          description = descriptionsMap[proposal.id]
          
          if (!description) {
            setError('Description not found for this proposal. Please try again.')
            setIsFetchingDescriptions(false)
            setProcessingProposalId(null)
            return
          }

          // Clear error - descriptions are now loaded and stored locally
          setError(null)
          setIsFetchingDescriptions(false)
          console.log(`Fetched and stored ${Object.keys(descriptionsMap).length} proposal descriptions locally`)
          // Continue to AI call below (don't return)
        } catch (fetchError) {
          setError(`Failed to fetch descriptions: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
          setIsFetchingDescriptions(false)
          setProcessingProposalId(null)
          return
        }
      } else {
        // Description is available locally - no need to fetch
        console.log(`Using locally stored description for proposal ${proposal.id}`)
      }

      // STEP 2: Description is available - proceed with AI call
      // Convert focus string to array
      const focusArray = aiSummaryFocus
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      // Build JSON payload from form state
      const payload = {
        model: aiModel,
        temperature: aiTemperature,
        reasoning: {
          effort: aiReasoningEffort
        },
        task: aiTask,
        instructions: {
          summary: {
            required: aiSummaryRequired,
            description: aiSummaryDescription,
            prefix: aiSummaryPrefix,
            wordCount: {
              min: aiWordCountMin,
              max: aiWordCountMax
            },
            focus: focusArray
          },
          github: {
            required: aiGithubRequired,
            description: aiGithubDescription
          },
          karmaProfile: {
            required: aiKarmaRequired,
            description: aiKarmaDescription
          }
        },
        outputFormat: aiOutputFormat,
        outputDestination: {
          type: aiOutputDestination
        },
        input: {
          description: description
        }
      }

      // Call Firebase callable function
      const genericAiAgentCallable = httpsCallable<any, any>(functions, 'genericAiAgent')
      const result = await genericAiAgentCallable(payload)

      // Extract response data
      const responseData = result.data as {
        success?: boolean
        message?: string
        result?: {
          summary?: string
          github?: string | null
          karmaProfile?: string | null
        }
      }

      const aiFields = {
        summary: responseData?.result?.summary || responseData?.message || 'No response received',
        github: responseData?.result?.github || null,
        karmaProfile: responseData?.result?.karmaProfile || null
      }

      // Update the specific proposal in table state
      setProposals(prev => prev.map(p => {
        if (p.id === proposal.id) {
          return {
            ...p,
            summary: aiFields.summary,
            github: aiFields.github,
            karmaProfile: aiFields.karmaProfile
          }
        }
        return p
      }))

      // Save to Firestore
      if (parsedUrl && sanitizedUrl) {
        try {
          console.log('Saving AI fields to Firestore:', { sanitizedUrl, proposalId: proposal.id, aiFields })
          await updateProposalAiFieldsInFirestore(sanitizedUrl, proposal.id, aiFields)
          console.log('AI fields saved to Firestore successfully')
        } catch (firestoreError) {
          console.error('Failed to save AI fields to Firestore:', firestoreError)
          // Show error to user so they know Firestore sync failed
          setError(`AI fields updated in table but failed to save to Firestore: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`)
        }
      } else {
        console.warn('Cannot save to Firestore: parsedUrl is null')
        setError('Cannot save to Firestore: No Gardens URL parsed')
      }
    } catch (err) {
      console.error('Error calling AI agent:', err)
      setError(err instanceof Error ? err.message : 'Failed to call AI agent')
    } finally {
      setProcessingProposalId(null)
    }
  }

  // Handle confirmation modal proceed
  const handleConfirmProceed = () => {
    if (confirmModal.proposal) {
      setConfirmModal({ show: false, proposal: null })
      handleAiFill(confirmModal.proposal, true) // Skip confirmation on retry
    }
  }

  // Handle confirmation modal cancel
  const handleConfirmCancel = () => {
    setConfirmModal({ show: false, proposal: null })
  }

  // Save box preview settings to Firestore
  const saveBoxPreviewSettings = async (updates: Partial<{
    backgroundColor: string
    cardColorType: 'solid' | 'gradient'
    cardColor: string
    cardGradientColor: string
    cardBorderColor: string
    cardBorderSize: number
    spaceBetweenCards: number
    spaceBetweenColumns: number
    fontSize: number
    columnWidths: { title: number; summary: number; amount: number; links: number }
    linksColor: string
    sortBy: 'amount-desc' | 'number-asc' | 'title-asc'
  }>) => {
    if (!parsedUrl) {
      console.warn('Cannot save box preview settings: parsedUrl is null')
      return
    }

    try {
      if (!sanitizedUrl) {
        console.warn('Cannot save box preview settings: sanitizedUrl is null')
        return
      }
      const docPath = getGardensPoolDocPath(sanitizedUrl)
      const docRef = doc(db, docPath)
      
      // Get current boxPreview settings to merge
      const docSnap = await getDoc(docRef)
      const currentBoxPreview = docSnap.exists() ? docSnap.data()?.boxPreview || {} : {}
      
      await setDoc(docRef, {
        boxPreview: {
          ...currentBoxPreview,
          ...updates
        }
      }, { merge: true })
      
      console.log('Box preview settings saved to Firestore')
    } catch (error) {
      console.error('Error saving box preview settings:', error)
    }
  }

  // Handle background color change
  const handleBackgroundColorChange = async (color: string) => {
    setBoxPreviewBackgroundColor(color)
    await saveBoxPreviewSettings({ backgroundColor: color })
  }

  // Handle card color type change
  const handleCardColorTypeChange = async (type: 'solid' | 'gradient') => {
    setBoxPreviewCardColorType(type)
    await saveBoxPreviewSettings({ cardColorType: type })
  }

  // Handle card color change
  const handleCardColorChange = async (color: string) => {
    setBoxPreviewCardColor(color)
    await saveBoxPreviewSettings({ cardColor: color })
  }

  // Handle card gradient color change
  const handleCardGradientColorChange = async (color: string) => {
    setBoxPreviewCardGradientColor(color)
    await saveBoxPreviewSettings({ cardGradientColor: color })
  }

  // Handle card border color change
  const handleCardBorderColorChange = async (color: string) => {
    setBoxPreviewCardBorderColor(color)
    await saveBoxPreviewSettings({ cardBorderColor: color })
  }

  // Handle card border size change
  const handleCardBorderSizeChange = async (value: number) => {
    setBoxPreviewCardBorderSize(value)
    await saveBoxPreviewSettings({ cardBorderSize: value })
  }

  // Handle space between cards change
  const handleSpaceBetweenCardsChange = async (value: number) => {
    setBoxPreviewSpaceBetweenCards(value)
    await saveBoxPreviewSettings({ spaceBetweenCards: value })
  }

  // Handle space between columns change
  const handleSpaceBetweenColumnsChange = async (value: number) => {
    setBoxPreviewSpaceBetweenColumns(value)
    await saveBoxPreviewSettings({ spaceBetweenColumns: value })
  }

  // Handle font size change
  const handleFontSizeChange = async (value: number) => {
    setBoxPreviewFontSize(value)
    await saveBoxPreviewSettings({ fontSize: value })
  }

  // Handle links color change
  const handleLinksColorChange = async (color: string) => {
    setBoxPreviewLinksColor(color)
    await saveBoxPreviewSettings({ linksColor: color })
  }

  // Handle column width change (on drag end)
  const handleColumnWidthsChange = async (widths: { title: number; summary: number; amount: number; links: number }) => {
    setBoxPreviewColumnWidths(widths)
    await saveBoxPreviewSettings({ columnWidths: widths })
  }

  // Handle reset columns - set all to equal width (25% each)
  const handleResetColumns = async () => {
    const equalWidths = { title: 25, summary: 25, amount: 25, links: 25 }
    setBoxPreviewColumnWidths(equalWidths)
    await saveBoxPreviewSettings({ columnWidths: equalWidths })
  }

  // Handle Save PNG Click
  const handleSavePngClick = async () => {
    if (!projectId || !childId || !boxPreviewRef) {
      alert('Please ensure box preview is rendered and project ID/child ID are set')
      return
    }

    if (!sanitizedUrl) {
      alert('No gardens pool URL loaded. Please generate the table first.')
      return
    }

    // Use sanitizedUrl as the filename (same as gardens-pool document name)
    const filename = sanitizedUrl

    // Check for existing files first
    try {
      const folderPath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/gardens-reports`
      const folderRef = ref(storage, folderPath)
      const listing = await listAll(folderRef)
      
      const files = listing.items
        .filter(item => item.name.endsWith('.png'))
        .map(item => ({
          name: item.name,
          fullPath: item.fullPath
        }))
        .sort((a, b) => b.name.localeCompare(a.name))
      
      setExistingPngFiles(files)
      
      // Check if this exact filename exists
      const fileExists = files.some(f => {
        const baseName = f.name.replace(/@\dx\.png$/, '').replace('.png', '')
        return baseName === filename
      })
      
      // Warn if file exists
      if (fileExists) {
        const proceed = window.confirm(
          `Warning: A PNG file with the name "${filename}" already exists.\n\n` +
          `This will overwrite the existing file. Continue?`
        )
        if (!proceed) {
          return
        }
      }
    } catch (error) {
      console.error('Error loading PNG files:', error)
      setExistingPngFiles([])
    }

    // Automatically save with the sanitizedUrl filename (no modal needed)
    setPngFilename(filename)
    await handleSavePngConfirm(filename)
  }

  // Handle Save PNG Confirm
  const handleSavePngConfirm = async (providedFilename?: string) => {
    const filenameToUse = providedFilename || pngFilename.trim()
    
    if (!projectId || !childId || !filenameToUse || !boxPreviewRef) {
      alert('Please ensure filename is set and box preview is rendered')
      return
    }

    setSavingPng(true)
    try {
      const baseFilename = filenameToUse.endsWith('.png') 
        ? filenameToUse.replace('.png', '') 
        : filenameToUse

      // Temporarily remove background color for transparent export
      const originalBg = boxPreviewRef.style.backgroundColor
      boxPreviewRef.style.setProperty('background-color', 'transparent', 'important')

      try {
        // Generate PNGs at 1x, 2x, and 3x resolutions
        const scales = [1, 2, 3]
        const uploadPromises = scales.map(async (scale) => {
          const dataUrl = await toPng(boxPreviewRef, {
            pixelRatio: scale,
          })

          // Convert data URL to blob
          const response = await fetch(dataUrl)
          const blob = await response.blob()

          const filename = scale === 1 
            ? `${baseFilename}.png`
            : `${baseFilename}@${scale}x.png`
          
          const storagePath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/gardens-reports/${filename}`
          const storageRef = ref(storage, storagePath)
          
          await uploadBytes(storageRef, blob, {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000',
          })

          return filename
        })

        const savedFiles = await Promise.all(uploadPromises)
        alert(`✅ PNG saved successfully:\n${savedFiles.join('\n')}`)
        setShowSavePngModal(false)
        setPngFilename('')
        setSavedPngFilename(baseFilename) // Store filename for "Add to Canvas" button
        
        // If called directly (not from modal), don't show modal
        if (providedFilename) {
          return
        }
      } finally {
        // Restore original background
        if (originalBg) {
          boxPreviewRef.style.backgroundColor = originalBg
        } else {
          boxPreviewRef.style.backgroundColor = ''
        }
      }
    } catch (error) {
      console.error('Error saving PNG:', error)
      alert(`❌ Error saving PNG: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSavingPng(false)
    }
  }

  // Check for existing report and load its values
  const checkExistingReport = async (): Promise<{ id: string; width: number; y: number; alignment: 'left' | 'center' | 'right' } | null> => {
    if (!projectId || !childId) return null

    setLoadingExistingReport(true)
    try {
      const overlayCollectionPath = `${firestorePath}/overlay`
      const overlayCollectionRef = collection(db, overlayCollectionPath)
      // Get ALL overlay boxes (not just images) to check by ID prefix
      const allBoxesSnapshot = await getDocs(overlayCollectionRef)
      
      let existingReport: { id: string; width: number; y: number; alignment: 'left' | 'center' | 'right' } | null = null
      allBoxesSnapshot.forEach((docSnap) => {
        const boxId = docSnap.id
        const data = docSnap.data() as any
        
        // Check if it's a gardens report by ID prefix (most reliable)
        const isGardensReportById = boxId.startsWith('gardens-report_') || boxId.startsWith('gardens-report-')
        // Also check by imageSrc path as fallback
        const isGardensReportBySrc = data.contentType === 'image' && data.imageSrc && data.imageSrc.includes('/gardens-reports/')
        
        if (isGardensReportById || isGardensReportBySrc) {
          // Make sure it's not an overlay box
          if (boxId.includes('_overlay_')) {
            return // Skip overlay boxes
          }
          
          const canvasWidth = 1100
          const currentWidth = data.w || canvasWidth * 0.9
          const widthPercent = Math.round((currentWidth / canvasWidth) * 100)
          
          // Determine alignment based on x position
          const currentX = data.x || 0
          const centerX = (canvasWidth - currentWidth) / 2
          const leftX = 0
          const rightX = canvasWidth - currentWidth
          
          let alignment: 'left' | 'center' | 'right' = 'center'
          if (Math.abs(currentX - centerX) < 5) {
            alignment = 'center'
          } else if (Math.abs(currentX - leftX) < 5) {
            alignment = 'left'
          } else if (Math.abs(currentX - rightX) < 5) {
            alignment = 'right'
          }
          
          existingReport = {
            id: boxId,
            width: Math.max(50, Math.min(90, widthPercent)),
            y: data.y || 0,
            alignment
          }
        }
      })
      
      return existingReport
    } catch (error) {
      console.error('Error checking existing report:', error)
      return null
    } finally {
      setLoadingExistingReport(false)
    }
  }

  // Handle opening Send to Canvas modal
  const handleSendToCanvasClick = async () => {
    if (!projectId || !childId || !boxPreviewRef) {
      alert('Please ensure project ID/child ID are set')
      return
    }

    if (!sanitizedUrl) {
      alert('No gardens pool URL loaded. Please generate the table first.')
      return
    }

    // Check for existing report and load values
    const existing = await checkExistingReport()
    if (existing !== null) {
      setSendToCanvasWidth(existing.width)
      setSendToCanvasY(existing.y)
      setSendToCanvasAlignment(existing.alignment)
    } else {
      // Default values for new report
      setSendToCanvasWidth(90)
      setSendToCanvasY(0)
      setSendToCanvasAlignment('center')
    }
    
    setShowSendToCanvasModal(true)
  }

  // Handle Add to Canvas (extracted logic with parameters)
  const handleAddToCanvas = async (widthPercent: number, yPosition: number, alignment: 'left' | 'center' | 'right') => {
    if (!projectId || !childId || !boxPreviewRef) {
      alert('Please ensure project ID/child ID are set')
      return
    }

    if (!sanitizedUrl) {
      alert('No gardens pool URL loaded. Please generate the table first.')
      return
    }

    // Use sanitizedUrl as the filename (same as gardens-pool document name)
    const pngFilenameToUse = sanitizedUrl

    // Verify the PNG file exists
    try {
      const png1xPath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/gardens-reports/${pngFilenameToUse}.png`
      const png1xRef = ref(storage, png1xPath)
      await getDownloadURL(png1xRef) // This will throw if file doesn't exist
    } catch (error) {
      alert(`PNG file "${pngFilenameToUse}.png" not found. Please save a PNG first using "Save as PNG" button.`)
      return
    }

    setAddingToCanvas(true)
    try {
      // Get the 1x PNG URL to calculate dimensions
      const png1xPath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/gardens-reports/${pngFilenameToUse}.png`
      const png1xRef = ref(storage, png1xPath)
      const png1xUrl = await getDownloadURL(png1xRef)

      // Load image to get dimensions
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = png1xUrl
      })

      // Calculate dimensions using provided parameters
      const canvasWidth = 1100
      const boxWidth = Math.round((widthPercent / 100) * canvasWidth)
      
      // Calculate x position based on alignment
      let boxX = 0
      if (alignment === 'center') {
        boxX = Math.round((canvasWidth - boxWidth) / 2)
      } else if (alignment === 'right') {
        boxX = Math.round(canvasWidth - boxWidth)
      } else {
        boxX = 0 // left
      }
      
      const aspectRatio = img.height / img.width
      const boxHeight = Math.round(boxWidth * aspectRatio) // Height based on width

      // Build Firestore paths
      const overlayCollectionPath = `${firestorePath}/overlay`
      const overlayCollectionRef = collection(db, overlayCollectionPath)

      // Check for existing gardens report box (check ALL boxes, not just images)
      // This ensures we find it even if detection method changes
      const allBoxesSnapshot = await getDocs(overlayCollectionRef)
      
      let existingReportId: string | null = null
      allBoxesSnapshot.forEach((docSnap) => {
        const boxId = docSnap.id
        const data = docSnap.data() as any
        
        // Check by ID prefix first (most reliable)
        const isGardensReportById = boxId.startsWith('gardens-report_') || boxId.startsWith('gardens-report-')
        // Also check by imageSrc path as fallback
        const isGardensReportBySrc = data.contentType === 'image' && data.imageSrc && data.imageSrc.includes('/gardens-reports/')
        
        // Make sure it's not an overlay box
        if ((isGardensReportById || isGardensReportBySrc) && !boxId.includes('_overlay_')) {
          existingReportId = boxId
        }
      })
      
      // If we found an existing report, delete it and all its overlays first
      if (existingReportId) {
        // Get all overlay boxes for this report
        const overlayBoxesToDelete = allBoxesSnapshot.docs.filter((docSnap) => {
          const overlayId = docSnap.id
          return overlayId.startsWith(`${existingReportId}_overlay_`)
        })
        
        // Delete all overlay boxes
        const deletePromises = overlayBoxesToDelete.map(async (docSnap) => {
          const overlayRef = doc(db, overlayCollectionPath, docSnap.id)
          await deleteDoc(overlayRef)
        })
        
        // Also delete the main PNG box
        const mainBoxRef = doc(db, overlayCollectionPath, existingReportId)
        await deleteDoc(mainBoxRef)
        
        // Wait for all deletions to complete
        await Promise.all(deletePromises)
        
        // Remove from layers
        const canvasRef = doc(db, firestorePath)
        const canvasSnap = await getDoc(canvasRef)
        if (canvasSnap.exists()) {
          const currentLayers = canvasSnap.data().layers || []
          const layersToRemove = [existingReportId, ...overlayBoxesToDelete.map(d => d.id)]
          const newLayers = currentLayers.filter((id: string) => !layersToRemove.includes(id))
          const newZIndexMap: Record<string, number> = {}
          newLayers.forEach((id: string, idx: number) => {
            newZIndexMap[id] = idx
          })
          await setDoc(canvasRef, { layers: newLayers, zIndexMap: newZIndexMap }, { merge: true })
        }
      }

      // Generate URLs for srcset (1x, 2x, 3x)
      const baseStoragePath = `interoperable-canvas/assets/${projectId}/child-canvases/${childId}/gardens-reports`
      const png2xRef = ref(storage, `${baseStoragePath}/${pngFilenameToUse}@2x.png`)
      const png3xRef = ref(storage, `${baseStoragePath}/${pngFilenameToUse}@3x.png`)
      
      const [png2xUrl, png3xUrl] = await Promise.all([
        getDownloadURL(png2xRef).catch(() => null), // Fallback if @2x doesn't exist
        getDownloadURL(png3xRef).catch(() => null), // Fallback if @3x doesn't exist
      ])

      // Build srcset string
      const srcsetParts: string[] = []
      srcsetParts.push(`${png1xUrl} 1x`)
      if (png2xUrl) srcsetParts.push(`${png2xUrl} 2x`)
      if (png3xUrl) srcsetParts.push(`${png3xUrl} 3x`)
      const srcset = srcsetParts.join(', ')

      // Generate box ID and name
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

      // Always create a new box ID (we've already deleted the old one if it existed)
      const boxId = `gardens-report_${toTimestampSuffix()}`
      const boxName = 'Gardens Report'
      const boxNameKey = `${boxName}_${toTimestampSuffix()}`

      // Get container bounds for percentage calculations
      const containerRect = boxPreviewRef.getBoundingClientRect()
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height

      // Find all overlay elements (link subcells)
      const overlayElements = boxPreviewRef.querySelectorAll('[data-overlay-type][data-overlay-url]')
      const overlayBoxes: Array<{
        proposalId: string
        linkType: 'proposal' | 'github' | 'karma'
        url: string
        x: number
        y: number
        w: number
        h: number
      }> = []

      overlayElements.forEach((element) => {
        const url = element.getAttribute('data-overlay-url')
        if (!url || url === '') return // Skip if no URL

        const linkType = element.getAttribute('data-overlay-type') as 'proposal' | 'github' | 'karma'
        const proposalId = element.getAttribute('data-proposal-id') || ''
        
        const rect = element.getBoundingClientRect()
        
        // Calculate position relative to container (as percentages)
        const xPercent = ((rect.left - containerRect.left) / containerWidth) * 100
        const yPercent = ((rect.top - containerRect.top) / containerHeight) * 100
        const wPercent = (rect.width / containerWidth) * 100
        const hPercent = (rect.height / containerHeight) * 100

        // Convert percentages to canvas coordinates (relative to PNG box)
        // X position: percentage of box width + box X offset
        const overlayX = Math.round((xPercent / 100) * boxWidth) + boxX
        // Y position: percentage of box height + box Y offset (yPosition from modal)
        const overlayY = Math.round((yPercent / 100) * boxHeight) + yPosition
        // Width and height: percentage of box dimensions
        const overlayW = Math.round((wPercent / 100) * boxWidth)
        const overlayH = Math.round((hPercent / 100) * boxHeight)

        overlayBoxes.push({
          proposalId,
          linkType,
          url,
          x: overlayX,
          y: overlayY,
          w: overlayW,
          h: overlayH,
        })
      })

      // Create or update the PNG box document
      const boxRef = doc(db, overlayCollectionPath, boxId)
      await setDoc(boxRef, {
        id: boxId,
        x: boxX,
        y: yPosition,
        w: boxWidth,
        h: boxHeight,
        contentType: 'image',
        imageSrc: png1xUrl, // Fallback for browsers that don't support srcset
        imageSrcset: srcset, // Responsive images
        imageBehavior: 'contain', // Auto-fill width, height can overflow
        name: boxName,
        nameKey: boxNameKey,
      }, { merge: true })

      // Create overlay boxes for each link
      const overlayBoxPromises = overlayBoxes.map(async (overlay, index) => {
        const overlayBoxId = `${boxId}_overlay_${overlay.proposalId}_${overlay.linkType}_${index}`
        const overlayBoxRef = doc(db, overlayCollectionPath, overlayBoxId)
        
        await setDoc(overlayBoxRef, {
          id: overlayBoxId,
          x: overlay.x,
          y: overlay.y,
          w: overlay.w,
          h: overlay.h,
          contentType: 'link',
          url: overlay.url,
          clickable: true, // Required for presentation mode clickability
          openIn: 'new-tab', // Open links in new tab
          linkType: overlay.linkType,
          proposalId: overlay.proposalId,
          name: `${overlay.linkType.charAt(0).toUpperCase() + overlay.linkType.slice(1)} Link`,
          // Make overlay invisible (transparent background)
          background: {
            mode: 'none'
          },
        }, { merge: true })

        return overlayBoxId
      })

      const overlayBoxIds = await Promise.all(overlayBoxPromises)

      // Handle layers: if new boxes, add to layers array; if replacing, layers already exist
      if (!existingReportId) {
        // Get current canvas document to update layers
        const canvasRef = doc(db, firestorePath)
        const canvasSnap = await getDoc(canvasRef)
        const currentLayers = canvasSnap.exists() ? (canvasSnap.data().layers || []) : ['background']
        const currentZIndexMap = canvasSnap.exists() ? (canvasSnap.data().zIndexMap || {}) : { background: 0 }

        // Ensure background is first, then add PNG box, then overlay boxes (with higher z-index)
        const layersWithoutNewBoxes = currentLayers.filter((id: string) => 
          id !== 'background' && id !== boxId && !overlayBoxIds.includes(id)
        )
        const newLayers = ['background', ...layersWithoutNewBoxes, boxId, ...overlayBoxIds]
        const newZIndexMap: Record<string, number> = {}
        newLayers.forEach((id: string, idx: number) => {
          newZIndexMap[id] = idx
        })

        await setDoc(canvasRef, {
          layers: newLayers,
          zIndexMap: newZIndexMap,
        }, { merge: true })
      } else {
        // If replacing, remove old overlay boxes and add new ones
        const canvasRef = doc(db, firestorePath)
        const canvasSnap = await getDoc(canvasRef)
        const currentLayers = canvasSnap.exists() ? (canvasSnap.data().layers || []) : ['background']
        const currentZIndexMap = canvasSnap.exists() ? (canvasSnap.data().zIndexMap || {}) : { background: 0 }

        // Remove old overlay boxes (those starting with boxId + '_overlay_')
        const oldOverlayBoxIds = currentLayers.filter((id: string) => 
          id.startsWith(`${boxId}_overlay_`)
        )
        
        const layersWithoutOldOverlays = currentLayers.filter((id: string) => 
          !oldOverlayBoxIds.includes(id)
        )
        
        const newLayers = [...layersWithoutOldOverlays, ...overlayBoxIds]
        const newZIndexMap: Record<string, number> = {}
        newLayers.forEach((id: string, idx: number) => {
          newZIndexMap[id] = idx
        })

        await setDoc(canvasRef, {
          layers: newLayers,
          zIndexMap: newZIndexMap,
        }, { merge: true })
      }

      setShowSendToCanvasModal(false)
      alert(`✅ Gardens report added to canvas successfully! ${overlayBoxes.length} clickable links created.`)
    } catch (error) {
      console.error('Error adding to canvas:', error)
      alert(`❌ Error adding to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setAddingToCanvas(false)
    }
  }

  // Handle column resize drag
  const handleColumnResizeStart = (column: 'title' | 'summary' | 'amount' | 'links', e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingColumn(column)
    const startX = e.clientX
    const startWidths: { title: number; summary: number; amount: number; links: number } = { ...boxPreviewColumnWidths }
    const containerWidth = 1000 // Fixed container width
    let currentWidths: { title: number; summary: number; amount: number; links: number } = { ...startWidths }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaPercent = (deltaX / containerWidth) * 100

      let newWidths = { ...currentWidths }
      
      if (column === 'title') {
        newWidths.title = Math.max(10, Math.min(70, startWidths.title + deltaPercent))
        const remaining = 100 - newWidths.title
        const otherTotal = startWidths.summary + startWidths.amount + startWidths.links
        if (otherTotal > 0) {
          newWidths.summary = (startWidths.summary / otherTotal) * remaining
          newWidths.amount = (startWidths.amount / otherTotal) * remaining
          newWidths.links = (startWidths.links / otherTotal) * remaining
        }
      } else if (column === 'summary') {
        newWidths.summary = Math.max(10, Math.min(70, startWidths.summary + deltaPercent))
        const remaining = 100 - newWidths.summary
        const otherTotal = startWidths.title + startWidths.amount + startWidths.links
        if (otherTotal > 0) {
          newWidths.title = (startWidths.title / otherTotal) * remaining
          newWidths.amount = (startWidths.amount / otherTotal) * remaining
          newWidths.links = (startWidths.links / otherTotal) * remaining
        }
      } else if (column === 'amount') {
        newWidths.amount = Math.max(10, Math.min(70, startWidths.amount + deltaPercent))
        const remaining = 100 - newWidths.amount
        const otherTotal = startWidths.title + startWidths.summary + startWidths.links
        if (otherTotal > 0) {
          newWidths.title = (startWidths.title / otherTotal) * remaining
          newWidths.summary = (startWidths.summary / otherTotal) * remaining
          newWidths.links = (startWidths.links / otherTotal) * remaining
        }
      } else if (column === 'links') {
        newWidths.links = Math.max(5, Math.min(30, startWidths.links + deltaPercent))
        const remaining = 100 - newWidths.links
        const otherTotal = startWidths.title + startWidths.summary + startWidths.amount
        if (otherTotal > 0) {
          newWidths.title = (startWidths.title / otherTotal) * remaining
          newWidths.summary = (startWidths.summary / otherTotal) * remaining
          newWidths.amount = (startWidths.amount / otherTotal) * remaining
        }
      }

      // Ensure all widths sum to 100%
      const total = newWidths.title + newWidths.summary + newWidths.amount + newWidths.links
      if (Math.abs(total - 100) > 0.01) {
        const scale = 100 / total
        newWidths.title *= scale
        newWidths.summary *= scale
        newWidths.amount *= scale
        newWidths.links *= scale
      }

      // Round to 2 decimal places
      newWidths.title = Math.round(newWidths.title * 100) / 100
      newWidths.summary = Math.round(newWidths.summary * 100) / 100
      newWidths.amount = Math.round(newWidths.amount * 100) / 100
      newWidths.links = Math.round(newWidths.links * 100) / 100

      currentWidths = newWidths
      setBoxPreviewColumnWidths(newWidths)
    }

    const handleMouseUp = () => {
      setIsResizingColumn(null)
      // Save final widths to Firestore
      handleColumnWidthsChange(currentWidths)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Confirmation Modal */}
      {confirmModal.show && confirmModal.proposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm AI Fill Replacement
            </h3>
            <p className="text-sm text-gray-700 mb-6">
              This action will replace the current row's AI summary, GitHub link, and Karma profile. Are you sure you want to proceed?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmProceed}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save PNG Modal */}
      {showSavePngModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSavePngModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Save PNG File</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filename (without .png extension):
              </label>
              <input
                type="text"
                value={pngFilename}
                onChange={(e) => setPngFilename(e.target.value)}
                placeholder="gardens-report-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePngConfirm()
                  }
                }}
              />
              <p className="mt-2 text-xs text-gray-500">
                Will save 1x, 2x, and 3x versions for retina displays
              </p>
            </div>

            {existingPngFiles.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Existing PNG files (click to overwrite):</div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  <div className="space-y-1">
                    {existingPngFiles.map((file) => {
                      // Extract base name (remove @2x, @3x suffixes and .png)
                      const baseName = file.name.replace(/@\dx\.png$/, '').replace('.png', '')
                      return (
                        <button
                          key={file.fullPath}
                          onClick={() => setPngFilename(baseName)}
                          className="w-full text-left px-3 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50 hover:border-blue-500 transition-colors"
                        >
                          <div className="font-mono text-gray-900">{file.name}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSavePngModal(false)
                  setPngFilename('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSavePngConfirm()}
                disabled={!pngFilename.trim() || savingPng}
                className={`px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  !pngFilename.trim() || savingPng
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {savingPng ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Gardens Report Generator</h1>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="font-semibold">Firestore Storage Location</span>
            </div>
            <div>
              <span className="font-semibold">Project ID:</span> {projectId}
            </div>
            <div>
              <span className="font-semibold">Child Canvas ID:</span> {childId || '(not set)'}
            </div>
            <div>
              <span className="font-semibold">Child Canvas Aspect Ratio:</span>{' '}
              {loadingAspect ? (
                <span className="ml-2 text-gray-500">Loading...</span>
              ) : aspect ? (
                <span
                  className={`ml-2 font-mono px-2 py-1 rounded font-semibold ${
                    aspect === 'landing-page'
                      ? 'text-green-700 bg-green-100'
                      : 'text-red-700 bg-red-100'
                  }`}
                >
                  {aspect}
                </span>
              ) : (
                <span className="ml-2 text-gray-500">(not set)</span>
              )}
            </div>
            {aspect && aspect !== 'landing-page' && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                ⚠️ Gardens Reports have to be created in landing-page-desktop
              </div>
            )}
            <div className="mt-2 pt-2 border-t">
              <span className="font-semibold">Gardens Report will be stored in:</span>{' '}
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{overlayPath}</code>
            </div>
          </div>
        </div>

        {/* Step 1: URL Input */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Add Gardens Pool URL</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gardens Pool URL
              </label>
              <input
                type="text"
                value={gardensUrl}
                onChange={(e) => {
                  const url = e.target.value
                  setGardensUrl(url)
                  setError(null)
                  
                  // Detect network from URL and parse URL
                  if (url.trim()) {
                    const parsed = parseGardensUrl(url.trim())
                    if (parsed.parsed) {
                      setParsedUrl(parsed.parsed)
                      const networkInfo = getNetworkInfo(parsed.parsed.chainId)
                      const apiKey = process.env.NEXT_PUBLIC_SUBGRAPH_KEY || ''
                      const queryUrl = networkInfo.queryUrl?.replace('{apiKey}', apiKey) || undefined
                      setDetectedNetwork({
                        chainId: parsed.parsed.chainId,
                        name: networkInfo.name,
                        queryUrl: queryUrl
                      })
                    } else {
                      setParsedUrl(null)
                      setDetectedNetwork(null)
                    }
                  } else {
                    setParsedUrl(null)
                    setDetectedNetwork(null)
                  }
                }}
                placeholder="https://app.gardens.fund/gardens/10/0xda10009cbd5d07dd0cecc66161fc93d7c9000da1/0xd95bf6da95c77466674bd1210e77a23492f6eef9/179"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">
                Expected format: https://app.gardens.fund/gardens/{'{chainId}'}/{'{address1}'}/{'{address2}'}/{'{poolId}'}
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleExtractInformation}
                disabled={isExtracting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isExtracting ? 'Querying Subgraph...' : 'Generate Table'}
              </button>
              {process.env.NEXT_PUBLIC_SUBGRAPH_KEY ? (
                <p className="text-xs text-green-600">✓ API Key detected</p>
              ) : (
                <p className="text-xs text-yellow-600">⚠ No API key found. Add NEXT_PUBLIC_SUBGRAPH_KEY to .env.local</p>
              )}
              {detectedNetwork && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-900">
                    <span className="font-medium">Detected network:</span> {detectedNetwork.name}
                  </p>
                  {detectedNetwork.queryUrl ? (
                    <div>
                      <p className="text-xs font-medium text-gray-900 mb-1">Query URL:</p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded border block break-all text-gray-900">
                        {detectedNetwork.queryUrl}
                      </code>
                    </div>
                  ) : (
                    <p className="text-xs text-yellow-600">
                      ⚠ Query URL not configured for this network. We need to get the query URL first.
                    </p>
                  )}
                </div>
              )}
            </div>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
            
            {/* Test Results Display */}
            {testResults.test4 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
                
                {/* Test 4: Filter by PoolId and proposalStatus = 4 */}
                <div className={`p-4 border rounded-md ${testResults.test4.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="font-semibold mb-2 text-gray-900">
                    Filter by PoolId {parsedUrl ? `(Pool ${parsedUrl.poolId})` : ''} and proposalStatus = 4 {testResults.test4.success ? ' ✓' : ' ✗'}
                  </div>
                  <div className="text-sm space-y-2 text-gray-900">
                    <div>
                      <span className="font-medium">Query:</span>
                      <code className="text-xs bg-white px-2 py-1 rounded border ml-2">{testResults.test4.query}</code>
                    </div>
                    {testResults.test4.error && (
                      <div>
                        <span className="font-medium">Error:</span>
                        <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-auto max-h-40 text-gray-900">
                          {testResults.test4.error}
                        </pre>
                      </div>
                    )}
                    {testResults.test4.data && (
                      <div>
                        <span className="font-medium">Response:</span>
                        <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-auto max-h-60 text-gray-900">
                          {JSON.stringify(testResults.test4.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Refresh Results Display */}
            {testResults.refresh && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Refresh Results</h3>
                
                <div className={`p-4 border rounded-md ${testResults.refresh.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="font-semibold mb-2 text-gray-900">
                    Refresh Query {parsedUrl ? `(Pool ${parsedUrl.poolId})` : ''} {testResults.refresh.success ? ' ✓' : ' ✗'}
                  </div>
                  <div className="text-sm space-y-2 text-gray-900">
                    <div>
                      <span className="font-medium">Query:</span>
                      <code className="text-xs bg-white px-2 py-1 rounded border ml-2">{testResults.refresh.query}</code>
                    </div>
                    {testResults.refresh.error && (
                      <div>
                        <span className="font-medium">Error:</span>
                        <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-auto max-h-60 text-gray-900">
                          {testResults.refresh.error}
                        </pre>
                      </div>
                    )}
                    {testResults.refresh.data && (
                      <div>
                        <span className="font-medium">Response:</span>
                        <pre className="mt-1 p-2 bg-white border rounded text-xs overflow-auto max-h-60 text-gray-900">
                          {JSON.stringify(testResults.refresh.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Fill the Rest with AI Section */}
            {proposals.length > 0 && (
              <div className="mt-6 space-y-4">
                <div 
                  onClick={() => setIsAiSectionVisible(!isAiSectionVisible)}
                  className="flex items-center gap-2 cursor-pointer hover:text-gray-700"
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                      isAiSectionVisible ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Fill the Rest with AI (config)</h3>
                </div>
                {isAiSectionVisible && (
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column: Input Form */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h4 className="text-md font-semibold mb-4 text-gray-900">AI Instructions Configuration</h4>
                      <div className="space-y-4">
                      {/* Agent */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
                        <select
                          value={aiAgent}
                          onChange={(e) => setAiAgent(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        >
                          <option value="openai">OpenAI</option>
                        </select>
                      </div>

                      {/* Model */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        <select
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        >
                          <option value="gpt-5-nano">gpt-5-nano</option>
                          <option value="gpt-5.1">gpt-5.1</option>
                          <option value="gpt-4o">gpt-4o</option>
                          <option value="gpt-4-turbo">gpt-4-turbo</option>
                          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        </select>
                      </div>

                      {/* Temperature */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Temperature: {aiTemperature} <span className="text-xs text-gray-500">(not supported by Responses API)</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={aiTemperature}
                          onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                          disabled
                          className="w-full bg-gray-100 cursor-not-allowed opacity-60"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0.0</span>
                          <span>1.0</span>
                        </div>
                      </div>

                      {/* Reasoning Effort */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reasoning Effort</label>
                        <select
                          value={aiReasoningEffort}
                          onChange={(e) => setAiReasoningEffort(e.target.value)}
                          disabled={aiModel === 'gpt-5-nano'}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                            aiModel === 'gpt-5-nano' ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          <option value="none">None</option>
                          <option value="minimal">Minimal</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="xhigh">XHigh</option>
                        </select>
                        {aiModel === 'gpt-5-nano' && (
                          <p className="mt-1 text-xs text-gray-500">Reasoning not supported for gpt-5-nano</p>
                        )}
                      </div>

                      {/* Task */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
                        <textarea
                          value={aiTask}
                          onChange={(e) => setAiTask(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                      </div>

                      {/* Summary Section */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold text-gray-900">Summary Instructions</h5>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={aiSummaryRequired}
                              onChange={(e) => setAiSummaryRequired(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-700">Required</label>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={aiSummaryDescription}
                              onChange={(e) => setAiSummaryDescription(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                            <input
                              type="text"
                              value={aiSummaryPrefix}
                              onChange={(e) => setAiSummaryPrefix(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Focus (comma-separated)</label>
                            <textarea
                              value={aiSummaryFocus}
                              onChange={(e) => setAiSummaryFocus(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="problem, solution"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Word Count Min</label>
                              <input
                                type="number"
                                value={aiWordCountMin}
                                onChange={(e) => setAiWordCountMin(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Word Count Max</label>
                              <input
                                type="number"
                                value={aiWordCountMax}
                                onChange={(e) => setAiWordCountMax(parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* GitHub Section */}
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-semibold text-gray-900 mb-3">GitHub Instructions</h5>
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={aiGithubRequired}
                              onChange={(e) => setAiGithubRequired(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-700">Required</label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={aiGithubDescription}
                              onChange={(e) => setAiGithubDescription(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Karma Profile Section */}
                      <div className="border-t pt-4">
                        <h5 className="text-sm font-semibold text-gray-900 mb-3">Karma Profile Instructions</h5>
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={aiKarmaRequired}
                              onChange={(e) => setAiKarmaRequired(e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-700">Required</label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={aiKarmaDescription}
                              onChange={(e) => setAiKarmaDescription(e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Output Format */}
                      <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                        <select
                          value={aiOutputFormat}
                          onChange={(e) => setAiOutputFormat(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        >
                          <option value="json">JSON</option>
                          <option value="text">Text</option>
                          <option value="markdown">Markdown</option>
                        </select>
                      </div>

                      {/* Output Destination */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Output Destination</label>
                        <select
                          value={aiOutputDestination}
                          onChange={(e) => setAiOutputDestination(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        >
                          <option value="return">Return</option>
                          <option value="firestore">Firestore</option>
                          <option value="file">File</option>
                          <option value="api">API</option>
                        </select>
                      </div>
                    </div>
                  </div>

                    {/* Right Column: JSON Preview */}
                    <div className="bg-white rounded-lg shadow p-6">
                      <h4 className="text-md font-semibold mb-4 text-gray-900">JSON Preview</h4>
                      <div className="bg-gray-50 rounded p-4">
                        <pre className="text-xs text-gray-900 overflow-auto">
                          {jsonPreview || 'Loading preview...'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proposals Table */}
            {proposals.length > 0 && (
              <div className="mt-6 space-y-4">
                <div 
                  onClick={() => setIsProposalsTableVisible(!isProposalsTableVisible)}
                  className="flex items-center gap-2 cursor-pointer hover:text-gray-700"
                >
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                      isProposalsTableVisible ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Proposals Table</h3>
                </div>
                {isProposalsTableVisible && (
                  <>
                    <div className="flex items-center justify-end gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        {lastRefreshedAt && (() => {
                          const days = getDaysAgo()
                          if (days !== null) {
                            return (
                              <span className={`text-sm font-medium ${getDaysAgoColor(days)}`}>
                                The subgraph was queried {days} {days === 1 ? 'day' : 'days'} ago
                              </span>
                            )
                          }
                          return null
                        })()}
                        <button
                          onClick={handleRefresh}
                          disabled={isRefreshing || !parsedUrl}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                        >
                          {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="divide-y divide-gray-200" style={{ minWidth: '1200px', borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 border-r border-gray-300">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Proposal Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Proposal Title
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{ width: '450px', minWidth: '450px', maxWidth: '450px' }}>
                            Proposal Summary
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Requested Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Token
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                            Creation Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                            Proposal URL
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                            GitHub
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                            Karma Profile
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {proposals.map((proposal) => (
                          <tr key={proposal.id}>
                            <td className="px-4 py-4 whitespace-nowrap border-r border-gray-300">
                              <button
                                onClick={() => handleAiFill(proposal)}
                                disabled={processingProposalId !== null}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingProposalId !== null ? 'Processing...' : 'AI Fill'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-300">
                              {proposal.proposalNumber}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-300">
                              {proposal.title || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-300" style={{ width: '450px', minWidth: '450px', maxWidth: '450px' }}>
                              <div className="h-[150px] overflow-y-auto">
                                {proposal.summary || '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-300">
                              {formatAmount(proposal.requestedAmount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-300">
                              {proposal.tokenSymbol || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm border-r border-gray-300">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                proposal.executionStatus === 'executed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : proposal.executionStatus === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {proposal.executionStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-300">
                              {proposal.createdAt ? formatDate(proposal.createdAt) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 border-r border-gray-300" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                              <div className="h-[150px] overflow-y-auto">
                                {proposal.proposalUrl ? (
                                  <a href={proposal.proposalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-words">
                                    {proposal.proposalUrl}
                                  </a>
                                ) : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 border-r border-gray-300" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                              <div className="h-[150px] overflow-y-auto">
                                {proposal.github ? (
                                  <a href={proposal.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-words">
                                    {proposal.github}
                                  </a>
                                ) : '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                              <div className="h-[150px] overflow-y-auto">
                                {proposal.karmaProfile ? (
                                  <a href={proposal.karmaProfile} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-words">
                                    {proposal.karmaProfile}
                                  </a>
                                ) : '-'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                  </>
                )}
              </div>
            )}

            {/* Box Preview Section */}
            {proposals.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div 
                    onClick={() => setIsBoxPreviewVisible(!isBoxPreviewVisible)}
                    className="flex items-center gap-2 cursor-pointer hover:text-gray-700"
                  >
                    <svg
                      className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                        isBoxPreviewVisible ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">Box Preview</h3>
                  </div>
                  <button
                    onClick={handleSavePngClick}
                    disabled={savingPng || !projectId || !childId || !boxPreviewRef}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      savingPng || !projectId || !childId || !boxPreviewRef
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {savingPng ? 'Saving...' : 'Save as PNG'}
                  </button>
                  <button
                    onClick={handleSendToCanvasClick}
                    disabled={addingToCanvas || !projectId || !childId || loadingExistingReport}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      addingToCanvas || !projectId || !childId || loadingExistingReport
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {loadingExistingReport ? 'Loading...' : addingToCanvas ? 'Adding...' : 'Send to Canvas'}
                  </button>
                </div>
                {isBoxPreviewVisible && (
                  <div className="space-y-4">
                    {/* Styling Controls */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {/* Background Color */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Background (not exported):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={boxPreviewBackgroundColor}
                            onChange={(e) => handleBackgroundColorChange(e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">{boxPreviewBackgroundColor}</span>
                        </div>
                      </div>

                      {/* Card Color */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Card Color:</label>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name="cardColorType"
                              checked={boxPreviewCardColorType === 'solid'}
                              onChange={() => handleCardColorTypeChange('solid')}
                              className="cursor-pointer"
                            />
                            Solid
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name="cardColorType"
                              checked={boxPreviewCardColorType === 'gradient'}
                              onChange={() => handleCardColorTypeChange('gradient')}
                              className="cursor-pointer"
                            />
                            Gradient
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={boxPreviewCardColor}
                            onChange={(e) => handleCardColorChange(e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">{boxPreviewCardColor}</span>
                        </div>
                        {boxPreviewCardColorType === 'gradient' && (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={boxPreviewCardGradientColor}
                              onChange={(e) => handleCardGradientColorChange(e.target.value)}
                              className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                            />
                            <span className="text-xs text-gray-600">{boxPreviewCardGradientColor}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Border Size */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Border Size:</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCardBorderSizeChange(Math.max(0, boxPreviewCardBorderSize - 1))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >-</button>
                          <span className="text-xs text-gray-900 w-8 text-center">{boxPreviewCardBorderSize}px</span>
                          <button
                            onClick={() => handleCardBorderSizeChange(boxPreviewCardBorderSize + 1)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >+</button>
                        </div>
                      </div>

                      {/* Card Border Color */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Card Border Color:</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={boxPreviewCardBorderColor}
                            onChange={(e) => handleCardBorderColorChange(e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">{boxPreviewCardBorderColor}</span>
                        </div>
                      </div>

                      {/* Space Between Cards */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Space Between Cards:</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSpaceBetweenCardsChange(Math.max(0, boxPreviewSpaceBetweenCards - 1))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >-</button>
                          <span className="text-xs text-gray-600 w-8 text-center">{boxPreviewSpaceBetweenCards}px</span>
                          <button
                            onClick={() => handleSpaceBetweenCardsChange(boxPreviewSpaceBetweenCards + 1)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >+</button>
                        </div>
                      </div>

                      {/* Space Between Columns */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Space Between Columns:</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSpaceBetweenColumnsChange(Math.max(0, boxPreviewSpaceBetweenColumns - 1))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >-</button>
                          <span className="text-xs text-gray-600 w-8 text-center">{boxPreviewSpaceBetweenColumns}px</span>
                          <button
                            onClick={() => handleSpaceBetweenColumnsChange(boxPreviewSpaceBetweenColumns + 1)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >+</button>
                        </div>
                      </div>

                      {/* Font Size */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Font Size:</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFontSizeChange(Math.max(8, boxPreviewFontSize - 1))}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >-</button>
                          <span className="text-xs text-gray-900 w-10 text-center">{boxPreviewFontSize}pt</span>
                          <button
                            onClick={() => handleFontSizeChange(boxPreviewFontSize + 1)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                          >+</button>
                        </div>
                      </div>

                      {/* Links Color */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Links Color:</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={boxPreviewLinksColor}
                            onChange={(e) => handleLinksColorChange(e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-xs text-gray-600">{boxPreviewLinksColor}</span>
                        </div>
                      </div>

                      {/* Sort Cards */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">Sort Cards:</label>
                        <select
                          value={boxPreviewSortBy}
                          onChange={(e) => {
                            const newSort = e.target.value as 'amount-desc' | 'number-asc' | 'title-asc'
                            setBoxPreviewSortBy(newSort)
                            saveBoxPreviewSettings({ sortBy: newSort })
                          }}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-600"
                          style={{ color: '#4b5563' }}
                        >
                          <option value="amount-desc" style={{ color: '#4b5563' }}>Amount (descending)</option>
                          <option value="number-asc" style={{ color: '#4b5563' }}>Proposal Number (ascending)</option>
                          <option value="title-asc" style={{ color: '#4b5563' }}>Proposal Title (ascending)</option>
                        </select>
                      </div>

                      {/* Reset Columns */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-700">&nbsp;</label>
                        <button
                          onClick={handleResetColumns}
                          className="text-xs border border-gray-300 rounded px-3 py-1 bg-white text-gray-600 hover:bg-gray-50"
                        >
                          Reset Columns
                        </button>
                      </div>
                    </div>
                    
                    {/* Preview Container with Cards */}
                    <div className="bg-gray-200 p-8 flex justify-center">
                      <div 
                        ref={setBoxPreviewRef}
                        className="rounded-lg shadow-lg p-4 relative"
                        style={{ 
                          width: '1000px', 
                          minHeight: '200px', 
                          backgroundColor: boxPreviewBackgroundColor 
                        }}
                      >
                        {/* Cards Container - each card is horizontal with all 3 columns */}
                        <div style={{ width: '100%' }}>
                          {[...proposals].sort((a, b) => {
                            if (boxPreviewSortBy === 'amount-desc') {
                              return Number(b.requestedAmount) - Number(a.requestedAmount)
                            } else if (boxPreviewSortBy === 'number-asc') {
                              return Number(a.id) - Number(b.id)
                            } else if (boxPreviewSortBy === 'title-asc') {
                              return (a.title || '').localeCompare(b.title || '')
                            }
                            return 0
                          }).map((proposal, index) => (
                            <div
                              key={proposal.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `${boxPreviewColumnWidths.title}% ${boxPreviewSpaceBetweenColumns}px ${boxPreviewColumnWidths.summary}% ${boxPreviewSpaceBetweenColumns}px ${boxPreviewColumnWidths.amount}% ${boxPreviewSpaceBetweenColumns}px ${boxPreviewColumnWidths.links}%`,
                                marginBottom: index < proposals.length - 1 ? `${boxPreviewSpaceBetweenCards}px` : '0',
                                backgroundColor: boxPreviewCardColorType === 'gradient' 
                                  ? undefined 
                                  : boxPreviewCardColor,
                                backgroundImage: boxPreviewCardColorType === 'gradient'
                                  ? `linear-gradient(to bottom right, ${boxPreviewCardColor}, ${boxPreviewCardGradientColor})`
                                  : undefined,
                                border: `${boxPreviewCardBorderSize}px solid ${boxPreviewCardBorderColor}`,
                                borderRadius: '50px', // 50% border radius for pill shape (rounded on left and right)
                                padding: '12px 16px',
                                fontSize: `${boxPreviewFontSize}pt`,
                                width: '100%'
                              }}
                            >
                              {/* Title Column */}
                              <div style={{ 
                                fontWeight: 'bold', 
                                color: '#1f2937', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                paddingRight: '8px'
                              }}>
                                {proposal.title || '-'}
                              </div>
                              
                              {/* Divider between title and summary - 3D dent effect */}
                              <div style={{
                                width: '6px',
                                height: '100%',
                                margin: '0 auto',
                                position: 'relative',
                                background: 'transparent'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                                <div style={{
                                  position: 'absolute',
                                  right: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                              </div>
                              
                              {/* Summary Column */}
                              <div style={{ 
                                color: '#4b5563', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                paddingLeft: '8px',
                                paddingRight: '8px'
                              }}>
                                {proposal.summary || '-'}
                              </div>
                              
                              {/* Divider between summary and amount - 3D dent effect */}
                              <div style={{
                                width: '6px',
                                height: '100%',
                                margin: '0 auto',
                                position: 'relative',
                                background: 'transparent'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                                <div style={{
                                  position: 'absolute',
                                  right: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                              </div>
                              
                              {/* Requested Amount Column */}
                              <div style={{ 
                                color: '#1f2937', 
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                paddingLeft: '8px',
                                paddingRight: '8px'
                              }}>
                                <div>This proposal received</div>
                                <div style={{ fontWeight: 'bold' }}>
                                  {formatAmount(proposal.requestedAmount)} {proposal.tokenSymbol || ''}
                                </div>
                              </div>

                              {/* Divider between amount and links */}
                              <div style={{
                                width: '6px',
                                height: '100%',
                                margin: '0 auto',
                                position: 'relative',
                                background: 'transparent'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                                <div style={{
                                  position: 'absolute',
                                  right: '0',
                                  top: '0',
                                  bottom: '0',
                                  width: '2px',
                                  backgroundColor: boxPreviewCardBorderColor,
                                  opacity: 0.3,
                                  boxShadow: '-1px 0 1px rgba(255, 255, 255, 0.1)'
                                }} />
                              </div>

                              {/* Links Column */}
                              <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                paddingLeft: '8px'
                              }}>
                                {/* First sub-cell - Proposal */}
                                <div 
                                  data-overlay-type="proposal"
                                  data-proposal-id={proposal.id}
                                  data-overlay-url={proposal.proposalUrl || ''}
                                  style={{
                                    flex: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    cursor: proposal.proposalUrl ? 'pointer' : 'default'
                                  }}
                                  onClick={() => {
                                    if (proposal.proposalUrl) {
                                      window.open(proposal.proposalUrl as string, '_blank', 'noopener,noreferrer')
                                    }
                                  }}
                                >
                                  {proposal.proposalUrl && (
                                    <>
                                      <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1
                                      }} />
                                      <span style={{
                                        fontWeight: 'bold',
                                        color: boxPreviewLinksColor,
                                        textDecoration: 'underline',
                                        position: 'relative',
                                        zIndex: 0,
                                        pointerEvents: 'none'
                                      }}>
                                        Proposal
                                      </span>
                                    </>
                                  )}
                                </div>
                                
                                {/* Second sub-cell - Github */}
                                <div 
                                  data-overlay-type="github"
                                  data-proposal-id={proposal.id}
                                  data-overlay-url={proposal.github || ''}
                                  style={{
                                    flex: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    cursor: proposal.github ? 'pointer' : 'default'
                                  }}
                                  onClick={() => {
                                    if (proposal.github) {
                                      window.open(proposal.github as string, '_blank', 'noopener,noreferrer')
                                    }
                                  }}
                                >
                                  {proposal.github && (
                                    <>
                                      <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1
                                      }} />
                                      <span style={{
                                        fontWeight: 'bold',
                                        color: boxPreviewLinksColor,
                                        textDecoration: 'underline',
                                        position: 'relative',
                                        zIndex: 0,
                                        pointerEvents: 'none'
                                      }}>
                                        Github
                                      </span>
                                    </>
                                  )}
                                </div>
                                
                                {/* Third sub-cell - Karma */}
                                <div 
                                  data-overlay-type="karma"
                                  data-proposal-id={proposal.id}
                                  data-overlay-url={proposal.karmaProfile || ''}
                                  style={{
                                    flex: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    cursor: proposal.karmaProfile ? 'pointer' : 'default'
                                  }}
                                  onClick={() => {
                                    if (proposal.karmaProfile) {
                                      window.open(proposal.karmaProfile as string, '_blank', 'noopener,noreferrer')
                                    }
                                  }}
                                >
                                  {proposal.karmaProfile && (
                                    <>
                                      <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 1
                                      }} />
                                      <span style={{
                                        fontWeight: 'bold',
                                        color: boxPreviewLinksColor,
                                        textDecoration: 'underline',
                                        position: 'relative',
                                        zIndex: 0,
                                        pointerEvents: 'none'
                                      }}>
                                        Karma
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Resize Handles - positioned absolutely over the cards */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '16px',
                            left: '16px',
                            right: '16px',
                            bottom: '16px',
                            pointerEvents: 'none',
                            zIndex: 10
                          }}
                        >
                          {/* Resize handle between title and summary */}
                          <div
                            onMouseDown={(e) => handleColumnResizeStart('title', e)}
                            style={{
                              position: 'absolute',
                              left: `calc(${boxPreviewColumnWidths.title}% - ${boxPreviewSpaceBetweenColumns / 2}px)`,
                              top: '0',
                              bottom: '0',
                              width: '4px',
                              cursor: 'col-resize',
                              pointerEvents: 'auto',
                              backgroundColor: isResizingColumn === 'title' ? '#3b82f6' : 'transparent',
                              transition: isResizingColumn === null ? 'background-color 0.2s' : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = '#9ca3af'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = 'transparent'
                              }
                            }}
                          />
                          
                          {/* Resize handle between summary and amount */}
                          <div
                            onMouseDown={(e) => handleColumnResizeStart('summary', e)}
                            style={{
                              position: 'absolute',
                              left: `calc(${boxPreviewColumnWidths.title + boxPreviewColumnWidths.summary}% - ${boxPreviewSpaceBetweenColumns / 2}px)`,
                              top: '0',
                              bottom: '0',
                              width: '4px',
                              cursor: 'col-resize',
                              pointerEvents: 'auto',
                              backgroundColor: isResizingColumn === 'summary' ? '#3b82f6' : 'transparent',
                              transition: isResizingColumn === null ? 'background-color 0.2s' : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = '#9ca3af'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = 'transparent'
                              }
                            }}
                          />
                          
                          {/* Resize handle between amount and links */}
                          <div
                            onMouseDown={(e) => handleColumnResizeStart('amount', e)}
                            style={{
                              position: 'absolute',
                              left: `calc(${boxPreviewColumnWidths.title + boxPreviewColumnWidths.summary + boxPreviewColumnWidths.amount}% - ${boxPreviewSpaceBetweenColumns / 2}px)`,
                              top: '0',
                              bottom: '0',
                              width: '4px',
                              cursor: 'col-resize',
                              pointerEvents: 'auto',
                              backgroundColor: isResizingColumn === 'amount' ? '#3b82f6' : 'transparent',
                              transition: isResizingColumn === null ? 'background-color 0.2s' : 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = '#9ca3af'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isResizingColumn) {
                                (e.target as HTMLElement).style.backgroundColor = 'transparent'
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send to Canvas Modal */}
      {showSendToCanvasModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 p-6 rounded-lg w-[560px] max-w-[95vw]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Send Gardens Report to Canvas</h2>
              <button 
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50" 
                onClick={() => setShowSendToCanvasModal(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {/* Width slider */}
              <div className="grid gap-2 text-sm">
                <label className="grid gap-1">
                  <span>Width: {sendToCanvasWidth}% ({Math.round((sendToCanvasWidth / 100) * 1100)}px)</span>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    value={sendToCanvasWidth}
                    onChange={(e) => setSendToCanvasWidth(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">
                    Adjust the width of the report (50% to 90% of canvas width)
                  </div>
                </label>
              </div>

              {/* Y Position */}
              <div className="grid gap-2 text-sm">
                <label className="grid gap-1">
                  <span>Y Position (pixels from top)</span>
                  <input
                    type="number"
                    min="0"
                    value={sendToCanvasY}
                    onChange={(e) => setSendToCanvasY(Math.max(0, Number(e.target.value)))}
                    className="border rounded px-2 py-1"
                  />
                  <div className="text-xs text-gray-500">
                    Vertical position of the report on the canvas
                  </div>
                </label>
              </div>

              {/* Horizontal Alignment */}
              <div className="grid gap-2 text-sm">
                <label className="grid gap-1">
                  <span>Horizontal Alignment</span>
                  <div className="flex gap-2">
                    <button
                      className={`px-3 py-2 border rounded flex-1 ${
                        sendToCanvasAlignment === 'left' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setSendToCanvasAlignment('left')}
                    >
                      Left
                    </button>
                    <button
                      className={`px-3 py-2 border rounded flex-1 ${
                        sendToCanvasAlignment === 'center' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setSendToCanvasAlignment('center')}
                    >
                      Center
                    </button>
                    <button
                      className={`px-3 py-2 border rounded flex-1 ${
                        sendToCanvasAlignment === 'right' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setSendToCanvasAlignment('right')}
                    >
                      Right
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    Horizontal alignment of the report on the canvas
                  </div>
                </label>
              </div>

              {/* Preview */}
              <div className="border rounded p-3 bg-gray-50">
                <div className="text-sm font-medium mb-2">Preview</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Width: {Math.round((sendToCanvasWidth / 100) * 1100)}px ({sendToCanvasWidth}% of canvas)</div>
                  <div>Y Position: {sendToCanvasY}px</div>
                  <div>Alignment: {sendToCanvasAlignment}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                  onClick={() => setShowSendToCanvasModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm border rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  onClick={async () => {
                    setShowSendToCanvasModal(false)
                    await handleAddToCanvas(sendToCanvasWidth, sendToCanvasY, sendToCanvasAlignment)
                  }}
                  disabled={addingToCanvas}
                >
                  {addingToCanvas ? 'Sending...' : 'Send to Canvas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GardensReportBuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <GardensReportBuilderContent />
    </Suspense>
  )
}

