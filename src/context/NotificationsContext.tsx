'use client'

import { createContext, useContext } from 'react'

type NotificationsContextValue = {
  unreadCount: number
  resetUnread: () => void
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return ctx
}

export const NotificationsProviderContext = NotificationsContext
