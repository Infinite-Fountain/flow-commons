import React from 'react'

export function TextPrimitive({ text = 'Sample Text' }: { text?: string }) {
  return <div style={{ padding: 12, fontSize: 16 }}>{text}</div>
}

export function ImagePrimitive({ src, alt = '' }: { src: string; alt?: string }) {
  return <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
}

export function PlaceholderPrimitive({ label }: { label: string }) {
  return <div style={{ padding: 12, opacity: 0.7 }}>{label}</div>
}

