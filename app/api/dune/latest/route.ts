import { NextRequest } from 'next/server'

type CacheEntry = { expiresAtMs: number; payload: any }
const memoryCache = new Map<string, CacheEntry>()

const getEnv = (key: string) => (process.env as any)?.[key]

const toMs = (d: string | number | Date) => new Date(d as any).getTime()

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000 // 6h fallback if upstream does not provide expires_at

const makeKey = (queryId: string, params?: string | null) => `latest:${queryId}:${params ?? ''}`

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const queryId = (searchParams.get('queryId') || '').trim()
    const params = searchParams.get('params') // reserved for future (execute); not used for latest

    if (!queryId || !/^\d+$/.test(queryId)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid-queryId' }), { status: 400 })
    }

    const apiKey = getEnv('DUNE_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'server-misconfigured', detail: 'Missing DUNE_API_KEY' }), { status: 500 })
    }

    const cacheKey = makeKey(queryId, params)
    const now = Date.now()
    const hit = memoryCache.get(cacheKey)
    if (hit && hit.expiresAtMs > now) {
      return new Response(JSON.stringify({ ok: true, source: 'cache', data: hit.payload }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    const upstream = await fetch(`https://api.dune.com/api/v1/query/${encodeURIComponent(queryId)}/results`, {
      headers: {
        'accept': 'application/json',
        'X-Dune-API-Key': apiKey,
      },
      next: { revalidate: 60 },
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      return new Response(JSON.stringify({ ok: false, error: 'upstream', status: upstream.status, body: text }), { status: 502 })
    }

    const json = await upstream.json()

    const expiresAt = (json?.expires_at || json?.result?.metadata?.expires_at) as string | undefined
    const expiresAtMs = expiresAt ? toMs(expiresAt) : (now + DEFAULT_TTL_MS)

    memoryCache.set(cacheKey, { expiresAtMs, payload: json })

    return new Response(JSON.stringify({ ok: true, source: 'upstream', data: json, expiresAt }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    console.error('dune/latest error', e)
    return new Response(JSON.stringify({ ok: false, error: 'internal-error' }), { status: 500 })
  }
}


