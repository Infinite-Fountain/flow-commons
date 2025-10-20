import React from 'react'

export function Modal({ open, title, children, onClose, onSubmit }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void; onSubmit: () => void }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: '#14141a', color: '#f5f7fa', padding: 16, borderRadius: 12, minWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div style={{ marginBottom: 12 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onSubmit} style={{ background: '#ffcf33', borderRadius: 6, padding: '6px 10px' }}>Save</button>
        </div>
      </div>
    </div>
  )
}

