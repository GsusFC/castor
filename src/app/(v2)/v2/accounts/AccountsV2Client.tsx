'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Users, Star, Shield } from 'lucide-react'
import { AppHeader } from '@/components/v2/AppHeader'
import { AccountCard } from '@/app/(app)/accounts/AccountCard'
import { AddAccountButton } from '@/app/(app)/accounts/add-account-button'
import { ConnectAccountModal } from '@/components/accounts/ConnectAccountModal'

interface AccountOwner {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface Account {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  type: 'personal' | 'business'
  signerStatus: 'pending' | 'approved' | 'revoked'
  isPremium: boolean
  ownerId: string | null
  owner?: AccountOwner | null
}

interface AccountsV2ClientProps {
  user: {
    userId: string
    username: string
    displayName: string | null
    pfpUrl: string | null
    role: string
  }
  accounts: Account[]
}

export function AccountsV2Client({ user, accounts }: AccountsV2ClientProps) {
  const router = useRouter()
  const [connectOpen, setConnectOpen] = useState(false)

  // Open modal if ?connect=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connect') === 'true') {
      setConnectOpen(true)
      router.replace('/v2/accounts', { scroll: false })
    }
  }, [router])

  const handleSuccess = () => {
    router.refresh()
  }

  const proAccounts = accounts.filter(a => a.isPremium)
  const standardAccounts = accounts.filter(a => !a.isPremium)

  return (
    <>
      <AppHeader
        user={{
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
        }}
      />

      <main className="max-w-4xl xl:max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold">Manage accounts</h1>
              <p className="text-sm text-muted-foreground">{accounts.length} connected</p>
            </div>
          </div>
          <AddAccountButton />
        </div>

        {/* Content */}
        <div className="space-y-6">
          {accounts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No accounts connected</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Connect your Farcaster accounts to start scheduling casts and managing your presence.
              </p>
              <AddAccountButton />
            </div>
          ) : (
            <>
              {/* Pro Accounts */}
              {proAccounts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-purple-500" />
                    <h2 className="text-sm font-medium text-muted-foreground">Pro accounts</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                    {proAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        currentUserId={user.userId}
                        isAdmin={user.role === 'admin'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Accounts */}
              {standardAccounts.length > 0 && (
                <div>
                  {proAccounts.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium text-muted-foreground">Standard accounts</h2>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                    {standardAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        currentUserId={user.userId}
                        isAdmin={user.role === 'admin'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Connect account modal */}
        <ConnectAccountModal
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onSuccess={handleSuccess}
        />
      </main>
    </>
  )
}
