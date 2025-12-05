'use client'

import { useState, useEffect, useCallback } from 'react'
import { Account } from '@/components/compose/types'

interface UseAccountsOptions {
  defaultAccountId?: string | null
  onlyApproved?: boolean
}

interface UseAccountsReturn {
  accounts: Account[]
  selectedAccountId: string | null
  selectedAccount: Account | undefined
  isLoading: boolean
  error: string | null
  setSelectedAccountId: (id: string | null) => void
  refetch: () => Promise<void>
}

export const useAccounts = (options: UseAccountsOptions = {}): UseAccountsReturn => {
  const { defaultAccountId = null, onlyApproved = true } = options

  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(defaultAccountId)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/accounts')
      if (!res.ok) throw new Error('Error al cargar cuentas')

      const data = await res.json()
      let accountsList: Account[] = data.accounts || []

      if (onlyApproved) {
        accountsList = accountsList.filter(a => a.signerStatus === 'approved')
      }

      setAccounts(accountsList)

      // Seleccionar cuenta por defecto
      if (defaultAccountId && accountsList.some(a => a.id === defaultAccountId)) {
        setSelectedAccountId(defaultAccountId)
      } else if (accountsList.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accountsList[0].id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      console.error('Error loading accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [defaultAccountId, onlyApproved, selectedAccountId])

  useEffect(() => {
    fetchAccounts()
  }, []) // Solo al montar

  // Actualizar selección si cambia defaultAccountId
  useEffect(() => {
    if (defaultAccountId && accounts.some(a => a.id === defaultAccountId)) {
      setSelectedAccountId(defaultAccountId)
    }
  }, [defaultAccountId, accounts])

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  return {
    accounts,
    selectedAccountId,
    selectedAccount,
    isLoading,
    error,
    setSelectedAccountId,
    refetch: fetchAccounts,
  }
}
