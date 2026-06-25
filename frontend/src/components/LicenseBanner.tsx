import { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Clock } from 'lucide-react'
import { getLicenseStatus } from '../api/license'
import type { LicenseStatus } from '../api/license'

export default function LicenseBanner() {
  const [license, setLicense] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    getLicenseStatus().then(setLicense).catch(() => {})
  }, [])

  if (!license || license.status === 'valid' || license.status === 'dev') return null

  const configs: Record<string, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
    expiring: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Clock },
    expired: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: AlertTriangle },
    locked: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: Lock },
  }

  const cfg = configs[license.status]
  if (!cfg) return null
  const Icon = cfg.icon

  return (
    <div className={`${cfg.bg} ${cfg.border} border-b px-4 py-2.5`}>
      <div className="flex items-center gap-2 max-w-7xl mx-auto">
        <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.text}`} />
        <span className={`text-sm ${cfg.text}`}>{license.message}</span>
        {license.status === 'expiring' && (
          <span className={`ml-auto text-xs ${cfg.text}`}>
            剩余 {license.days_remaining} 天
          </span>
        )}
      </div>
    </div>
  )
}
