import { useState, useEffect, useCallback } from 'react'
import type { User } from '../types'
import { getMe } from '../api/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
    const token = localStorage.getItem('token')
    if (token) {
      getMe().then((res) => {
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      }).catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const isAdmin = user?.role === 'admin'
  const isAdminOrTech = user?.role === 'admin' || user?.role === 'technician'
  const permissions = user?.permissions || []

  const hasPermission = useCallback((...perms: string[]) => {
    if (isAdmin) return true  // admin 拥有全部权限
    return perms.some(p => permissions.includes(p))
  }, [isAdmin, permissions])

  return { user, setUser, loading, isAdmin, isAdminOrTech, permissions, hasPermission }
}
