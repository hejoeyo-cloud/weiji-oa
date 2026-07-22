import React from 'react'
import type { WarehouseBatch } from '../../types'

interface BatchSelectorProps {
  batches: WarehouseBatch[]
  batchQtys: Record<number, number>
  setBatchQtys: React.Dispatch<React.SetStateAction<Record<number, number>>>
  totalQuantity: number
  onAutoFillFIFO: () => void
}

export default function BatchSelector({ batches, batchQtys, setBatchQtys, totalQuantity, onAutoFillFIFO }: BatchSelectorProps) {
  if (batches.length === 0) return null

  const totalAllocated = Object.values(batchQtys).reduce((a: number, b: number) => a + (b || 0), 0) as number
  const isMatch = totalAllocated === totalQuantity

  return (
    <div style={{ marginTop: -8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#404040' }}>选择批次</span>
        <span style={{ fontSize: 12, color: isMatch ? '#16a34a' : '#ef4444' }}>
          (已分配 {totalAllocated} / {totalQuantity})
        </span>
        <button type="button" onClick={onAutoFillFIFO}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #e5e5e5', color: '#737373', background: '#fff' }}>
          自动FIFO
        </button>
      </div>
      <table style={{ width: '100%', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafaf9' }}>
            <th style={{ padding: '4px 8px', textAlign: 'left', color: '#737373' }}>批次号</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', color: '#737373' }}>单价</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', color: '#737373' }}>剩余</th>
            <th style={{ padding: '4px 8px', textAlign: 'right', color: '#737373' }}>本次出库</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id} style={{ borderTop: '1px solid #f0f0f0' }}>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: '#404040' }}>{b.batch_no}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#404040' }}>¥{b.unit_price.toFixed(2)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#737373' }}>{b.remaining_quantity}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                <input type="number" min={0} max={b.remaining_quantity}
                  value={batchQtys[b.id] || ''}
                  onChange={e => setBatchQtys(prev => ({...prev, [b.id]: Number(e.target.value)}))}
                  style={{ width: 60, padding: '2px 4px', fontSize: 12, border: '1px solid #e5e5e5', borderRadius: 4, outline: 'none', textAlign: 'right', color: '#1f1f1f' }}
                  placeholder="0"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
