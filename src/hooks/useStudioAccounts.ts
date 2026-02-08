import { useMemo } from 'react'
import type { SerializedAccount } from '@/types'

type UseStudioAccountsArgs = {
  accounts: SerializedAccount[]
  userFid: number
}

export function useStudioAccounts({ accounts, userFid }: UseStudioAccountsArgs) {
  const approvedAccounts = useMemo(
    () => accounts.filter((a) => a.signerStatus === 'approved'),
    [accounts]
  )

  const defaultAccountId = useMemo(() => {
    const userAccount = approvedAccounts.find((a) => a.fid === userFid)
    return userAccount?.id || approvedAccounts[0]?.id || null
  }, [approvedAccounts, userFid])

  const headerAccounts = useMemo(
    () => approvedAccounts.map((a) => ({ id: a.id, username: a.username, pfpUrl: a.pfpUrl })),
    [approvedAccounts]
  )

  const filterAccounts = useMemo(
    () => approvedAccounts.map((a) => ({ id: a.id, username: a.username })),
    [approvedAccounts]
  )

  return {
    approvedAccounts,
    defaultAccountId,
    headerAccounts,
    filterAccounts,
  }
}
