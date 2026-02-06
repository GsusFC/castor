'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Account } from '@/components/compose/types'

/**
 * V2 accounts hook — accepts server-provided data instead of fetching on mount.
 *
 * v1's useAccounts made 3 API calls on mount (/api/accounts/sync-pro, /api/me, /api/accounts).
 * In v2, accounts are fetched in the server component and passed as props, eliminating
 * those 3 roundtrips and providing instant rendering.
 */

interface UseAccountsV2Options {
  /** Accounts from the server (already filtered/sorted) */
  accounts: Account[]
  /** The user's FID for identifying their own account */
  userFid: number
  /** Override the default selected account */
  defaultAccountId?: string | null
}

interface UseAccountsV2Return {
  accounts: Account[]
  selectedAccountId: string | null
  selectedAccount: Account | undefined
  isLoading: false // Never loading — data is from server
  setSelectedAccountId: (id: string | null) => void
}

export function useAccountsV2({
  accounts,
  userFid,
  defaultAccountId,
}: UseAccountsV2Options): UseAccountsV2Return {
  // Sort: user's own account (matching FID) first
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aIsOwn = a.fid === userFid
      const bIsOwn = b.fid === userFid
      if (aIsOwn && !bIsOwn) return -1
      if (!aIsOwn && bIsOwn) return 1
      return 0
    })
  }, [accounts, userFid])

  // Default: provided ID, user's own account, or first account
  const initialId = useMemo(() => {
    if (defaultAccountId && sortedAccounts.some(a => a.id === defaultAccountId)) {
      return defaultAccountId
    }
    const ownAccount = sortedAccounts.find(a => a.fid === userFid)
    return ownAccount?.id || sortedAccounts[0]?.id || null
  }, [defaultAccountId, sortedAccounts, userFid])

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(initialId)

  const selectedAccount = sortedAccounts.find(a => a.id === selectedAccountId)

  const setAccount = useCallback((id: string | null) => {
    setSelectedAccountId(id)
  }, [])

  return {
    accounts: sortedAccounts,
    selectedAccountId,
    selectedAccount,
    isLoading: false,
    setSelectedAccountId: setAccount,
  }
}
