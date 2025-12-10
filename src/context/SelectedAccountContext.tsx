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

  // Hidratar: obtener cuenta del usuario por FID y usarla por defecto
  useEffect(() => {
    const initAccount = async () => {
      try {
        // Obtener el FID del usuario logueado
        const meRes = await fetch('/api/me')
        const meData = meRes.ok ? await meRes.json() : {}
        const userFid = meData.fid

        // Obtener cuentas disponibles
        const accountsRes = await fetch('/api/accounts')
        const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] }
        const accounts = accountsData.accounts || []

        // Buscar la cuenta del usuario (mismo FID)
        const userAccount = accounts.find((a: { fid: number }) => a.fid === userFid)
        
        // Por defecto: siempre la cuenta del usuario
        const accountId = userAccount?.id || accounts[0]?.id || null
        
        setSelectedAccountIdState(accountId)
        setIsHydrated(true)
      } catch {
        // Fallback al comportamiento anterior
        const stored = localStorage.getItem(STORAGE_KEY)
        setSelectedAccountIdState(stored || defaultAccountId)
        setIsHydrated(true)
      }
    }
    
    initAccount()
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
