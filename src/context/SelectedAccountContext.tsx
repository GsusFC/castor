'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const STORAGE_KEY = 'castor_selected_account'

interface SelectedAccountContextType {
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
}

const SelectedAccountContext = createContext<SelectedAccountContextType | undefined>(undefined)

export function SelectedAccountProvider({ 
  children,
  defaultAccountId = null 
}: { 
  children: ReactNode
  defaultAccountId?: string | null
}) {
  // Iniciar con null para evitar hydration mismatch
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const setSelectedAccountId = useCallback((id: string | null) => {
    setSelectedAccountIdState(id)
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Hidratar desde localStorage solo en el cliente
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setSelectedAccountIdState(stored || defaultAccountId)
    setIsHydrated(true)
  }, [defaultAccountId])

  return (
    <SelectedAccountContext.Provider value={{ selectedAccountId, setSelectedAccountId }}>
      {children}
    </SelectedAccountContext.Provider>
  )
}

export function useSelectedAccount() {
  const context = useContext(SelectedAccountContext)
  if (context === undefined) {
    throw new Error('useSelectedAccount must be used within a SelectedAccountProvider')
  }
  return context
}
