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
      // Sincronizar estado Pro primero
      await fetch('/api/accounts/sync-pro', { method: 'POST' }).catch(() => {})

      // Obtener FID del usuario logueado (su cuenta propia)
      const meRes = await fetch('/api/me')
      const meData = meRes.ok ? await meRes.json() : {}
      const userFid = meData.fid || null

      const res = await fetch('/api/accounts')
      if (!res.ok) throw new Error('Error al cargar cuentas')

      const data = await res.json()
      let accountsList: Account[] = data.accounts || []

      if (onlyApproved) {
        accountsList = accountsList.filter(a => a.signerStatus === 'approved')
      }

      // Ordenar: cuenta del usuario (mismo FID) primero, luego el resto
      accountsList.sort((a, b) => {
        const aIsOwn = a.fid === userFid
        const bIsOwn = b.fid === userFid
        if (aIsOwn && !bIsOwn) return -1
        if (!aIsOwn && bIsOwn) return 1
        return 0
      })

      setAccounts(accountsList)

      // Seleccionar cuenta por defecto: la del usuario (mismo FID)
      if (defaultAccountId && accountsList.some(a => a.id === defaultAccountId)) {
        setSelectedAccountId(defaultAccountId)
      } else if (accountsList.length > 0) {
        // Buscar la cuenta del usuario (mismo FID que el login)
        const ownAccount = accountsList.find(a => a.fid === userFid)
        setSelectedAccountId(ownAccount?.id || accountsList[0].id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      console.error('Error loading accounts:', err)
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAccountId, onlyApproved])

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
