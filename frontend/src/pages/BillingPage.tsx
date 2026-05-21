import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { createBillingOrder, devMarkOrderPaid, getBillingOrders, getSubscription } from '../api/billing'
import type { PaymentOrder, SubscriptionInfo } from '../types'

const statusLabel: Record<string, string> = {
  trial: '试用中',
  active: '已订阅',
  grace: '宽限期',
  expired: '已到期',
  disabled: '已停用',
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [sub, orderList] = await Promise.all([getSubscription(), getBillingOrders()])
      setSubscription(sub)
      setOrders(orderList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreateOrder = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await createBillingOrder(1)
      if (res.pay_url) {
        window.open(res.pay_url, '_blank')
        setMessage('已创建支付宝订单，请在新窗口完成支付。')
      } else {
        setMessage('订单已创建。当前未配置支付宝参数，可在沙箱配置后生成支付链接。')
      }
      await load()
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDevPaid = async (orderId: number) => {
    await devMarkOrderPaid(orderId)
    await load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">订阅续费</h2>
        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw size={15} /></button>
      </div>

      <div className="bg-white border rounded-lg p-5" style={{ borderColor: '#f0f0f0' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center"><CreditCard size={20} /></div>
          <div>
            <div className="text-sm text-gray-500">当前状态</div>
            <div className="text-lg font-semibold">{statusLabel[subscription?.status || ''] || subscription?.status || '-'}</div>
          </div>
          <div className="ml-auto text-right text-sm text-gray-500">
            <div>剩余 {subscription?.days_remaining ?? 0} 天</div>
            <div>有效期至 {subscription?.current_period_end?.slice(0, 10) || subscription?.trial_end_at?.slice(0, 10) || '-'}</div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button disabled={loading} onClick={handleCreateOrder} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50">
            创建年度订阅订单
          </button>
          <span className="text-sm text-gray-500">首年 1599 元，续费 599 元/年</span>
        </div>
        {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#f0f0f0' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {['订单号', '类型', '金额', '状态', '创建时间', '操作'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(o => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-mono text-xs">{o.order_no}</td>
                <td className="px-4 py-3">{o.plan_type === 'first_year' ? '首年' : '续费'}</td>
                <td className="px-4 py-3">¥{o.amount.toFixed(2)}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3 text-gray-500">{o.created_at?.slice(0, 16).replace('T', ' ')}</td>
                <td className="px-4 py-3">
                  {o.status === 'pending' && <button onClick={() => handleDevPaid(o.id)} className="text-xs text-blue-600">开发标记已支付</button>}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无订单</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
