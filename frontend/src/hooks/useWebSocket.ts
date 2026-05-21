import { useEffect, useRef, useCallback, useState } from 'react'
import { getUnreadCount } from '../api/notifications'

export function useWebSocket(userId: number | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()
  const [showPanel, setShowPanel] = useState(false)

  const fetchUnread = useCallback(async () => {
    if (!userId) return
    try {
      const res = await getUnreadCount()
      setUnreadCount(res.data.count)
    } catch { /* ignore */ }
  }, [userId])

  const connect = useCallback(() => {
    if (!userId) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/${userId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'notification') {
          setUnreadCount((prev) => prev + 1)
          setNotifications((prev) => [msg.data, ...prev])
        }
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [userId])

  useEffect(() => {
    fetchUnread()
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect, fetchUnread])

  const refreshUnread = useCallback(async () => {
    await fetchUnread()
    setNotifications([])
  }, [fetchUnread])

  return { unreadCount, setUnreadCount, notifications, showPanel, setShowPanel, refreshUnread }
}
