import React from 'react'
import type { WarehouseBatch, WarehouseProduct } from '../../types'

interface Props {
  show: boolean
  product: WarehouseProduct | null
  batches: WarehouseBatch[]
  loading: boolean
  onClose: () => void
}

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.12)', backdropFilter: 'blur(4px)', padding: '0 16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: wide ? 560 : 480, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1f1f1f' }}>{title}</h3>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function BatchDetailModal({ show, product, batches, loading, onClose }: Props) {
  if (!show || !product) return null

  const totalRemaining = batches.reduce((s, b) => s + b.remaining_quantity, 0)
  const totalValue = batches.reduce((s, b) => s + b.unit_price * b.remaining_quantity, 0)
  const avgPrice = totalRemaining > 0 ? totalValue / totalRemaining : 0

  return (
    <Modal title={product.name + ' - 批次明细'} onClose={onClose} wide>
      <div style={{ padding: 24 }}>
        {/* Product info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, fontSize: 14 }}>
          <div><span style={{ color: '#737373' }}>编码: </span><span style={{ color: '#1f1f1f' }}>{product.code}</span></div>
          <div><span style={{ color: '#737373' }}>类别: </span><span style={{ color: '#1f1f1f' }}>{product.category || '-'}</span></div>
          <div><span style={{ color: '#737373' }}>规格: </span><span style={{ color: '#1f1f1f' }}>{product.spec || '-'}</span></div>
          <div><span style={{ color: '#737373' }}>库存: </span>
            <span style={{ fontWeight: 600, color: product.current_qty <= 5 ? '#ef4444' : '#16a34a' }}>{product.current_qty} {product.unit}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 14, color: '#a3a3a3' }}>加载中...</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 14, color: '#a3a3a3' }}>暂无批次记录</div>
        ) : (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafaf9', borderBottom: '1px solid #f0f0f0' }}>
                  {['批次号', '进货单价', '入库数量', '剩余数量', '库存价值'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#737373' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ borderBottom: '2px solid #e5e5e5' }}>
                {batches.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: '#404040' }}>{b.batch_no}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#404040' }}>¥{b.unit_price.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#737373' }}>{b.initial_quantity}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: b.remaining_quantity > 0 ? '#16a34a' : '#a3a3a3' }}>{b.remaining_quantity}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#404040' }}>¥{(b.unit_price * b.remaining_quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#fafaf9' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>合计</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#737373' }}>均价 ¥{avgPrice.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#737373' }}>-</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>{totalRemaining}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>¥{totalValue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
