import React, { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { HexColorPicker } from 'react-colorful'

export function BackgroundGradientModal({ open, mode, from, to, onClose, onSave }: { open: boolean; mode: 'linear' | 'radial'; from: string; to: string; onClose: () => void; onSave: (b: { mode: 'linear' | 'radial'; from: string; to: string }) => void }) {
  const [localFrom, setLocalFrom] = useState(from)
  const [localTo, setLocalTo] = useState(to)

  const preview = useMemo(() => {
    return mode === 'linear'
      ? `linear-gradient(135deg, ${localFrom}, ${localTo})`
      : `radial-gradient(circle, ${localFrom}, ${localTo})`
  }, [mode, localFrom, localTo])

  return (
    <Modal open={open} title={`${mode === 'linear' ? 'Linear' : 'Radial'} Gradient`} onClose={onClose} onSubmit={() => onSave({ mode, from: localFrom, to: localTo })}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ height: 100, borderRadius: 8, background: preview }} />
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div style={{ marginBottom: 6 }}>Initial color</div>
            <HexColorPicker color={localFrom} onChange={setLocalFrom} />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Final color</div>
            <HexColorPicker color={localTo} onChange={setLocalTo} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
