'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, Link2, Unlink2, RefreshCw, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type TypefullyConnection = {
  id: string
  apiKeyLabel: string | null
  typefullyUserId: number | null
  typefullyUserName: string | null
  typefullyUserEmail: string | null
  lastValidatedAt: string | null
  updatedAt: string
}

type TypefullyAccountOption = {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  type: 'personal' | 'business'
}

type TypefullySocialSet = {
  id: string
  socialSetId: number
  username: string
  name: string
  profileImageUrl: string
  teamId: string | null
  teamName: string | null
  connectedPlatforms: string[]
  linkedAccount: {
    id: string
    username: string
    displayName: string | null
    pfpUrl: string | null
  } | null
  lastSyncedAt: string
}

interface TypefullyIntegrationSectionProps {
  title?: string
  description?: string
  emptyAccountsHint?: string
}

export function TypefullyIntegrationSection({
  title = 'Typefully Integration',
  description = 'Connect Typefully and map each social set to a Castor account.',
  emptyAccountsHint = 'You don&apos;t have any Castor accounts available to map. Add a Farcaster account first.',
}: TypefullyIntegrationSectionProps) {
  const [typefullyApiKey, setTypefullyApiKey] = useState('')
  const [typefullyConnection, setTypefullyConnection] = useState<TypefullyConnection | null>(null)
  const [typefullySocialSets, setTypefullySocialSets] = useState<TypefullySocialSet[]>([])
  const [typefullyAccounts, setTypefullyAccounts] = useState<TypefullyAccountOption[]>([])
  const [isLoadingTypefully, setIsLoadingTypefully] = useState(true)
  const [isSavingTypefully, setIsSavingTypefully] = useState(false)
  const [isSyncingTypefully, setIsSyncingTypefully] = useState(false)
  const [isDisconnectingTypefully, setIsDisconnectingTypefully] = useState(false)
  const [linkingSocialSetId, setLinkingSocialSetId] = useState<number | null>(null)

  const loadTypefullySocialSets = async (showErrorToast = true) => {
    try {
      const res = await fetch('/api/integrations/typefully/social-sets')
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load Typefully social sets')
      }

      setTypefullySocialSets(Array.isArray(data?.socialSets) ? data.socialSets : [])
      setTypefullyAccounts(Array.isArray(data?.accounts) ? data.accounts : [])
    } catch (error) {
      console.error('Error loading Typefully social sets:', error)
      if (showErrorToast) {
        toast.error(error instanceof Error ? error.message : 'Could not load Typefully social sets')
      }
    }
  }

  useEffect(() => {
    const loadTypefullyConnection = async () => {
      try {
        const res = await fetch('/api/integrations/typefully/connection')
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load Typefully connection')
        }

        if (!data?.connected) {
          setTypefullyConnection(null)
          setTypefullySocialSets([])
          setTypefullyAccounts([])
          return
        }

        setTypefullyConnection(data.connection || null)
        await loadTypefullySocialSets(false)
      } catch (error) {
        console.error('Error loading Typefully connection:', error)
      } finally {
        setIsLoadingTypefully(false)
      }
    }

    loadTypefullyConnection()
  }, [])

  const connectTypefully = async () => {
    const key = typefullyApiKey.trim()
    if (!key) {
      toast.error('Typefully API key is required')
      return
    }

    setIsSavingTypefully(true)
    try {
      const res = await fetch('/api/integrations/typefully/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to connect Typefully')
      }

      setTypefullyApiKey('')
      const connectionRes = await fetch('/api/integrations/typefully/connection')
      const connectionData = await connectionRes.json().catch(() => ({}))
      if (connectionRes.ok && connectionData?.connected) {
        setTypefullyConnection(connectionData.connection || null)
      }

      await loadTypefullySocialSets(false)
      toast.success('Typefully connected')
    } catch (error) {
      console.error('Error connecting Typefully:', error)
      toast.error(error instanceof Error ? error.message : 'Could not connect Typefully')
    } finally {
      setIsSavingTypefully(false)
    }
  }

  const disconnectTypefully = async () => {
    setIsDisconnectingTypefully(true)
    try {
      const res = await fetch('/api/integrations/typefully/connection', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to disconnect Typefully')
      }

      setTypefullyConnection(null)
      setTypefullySocialSets([])
      setTypefullyAccounts([])
      setTypefullyApiKey('')
      toast.success('Typefully disconnected')
    } catch (error) {
      console.error('Error disconnecting Typefully:', error)
      toast.error(error instanceof Error ? error.message : 'Could not disconnect Typefully')
    } finally {
      setIsDisconnectingTypefully(false)
    }
  }

  const syncTypefullySocialSets = async () => {
    setIsSyncingTypefully(true)
    try {
      await loadTypefullySocialSets(true)
      toast.success('Typefully social sets synced')
    } finally {
      setIsSyncingTypefully(false)
    }
  }

  const linkTypefullySocialSet = async (socialSetId: number, accountId: string) => {
    setLinkingSocialSetId(socialSetId)
    try {
      if (!accountId) {
        const res = await fetch(`/api/integrations/typefully/social-sets/${socialSetId}/link`, {
          method: 'DELETE',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to unlink social set')
        }
        await loadTypefullySocialSets(false)
        return
      }

      const res = await fetch(`/api/integrations/typefully/social-sets/${socialSetId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to link social set')
      }
      await loadTypefullySocialSets(false)
    } catch (error) {
      console.error('Error linking Typefully social set:', error)
      toast.error(error instanceof Error ? error.message : 'Could not update link')
    } finally {
      setLinkingSocialSetId(null)
    }
  }

  return (
    <section className="p-4 rounded-xl border border-border/50 bg-card/50">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {typefullyConnection && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncTypefullySocialSets} disabled={isSyncingTypefully}>
              {isSyncingTypefully ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectTypefully}
              disabled={isDisconnectingTypefully}
            >
              {isDisconnectingTypefully ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Unlink2 className="w-4 h-4 mr-2" />
              )}
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {isLoadingTypefully ? (
        <p className="text-sm text-muted-foreground">Loading integration...</p>
      ) : !typefullyConnection ? (
        <div className="space-y-3">
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Paste your Typefully API key"
              className="pl-9"
              value={typefullyApiKey}
              onChange={(e) => setTypefullyApiKey(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Platform access (X, LinkedIn, Threads, Bluesky, Mastodon) is managed in Typefully.
            </p>
            <Button onClick={connectTypefully} disabled={isSavingTypefully}>
              {isSavingTypefully ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Connect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-background/40 p-3">
            <p className="text-sm font-medium">{typefullyConnection.typefullyUserName || 'Typefully user'}</p>
            <p className="text-xs text-muted-foreground">
              {typefullyConnection.typefullyUserEmail || 'No email'}
              {typefullyConnection.apiKeyLabel ? ` · ${typefullyConnection.apiKeyLabel}` : ''}
            </p>
          </div>

          {typefullySocialSets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No social sets yet. Use sync to pull your accounts from Typefully.
            </p>
          ) : (
            <div className="space-y-2">
              {typefullyAccounts.length === 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {emptyAccountsHint}
                </div>
              )}
              {typefullySocialSets.map((socialSet) => {
                const linkedId = socialSet.linkedAccount?.id || ''
                const isLinking = linkingSocialSetId === socialSet.socialSetId
                return (
                  <div
                    key={socialSet.id}
                    className="rounded-lg border border-border/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted border border-border/50 shrink-0">
                        {socialSet.profileImageUrl ? (
                          <Image
                            src={socialSet.profileImageUrl}
                            alt=""
                            width={36}
                            height={36}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{socialSet.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          @{socialSet.username}
                          {socialSet.teamName ? ` · ${socialSet.teamName}` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {socialSet.connectedPlatforms.length > 0 ? (
                            socialSet.connectedPlatforms.map((platform) => (
                              <span
                                key={`${socialSet.id}-${platform}`}
                                className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                              >
                                {platform}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No platforms detected</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLinking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      <select
                        value={linkedId}
                        disabled={isLinking || typefullyAccounts.length === 0}
                        onChange={(e) => void linkTypefullySocialSet(socialSet.socialSetId, e.target.value)}
                        className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="">Not linked</option>
                        {typefullyAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.displayName || account.username} (@{account.username})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
