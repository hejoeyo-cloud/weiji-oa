import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, RefreshCw, Package, RotateCcw, DollarSign, Store, BarChart3, ChevronUp, ChevronDown, Wrench, AlertTriangle } from 'lucide-react'
import {
  ComposedChart, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  getReportOverview, getReportShipping, getReportAftersales,
  getReportFinance, getReportShop, getReportRepairEfficiency,
  getReportProductIssues,
} from '../api/reports'
import type {
  OverviewData, ShippingData, AftersalesData, FinanceData, ShopData, RepairEfficiencyData, ProductIssueData,
} from '../types'

const COLORS = ['#2563eb', '#16a34a', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const cardStyle = "bg-white border border-gray-100 rounded-xl p-5"
const chartH = 300

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</p>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | undefined>(undefined)
  const [tab, setTab] = useState<'overview' | 'shipping' | 'aftersales' | 'repair_efficiency' | 'finance' | 'shop' | 'product_issues'>('overview')
  const [loading, setLoading] = useState(false)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [shipping, setShipping] = useState<ShippingData | null>(null)
  const [aftersales, setAftersales] = useState<AftersalesData | null>(null)
  const [repairEfficiency, setRepairEfficiency] = useState<RepairEfficiencyData | null>(null)
  const [finance, setFinance] = useState<FinanceData | null>(null)
  const [shop, setShop] = useState<ShopData | null>(null)
  const [productIssues, setProductIssues] = useState<ProductIssueData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, sh, af, re, fi, sp, pi] = await Promise.all([
        getReportOverview(year, month),
        getReportShipping(year, month),
        getReportAftersales(year, month),
        getReportRepairEfficiency(year, month),
        getReportFinance(year, month),
        getReportShop(year, month),
        getReportProductIssues(year, month),
      ])
      setOverview(ov)
      setShipping(sh)
      setAftersales(af)
      setRepairEfficiency(re)
      setFinance(fi)
      setShop(sp)
      setProductIssues(pi)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  const tabs = [
    { key: 'overview', label: '总览', icon: BarChart3 },
    { key: 'shipping', label: '发货分析', icon: Package },
    { key: 'aftersales', label: '售后分析', icon: RotateCcw },
    { key: 'repair_efficiency', label: '维修分析', icon: Wrench },
    { key: 'product_issues', label: '产品故障', icon: AlertTriangle },
    { key: 'finance', label: '财务分析', icon: DollarSign },
    { key: 'shop', label: '店铺分析', icon: Store },
  ] as const

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-gray-800">
          <TrendingUp size={20} />
          <h2 className="text-xl font-semibold">数据报表</h2>
          {loading && <span className="text-xs text-gray-400 ml-2">加载中...</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={month ?? ''} onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="">全年</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && overview && <OverviewTab data={overview} />}
      {tab === 'shipping' && shipping && <ShippingTab data={shipping} />}
      {tab === 'aftersales' && aftersales && <AftersalesTab data={aftersales} />}
      {tab === 'repair_efficiency' && repairEfficiency && <RepairEfficiencyTab data={repairEfficiency} />}
      {tab === 'finance' && finance && <FinanceTab data={finance} />}
      {tab === 'shop' && shop && <ShopTab data={shop} />}
      {tab === 'product_issues' && productIssues && <ProductIssuesTab data={productIssues} />}
    </div>
  )
}

// ── 总览 ─────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-5">
      {/* 指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.cards.map((c, i) => (
          <div key={i} className={cardStyle}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-gray-800">{typeof c.value === 'number' ? c.value.toLocaleString() : c.value}{c.label === '退货率' ? '%' : ''}</p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {c.change > 0 ? <ChevronUp size={12} className="text-green-500" /> : c.change < 0 ? <ChevronDown size={12} className="text-red-500" /> : null}
              <span className={c.change > 0 ? 'text-green-600' : c.change < 0 ? 'text-red-600' : 'text-gray-400'}>
                {c.change > 0 ? '+' : ''}{c.change}%
              </span>
              <span className="text-gray-400">环比</span>
            </div>
          </div>
        ))}
      </div>

      {/* 发货量 vs 退货率 */}
      <div className={cardStyle}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4">发货量 vs 退货率（月度对比）</h3>
        <ResponsiveContainer width="100%" height={chartH}>
          <ComposedChart data={data.shipping_vs_return}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="shipping_qty" fill="#2563eb" radius={[4, 4, 0, 0]} name="发货量" />
            <Bar yAxisId="left" dataKey="return_qty" fill="#ef4444" radius={[4, 4, 0, 0]} name="退货量" />
            <Line yAxisId="right" type="monotone" dataKey="return_rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="退货率%" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 模块分布 */}
      {data.module_distribution.length > 0 && (
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">业务模块分布</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={data.module_distribution} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, value }: any) => `${name}: ${value}`}>
                {data.module_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── 发货分析 ─────────────────────────────────────────────────────

function ShippingTab({ data }: { data: ShippingData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 发货量趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">发货量趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <LineChart data={data.qty_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="发货量" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 金额趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">金额趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <LineChart data={data.amount_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="order_amount" stroke="#2563eb" strokeWidth={2} name="订单金额" />
              <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} name="产品成本" />
              <Line type="monotone" dataKey="shipping_fee" stroke="#f59e0b" strokeWidth={2} name="运费" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 利润分析 */}
      <div className={cardStyle}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4">利润分析</h3>
        <p className="text-xs text-gray-400 -mt-3 mb-3">已过滤：拦截快递 / 已撕单 / 已取消 / 已退货</p>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={data.profit_trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Bar dataKey="cost" stackId="a" fill="#ef4444" name="产品成本" />
            <Bar dataKey="gift_cost" stackId="a" fill="#f59e0b" name="礼品成本" />
            <Bar dataKey="cashback" stackId="a" fill="#8b5cf6" name="返现" />
            <Bar dataKey="shipping_fee" stackId="a" fill="#06b6d4" name="运费" />
            <Bar dataKey="profit" stackId="a" fill="#16a34a" name="利润" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 热销配置 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">热销配置 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.top_configs} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="销量" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 热销型号 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">热销型号 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.top_models} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} name="销量" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 客户颜色偏好 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">产品颜色偏好</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.color_preference} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="销量">
                {data.color_preference.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 售后分析 ─────────────────────────────────────────────────────

function AftersalesTab({ data }: { data: AftersalesData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 退换趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">退货 vs 换货月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.return_exchange_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="return_count" fill="#ef4444" radius={[4, 4, 0, 0]} name="退货" />
              <Bar dataKey="exchange_count" fill="#2563eb" radius={[4, 4, 0, 0]} name="换货" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 退换货率趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">退换货率月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <LineChart data={data.return_rate_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="return_rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="退换货率" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 退货原因 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">退货原因 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.return_reasons} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="次数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 退换型号 Top 10 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">退换型号 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.top_return_models} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} name="退换量" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 维修趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">维修量月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <LineChart data={data.repair_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="维修量" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 货损 & 收费率 & 处理周期 */}
        <div className={cardStyle + ' flex flex-col justify-center'}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">关键指标</h3>
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{data.damage_count}</p>
              <p className="text-xs text-gray-500 mt-1">货损记录数</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">¥{data.damage_amount.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">货损金额</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{data.repair_charge_rate}%</p>
              <p className="text-xs text-gray-500 mt-1">维修收费率</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{data.avg_process_days} <span className="text-sm font-normal text-gray-400">天</span></p>
              <p className="text-xs text-gray-500 mt-1">平均处理周期</p>
            </div>
          </div>
        </div>

        {/* 售后状态 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">售后状态分布</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={data.status_distribution} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, value }: any) => `${name}: ${value}`}>
                {data.status_distribution.map((_, i) => <Cell key={i} fill={['#f59e0b', '#2563eb', '#16a34a'][i % 3]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 维修效率 ─────────────────────────────────────────────────────

function RepairEfficiencyTab({ data }: { data: RepairEfficiencyData }) {
  return (
    <div className="space-y-5">
      {/* 指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={cardStyle}>
          <p className="text-xs text-gray-500 mb-1">总维修量</p>
          <p className="text-2xl font-bold text-gray-800">{data.repair_trend.reduce((s, t) => s + t.count, 0)}</p>
        </div>
        <div className={cardStyle}>
          <p className="text-xs text-gray-500 mb-1">待维修</p>
          <p className="text-2xl font-bold text-orange-600">{data.status_distribution.find(s => s.name === '待维修')?.value || 0}</p>
        </div>
        <div className={cardStyle}>
          <p className="text-xs text-gray-500 mb-1">已完成</p>
          <p className="text-2xl font-bold text-blue-600">{data.status_distribution.find(s => s.name === '已完成')?.value || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 维修量趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">维修量月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.repair_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="维修量" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 状态分布 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">维修状态分布</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={data.status_distribution} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, value }: any) => `${name}: ${value}`}>
                {data.status_distribution.map((_, i) => <Cell key={i} fill={['#f59e0b', '#2563eb', '#16a34a'][i % 3]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 按型号 Top 10 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">维修型号 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.top_models} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="维修量" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 按故障原因 Top 10 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">故障原因 Top 10</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.top_reasons} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="次数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 财务分析 ─────────────────────────────────────────────────────

function FinanceTab({ data }: { data: FinanceData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* 收支趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">收入 vs 支出月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.income_expense_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="income" fill="#16a34a" radius={[4, 4, 0, 0]} name="收入" />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="支出" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 返现趋势 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">返现金额月度趋势</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <LineChart data={data.cashback_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="返现金额" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 返现原因 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">返现原因分布</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={data.cashback_reasons} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, value }: any) => `${name}: ¥${value}`}>
                {data.cashback_reasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 开票状态 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">开票申请状态</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie data={data.invoice_status} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={100}
                label={({ name, value }: any) => `${name}: ${value}`}>
                {data.invoice_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 发票金额 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">发票类型金额</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.invoice_type_amount}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="金额" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 店铺分析 ─────────────────────────────────────────────────────

function ShopTab({ data }: { data: ShopData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* 发货量排名 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">店铺发货量排名</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.shipping_rank} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} name="发货量" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 退货率排名 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">店铺退货率排名</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.return_rate_rank} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="退货率%" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 销售额排名 */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-600 mb-4">店铺销售额排名</h3>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={data.amount_rank} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} name="销售额" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 详情表格 */}
      <div className={cardStyle}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4">店铺数据明细</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-4 py-2 text-left font-medium">店铺</th>
                <th className="px-4 py-2 text-right font-medium">发货量</th>
                <th className="px-4 py-2 text-right font-medium">退货量</th>
                <th className="px-4 py-2 text-right font-medium">退货率</th>
                <th className="px-4 py-2 text-right font-medium">销售额</th>
                <th className="px-4 py-2 text-right font-medium">维修量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.detail_table.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无数据</td></tr>
              ) : data.detail_table.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.shop_name}</td>
                  <td className="px-4 py-2 text-right">{r.shipping_qty}</td>
                  <td className="px-4 py-2 text-right text-red-600">{r.return_qty}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={r.return_rate > 10 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {r.return_rate}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">¥{r.order_amount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{r.repair_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProductIssuesTab({ data }: { data: ProductIssueData }) {
  const top10 = data.models.slice(0, 10)
  const chartData = top10.map(m => ({
    name: m.model.length > 8 ? m.model.slice(0, 8) + '...' : m.model,
    维修: m.repair_count,
    退货: m.return_count,
    换货: m.exchange_count,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart: top models */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">故障型号 Top 10</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="维修" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="退货" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="换货" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart: reason distribution */}
        <div className={cardStyle}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">故障原因分布</h3>
          {data.reason_distribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={chartH}>
              <PieChart>
                <Pie
                  data={data.reason_distribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {data.reason_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className={cardStyle}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">型号明细</h3>
        {data.models.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">暂无数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">型号</th>
                  <th className="px-4 py-2 font-medium text-right">维修</th>
                  <th className="px-4 py-2 font-medium text-right">退货</th>
                  <th className="px-4 py-2 font-medium text-right">换货</th>
                  <th className="px-4 py-2 font-medium text-right">合计</th>
                  <th className="px-4 py-2 font-medium">主要故障</th>
                </tr>
              </thead>
              <tbody>
                {data.models.map((m, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{m.model}</td>
                    <td className="px-4 py-2 text-right">{m.repair_count}</td>
                    <td className="px-4 py-2 text-right">{m.return_count}</td>
                    <td className="px-4 py-2 text-right">{m.exchange_count}</td>
                    <td className="px-4 py-2 text-right font-medium">{m.repair_count + m.return_count + m.exchange_count}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {m.top_reasons.map((r, j) => (
                          <span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {r.name} ({r.value})
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
