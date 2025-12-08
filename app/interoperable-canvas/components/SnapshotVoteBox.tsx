'use client'

import React, { useEffect, useState } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { doc, getFirestore, getDoc } from 'firebase/firestore'

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

interface SnapshotVoteBoxProps {
  proposalId: string
  backgroundColor?: string
  border?: boolean
  borderColor?: string
  borderWidth?: number
  projectId: string
  canvasId: string
  scope?: { type: 'root' } | { type: 'child'; childId: string }
  clickable?: boolean
  url?: string
  openIn?: 'new-tab' | 'same-tab'
  presentation?: boolean
}

interface SnapshotProposalData {
  proposalId: string
  choices: string[]
  scores: number[]
  scoresTotal: number
  quorum: number
  end: number
  state: string
}

export function SnapshotVoteBox({
  proposalId,
  backgroundColor = '#ffffff',
  border = true,
  borderColor = '#000000',
  borderWidth = 1,
  projectId,
  canvasId,
  scope,
  clickable = false,
  url,
  openIn = 'new-tab',
  presentation = false,
}: SnapshotVoteBoxProps) {
  const [proposalData, setProposalData] = useState<SnapshotProposalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProposalData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Build Firestore path
        const basePath = ['interoperable-canvas', projectId]
        if (scope?.type === 'child') {
          basePath.push('child-canvases', scope.childId, 'canvases', canvasId)
        } else {
          basePath.push('canvases', canvasId)
        }
        basePath.push('snapshot-proposals', proposalId)

        const proposalRef = doc(db, basePath.join('/'))
        const proposalSnap = await getDoc(proposalRef)

        if (proposalSnap.exists()) {
          const data = proposalSnap.data() as SnapshotProposalData
          // If proposal is closed, use cached data
          if (data.state === 'closed') {
            setProposalData(data)
            setLoading(false)
            return
          }
        }

        // If not in Firestore or proposal is active, fetch from API
        const response = await fetch('https://hub.snapshot.org/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
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
            `,
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

        const apiData = result.data.proposal
        const data: SnapshotProposalData = {
          proposalId: apiData.id,
          choices: apiData.choices || [],
          scores: apiData.scores || [],
          scoresTotal: apiData.scores_total || 0,
          quorum: apiData.quorum || 0,
          end: apiData.end || 0,
          state: apiData.state || 'unknown',
        }

        setProposalData(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load proposal data')
      } finally {
        setLoading(false)
      }
    }

    if (proposalId) {
      loadProposalData()
    }
  }, [proposalId, projectId, canvasId, scope])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs">
        Loading...
      </div>
    )
  }

  if (error || !proposalData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-600 text-xs p-2">
        {error || 'Failed to load proposal data'}
      </div>
    )
  }

  // Calculate percentages
  const percentages = proposalData.scores.map((score) =>
    proposalData.scoresTotal > 0 ? (score / proposalData.scoresTotal) * 100 : 0
  )

  // Find winner index (highest score)
  const winnerIndex = proposalData.scores.indexOf(Math.max(...proposalData.scores))

  // Calculate quorum percentage
  const quorumPercentage =
    proposalData.quorum > 0
      ? Math.round((proposalData.scoresTotal / proposalData.quorum) * 100)
      : 0

  // Format end date
  const formatEndDate = (timestamp: number, state: string) => {
    if (state === 'closed') {
      const date = new Date(timestamp * 1000)
      return `Ended: ${date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    } else {
      const now = Date.now()
      const endTime = timestamp * 1000
      const diffMs = endTime - now
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays < 0) {
        return 'Ended'
      } else if (diffDays === 0) {
        return 'Closes today'
      } else if (diffDays === 1) {
        return 'Closes in 1 day'
      } else {
        return `Closes in ${diffDays} days`
      }
    }
  }

  // Map choice labels to variants and order
  const getVariant = (choice: string): 'for' | 'against' | 'abstain' => {
    const lower = choice.toLowerCase()
    if (lower === 'for' || lower === 'yes') return 'for'
    if (lower === 'against' || lower === 'no') return 'against'
    return 'abstain'
  }

  // Order choices: For, Abstain, Against
  const orderedChoices = proposalData.choices
    .map((choice, i) => ({
      choice,
      score: proposalData.scores[i],
      percentage: percentages[i],
      variant: getVariant(choice),
      index: i,
    }))
    .sort((a, b) => {
      // Order: For (0), Abstain (1), Against (2)
      const order: Record<string, number> = { for: 0, abstain: 1, against: 2 }
      return (order[a.variant] ?? 99) - (order[b.variant] ?? 99)
    })

  const borderStyle = border
    ? {
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: '8px',
      }
    : {}

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable || !url || !presentation) return
    
    e.stopPropagation()
    const isExternal = (() => {
      try {
        const parsed = new URL(url)
        if (typeof window !== 'undefined') {
          return parsed.origin !== window.location.origin
        }
        return true
      } catch {
        return false
      }
    })()
    
    if (openIn === 'new-tab') {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      if (isExternal) {
        link.rel = 'noopener noreferrer'
      }
      link.click()
    } else {
      window.location.href = url
    }
  }

  const isClickableMode = presentation && clickable && url
  const pointerEventsStyle = isClickableMode ? { pointerEvents: 'none' as const } : {}

  return (
    <div
      className="w-full h-full flex flex-col p-3 relative"
      style={{
        backgroundColor,
        ...borderStyle,
      }}
    >
      {/* Full-size clickable overlay - only in presentation mode when clickable is enabled */}
      {isClickableMode && (
        <button
          type="button"
          className="absolute inset-0 w-full h-full z-50 cursor-pointer"
          style={{ 
            background: 'transparent', 
            border: 'none', 
            padding: 0,
            pointerEvents: 'auto'
          }}
          onClick={handleClick}
          aria-label="Open link"
        />
      )}
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-3"
        style={pointerEventsStyle}
      >
        <div className="flex items-center gap-2" style={pointerEventsStyle}>
          <span className="text-yellow-500 text-lg" style={pointerEventsStyle}>⚡</span>
          <span className="text-gray-700 font-medium" style={pointerEventsStyle}>snapshot</span>
        </div>
        <div className="flex items-center gap-1.5" style={pointerEventsStyle}>
          <span className="text-gray-600" style={pointerEventsStyle}>📶</span>
          <span className="font-bold text-gray-400" style={pointerEventsStyle}>RESULTS</span>
        </div>
      </div>

      {/* Vote Options */}
      <div 
        className="flex flex-col gap-2 flex-1"
        style={pointerEventsStyle}
      >
        {orderedChoices.map(({ choice, percentage, variant, index }) => {
          const isWinner = index === winnerIndex && proposalData.state === 'closed'
          const isFor = variant === 'for'
          const isAgainst = variant === 'against'
          const isAbstain = variant === 'abstain'

          let borderColorClass = 'border-gray-300'
          let borderColorHex = '#9ca3af'
          let iconBg = 'bg-gray-400'
          let iconContent = '−'

          if (isFor) {
            borderColorClass = 'border-green-500'
            borderColorHex = '#22c55e'
            iconBg = 'bg-green-500'
            iconContent = '✓'
          } else if (isAgainst) {
            borderColorClass = 'border-red-500'
            borderColorHex = '#ef4444'
            iconBg = 'bg-red-500'
            iconContent = '✕'
          } else if (isAbstain) {
            borderColorClass = 'border-gray-400'
            borderColorHex = '#9ca3af'
            iconBg = 'bg-gray-400'
            iconContent = '−'
          }

          // Convert hex to rgb for rgba
          const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
            return result
              ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
                }
              : { r: 0, g: 0, b: 0 }
          }

          const rgb = hexToRgb(borderColorHex)

          return (
            <div
              key={choice}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 ${borderColorClass}`}
              style={{
                backgroundColor: isWinner
                  ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
                  : '#ffffff',
                ...pointerEventsStyle,
              }}
            >
              <div className="flex items-center gap-2" style={pointerEventsStyle}>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${iconBg}`}
                  style={pointerEventsStyle}
                >
                  {iconContent}
                </div>
                <span className="font-medium text-gray-800" style={pointerEventsStyle}>{choice}</span>
              </div>
              <span className="font-semibold text-gray-700" style={pointerEventsStyle}>
                {percentage.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div 
        className="flex items-center justify-between mt-3 text-xs text-gray-500"
        style={pointerEventsStyle}
      >
        <span style={pointerEventsStyle}>Quorum: {quorumPercentage}%</span>
        <span style={pointerEventsStyle}>{formatEndDate(proposalData.end, proposalData.state)}</span>
      </div>
    </div>
  )
}

