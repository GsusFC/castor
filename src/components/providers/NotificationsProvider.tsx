'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useNotificationStream } from '@/hooks'
import { NotificationsProviderContext } from '@/context/NotificationsContext'

const NOTIFICATIONS_UNREAD_STORAGE_KEY = 'castor:notifications:unread'

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(NOTIFICATIONS_UNREAD_STORAGE_KEY)
    const next = raw ? Number.parseInt(raw, 10) : 0
    if (!Number.isNaN(next) && next > 0) {
      setUnreadCount(next)
    }
  }, [])

  const resetUnread = useCallback(() => {
    setUnreadCount(0)
    window.localStorage.setItem(NOTIFICATIONS_UNREAD_STORAGE_KEY, '0')
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    setUnreadCount(0)
    window.localStorage.setItem(NOTIFICATIONS_UNREAD_STORAGE_KEY, '0')
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        setUnreadCount(0)
        window.localStorage.setItem(NOTIFICATIONS_UNREAD_STORAGE_KEY, '0')
      }
      return next
    })
  }, [])

  const handleRealtimeNotification = useCallback((notification: any) => {
    // Ignorar eventos de conexión
    if (notification.type === 'connected') return

    // Invalidar queries para refrescar UI
    queryClient.invalidateQueries({ queryKey: ['notifications'] })

    // No incrementar contador si estamos en la página de notificaciones
    if (pathname === '/notifications' || isOpen) return

    // Incrementar contador de no leídas
    setUnreadCount((prev) => {
      const next = Math.min(prev + 1, 99)
      window.localStorage.setItem(NOTIFICATIONS_UNREAD_STORAGE_KEY, String(next))
      return next
    })
  }, [isOpen, pathname, queryClient])

  useNotificationStream({ onNotification: handleRealtimeNotification })

  const value = useMemo(
    () => ({ unreadCount, resetUnread, isOpen, open, close, toggle }),
    [close, isOpen, open, resetUnread, toggle, unreadCount]
  )

  return (
    <NotificationsProviderContext.Provider value={value}>
      {children}
    </NotificationsProviderContext.Provider>
  )
}
