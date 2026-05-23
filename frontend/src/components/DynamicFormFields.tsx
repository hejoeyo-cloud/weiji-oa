import { useEffect, useState } from 'react'
import { getModuleFieldConfigs } from '../api/moduleConfig'
import type { ModuleFieldConfig } from '../types'

interface Props {
  moduleKey: string
  value: Record<string, any>
  onChange: (data: Record<string, any>) => void
  readonly?: boolean
}

export default function DynamicFormFields({ moduleKey, value, onChange, readonly }: Props) {
  const [fields, setFields] = useState<ModuleFieldConfig[]>([])
  const data = value || {}

  useEffect(() => {
    getModuleFieldConfigs(moduleKey).then(setFields).catch(() => setFields([]))
  }, [moduleKey])

  const handleChange = (key: string, val: string) => {
    onChange({ ...data, [key]: val })
  }

  if (fields.length === 0) return null

  const inputStyle = {
    border: '1.5px solid #e5e5e5',
    background: readonly ? '#f9fafb' : '#fff',
    color: readonly ? '#6b7280' : '#1f1f1f',
    cursor: readonly ? 'not-allowed' : 'text',
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.filter(f => f.enabled).map(f => (
        <div key={f.id}>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {f.field_label} {f.required && <span className="text-red-400">*</span>}
          </label>
          {f.field_type === 'select' ? (
            <select
              value={data[f.field_key] || ''}
              onChange={e => handleChange(f.field_key, e.target.value)}
              disabled={readonly}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
            >
              <option value="">--</option>
              {(() => {
                try { return JSON.parse(f.field_options || '[]').map((o: string) => (
                  <option key={o} value={o}>{o}</option>
                )) } catch { return null }
              })()}
            </select>
          ) : f.field_type === 'date' ? (
            <input
              type="date"
              value={data[f.field_key] || ''}
              onChange={e => handleChange(f.field_key, e.target.value)}
              disabled={readonly}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
            />
          ) : f.field_type === 'number' ? (
            <input
              type="number"
              value={data[f.field_key] || ''}
              onChange={e => handleChange(f.field_key, e.target.value)}
              disabled={readonly}
              placeholder={readonly ? '-' : ''}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
            />
          ) : (
            <input
              type="text"
              value={data[f.field_key] || ''}
              onChange={e => handleChange(f.field_key, e.target.value)}
              disabled={readonly}
              placeholder={readonly ? '-' : ''}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
            />
          )}
        </div>
      ))}
    </div>
  )
}
