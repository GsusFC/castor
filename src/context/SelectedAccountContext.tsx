'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(defaultAccountId)

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
