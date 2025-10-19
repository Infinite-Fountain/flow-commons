import React, { Suspense, useEffect, useState } from 'react'

const Lottie = React.lazy(() => import('lottie-react'))

export type LottieLayer = {
  src: string // URL to .json
  loop?: boolean
  autoplay?: boolean
}

function Layer({ layer }: { layer?: LottieLayer }) {
  const [data, setData] = useState<any | null>(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!layer) return
      try {
        const res = await fetch(layer.src)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (_) {
        // ignore
      }
    }
    load()
    return () => { cancelled = true }
  }, [layer])
  if (!layer || !data) return null
  return <Lottie animationData={data} loop={layer.loop ?? true} autoplay={layer.autoplay ?? true} />
}

export function BackgroundLottieLayers({
  layer1,
  layer2,
  layer3,
}: {
  layer1?: LottieLayer
  layer2?: LottieLayer
  layer3?: LottieLayer
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        <div style={{ position: 'absolute', inset: 0 }}><Layer layer={layer1} /></div>
        <div style={{ position: 'absolute', inset: 0 }}><Layer layer={layer2} /></div>
        <div style={{ position: 'absolute', inset: 0 }}><Layer layer={layer3} /></div>
      </Suspense>
    </div>
  )
}

