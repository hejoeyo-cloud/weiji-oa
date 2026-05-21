import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getCompanies, getPlatformOrders, updateCompanySubscription } from '../api/platform'
import type { Company, PaymentOrder } from '../types'

export default function PlatformPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [orders, setOrders] = useState<PaymentOrder[]>([])

  const load = async () => {
    const [cs, os] = await Promise.all([getCompanies(), getPlatformOrders()])
    setCompanies(cs)
    setOrders(os)
  }

  useEffect(() => { load() }, [])

  const extend = async (companyId: number, days: number) => {
    await updateCompanySubscription(companyId, { status: 'active', extend_days: days })
    await load()
  }

  const disable = async (companyId: number) => {
    if (!confirm('确定停用该公司？')) return
    await updateCompanySubscription(companyId, { status: 'disabled' })
    await load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">平台管理</h2>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw size={15} /></button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>{['公司', '用户数', '状态', '订阅', '到期', '操作'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {companies.map(c => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.user_count}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3">{c.subscription?.status || '-'}</td>
                <td className="px-4 py-3 text-gray-500">{c.subscription?.current_period_end?.slice(0, 10) || c.subscription?.trial_end_at?.slice(0, 10) || '-'}</td>
                <td className="px-4 py-3 flex gap-3">
                  <button onClick={() => extend(c.id, 365)} className="text-xs text-blue-600">延长一年</button>
                  <button onClick={() => extend(c.id, 30)} className="text-xs text-green-600">延长30天</button>
                  <button onClick={() => disable(c.id)} className="text-xs text-red-600">停用</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <div className="px-4 py-3 font-medium border-b">最近订单</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>{['公司', '订单号', '类型', '金额', '状态', '支付时间'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(o => (
              <tr key={o.id}>
                <td className="px-4 py-3">{o.company_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.order_no}</td>
                <td className="px-4 py-3">{o.plan_type === 'first_year' ? '首年' : '续费'}</td>
                <td className="px-4 py-3">¥{o.amount.toFixed(2)}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3 text-gray-500">{o.paid_at?.slice(0, 16).replace('T', ' ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
