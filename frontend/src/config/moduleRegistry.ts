/**
 * 模块统一注册表 v1.0（前端版）
 * 与 backend/models/module_registry.py 保持同步。
 * 这个文件是前端的 Single Source of Truth。
 */

import {
  RotateCcw, Wrench, Gift, DollarSign, PackageCheck, Ticket, Laptop,
  type LucideIcon,
} from 'lucide-react'

// ============================================================
// 类型定义
// ============================================================

export interface FieldDefinition {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
  required: boolean
  sortOrder: number
}

export interface ModuleDefinition {
  moduleKey: string
  displayName: string
  icon: string           // 对应 lucide-react 图标名
  routePath: string
  navigationGroup: string
  permissions: string[]
  fields: FieldDefinition[]
  sortOrder: number
  enabledByDefault: boolean
}

// ============================================================
// 图标库 - 把字符串映射到实际组件
// ============================================================

export const ICON_MAP: Record<string, LucideIcon> = {
  RotateCcw, Wrench, Gift, DollarSign, PackageCheck, Ticket, Laptop,
}

// ============================================================
// 注册表
// ============================================================

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  tickets: {
    moduleKey: 'tickets',
    displayName: '工单系统',
    icon: 'Ticket',
    routePath: '/tickets',
    navigationGroup: '客服业务',
    permissions: ['tickets:view'],
    sortOrder: 0,
    enabledByDefault: true,
    fields: [],
  },
  return_exchange: {
    moduleKey: 'return_exchange',
    displayName: '退换登记',
    icon: 'RotateCcw',
    routePath: '/return-exchange',
    navigationGroup: '客服业务',
    permissions: ['return_exchange:view'],
    sortOrder: 1,
    enabledByDefault: true,
    fields: [
      { name: 'shop_name', label: '店铺', type: 'text', required: false, sortOrder: 0 },
      { name: 'model', label: '型号', type: 'text', required: false, sortOrder: 1 },
      { name: 'config', label: '配置', type: 'text', required: false, sortOrder: 2 },
      { name: 'size', label: '规格', type: 'text', required: false, sortOrder: 3 },
      { name: 'computer_price', label: '电脑价格', type: 'number', required: false, sortOrder: 4 },
      { name: 'accessories', label: '配件', type: 'text', required: false, sortOrder: 5 },
      { name: 'accessories_price', label: '配件价格', type: 'number', required: false, sortOrder: 6 },
      { name: 'return_tracking', label: '寄回单号', type: 'text', required: false, sortOrder: 7 },
      { name: 'send_tracking', label: '寄出单号', type: 'text', required: false, sortOrder: 8 },
      { name: 'shipping_fee', label: '运费', type: 'number', required: false, sortOrder: 9 },
      { name: 'record_type', label: '类型', type: 'select', options: ['退货', '换货', '升级配置'], required: false, sortOrder: 10 },
    ],
  },
  repair: {
    moduleKey: 'repair',
    displayName: '维修登记',
    icon: 'Wrench',
    routePath: '/repair',
    navigationGroup: '客服业务',
    permissions: ['repair:view'],
    sortOrder: 2,
    enabledByDefault: true,
    fields: [
      { name: 'model', label: '型号', type: 'text', required: false, sortOrder: 1 },
      { name: 'config', label: '配置', type: 'text', required: false, sortOrder: 2 },
      { name: 'computer_price', label: '电脑价格', type: 'number', required: false, sortOrder: 3 },
      { name: 'accessories', label: '配件', type: 'text', required: false, sortOrder: 4 },
      { name: 'return_tracking', label: '寄回单号', type: 'text', required: false, sortOrder: 5 },
      { name: 'send_tracking', label: '寄出单号', type: 'text', required: false, sortOrder: 6 },
      { name: 'shipping_fee', label: '运费', type: 'number', required: false, sortOrder: 7 },
    ],
  },
  gift: {
    moduleKey: 'gift',
    displayName: '发货登记',
    icon: 'Gift',
    routePath: '/gifts',
    navigationGroup: '仓储业务',
    permissions: ['gifts:view'],
    sortOrder: 1,
    enabledByDefault: true,
    fields: [
      { name: 'shop_name', label: '店铺', type: 'text', required: false, sortOrder: 0 },
      { name: 'model', label: '型号', type: 'text', required: false, sortOrder: 1 },
      { name: 'config', label: '配置', type: 'text', required: false, sortOrder: 2 },
      { name: 'color', label: '颜色', type: 'text', required: false, sortOrder: 3 },
      { name: 'size', label: '规格', type: 'text', required: false, sortOrder: 4 },
      { name: 'cost', label: '成本', type: 'number', required: false, sortOrder: 5 },
      { name: 'order_amount', label: '订单金额', type: 'number', required: false, sortOrder: 6 },
      { name: 'send_tracking', label: '寄出单号', type: 'text', required: false, sortOrder: 7 },
      { name: 'shipping_fee', label: '运费', type: 'number', required: false, sortOrder: 8 },
      { name: 'ship_date', label: '出货日期', type: 'date', required: false, sortOrder: 9 },
    ],
  },
  gift_cashback: {
    moduleKey: 'gift_cashback',
    displayName: '返现登记',
    icon: 'DollarSign',
    routePath: '/gift-cashback',
    navigationGroup: '客服业务',
    permissions: ['gift_cashback:view'],
    sortOrder: 2,
    enabledByDefault: true,
    fields: [
      { name: 'cashback_amount', label: '返现金额', type: 'number', required: false, sortOrder: 1 },
      { name: 'reason', label: '原因', type: 'text', required: false, sortOrder: 2 },
      { name: 'applicant', label: '申请人', type: 'text', required: false, sortOrder: 3 },
    ],
  },
  gift_resend: {
    moduleKey: 'gift_resend',
    displayName: '礼品补发',
    icon: 'PackageCheck',
    routePath: '/gift-resend',
    navigationGroup: '客服业务',
    permissions: ['gift_resend:view'],
    sortOrder: 3,
    enabledByDefault: true,
    fields: [
      { name: 'shop_name', label: '店铺', type: 'text', required: false, sortOrder: 1 },
      { name: 'type', label: '类型', type: 'text', required: false, sortOrder: 2 },
      { name: 'gift_detail', label: '礼品明细', type: 'text', required: false, sortOrder: 3 },
      { name: 'express_company', label: '快递公司', type: 'text', required: false, sortOrder: 4 },
      { name: 'tracking_no', label: '快递单号', type: 'text', required: false, sortOrder: 5 },
    ],
  },
  products: {
    moduleKey: 'products',
    displayName: '产品概览',
    icon: 'Laptop',
    routePath: '/products',
    navigationGroup: '主要功能',
    permissions: ['products:view'],
    sortOrder: 3,
    enabledByDefault: true,
    fields: [],
  },
}
