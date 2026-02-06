'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react'

const STORAGE_KEY = 'castor_selected_account'

interface SelectedAccountV2ContextType {
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
}

const SelectedAccountV2Context = createContext<SelectedAccountV2ContextType | undefined>(undefined)

/**
 * V2-optimized SelectedAccountProvider.
 *
 * Unlike v1's version, this does NOT make /api/me or /api/accounts calls on mount.
 * Instead, it receives the defaultAccountId from the server component (which already
 * fetched accounts), eliminating 2 redundant API roundtrips on every page load.
 */
export function SelectedAccountV2Provider({
  children,
  defaultAccountId = null,
}: {
  children: ReactNode
  defaultAccountId?: string | null
}) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(() => {
    // SSR-safe: start with null, hydrate in useEffect
    return null
  })

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

  // Hydrate from localStorage or fall back to server-provided default
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    setSelectedAccountIdState(stored || defaultAccountId)
  }, [defaultAccountId])

  const contextValue = useMemo(
    () => ({ selectedAccountId, setSelectedAccountId }),
    [selectedAccountId, setSelectedAccountId]
  )

  return (
    <SelectedAccountV2Context.Provider value={contextValue}>
      {children}
    </SelectedAccountV2Context.Provider>
  )
}

export function useSelectedAccountV2() {
  const context = useContext(SelectedAccountV2Context)
  if (context === undefined) {
    throw new Error('useSelectedAccountV2 must be used within a SelectedAccountV2Provider')
  }
  return context
}
