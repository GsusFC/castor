'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, CheckCircle, RefreshCw, Smartphone, User, Building2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Status = 'idle' | 'loading' | 'pending' | 'choose_type' | 'saving_type' | 'error'

interface SignerData {
  signerUuid: string
  publicKey: string
  deepLinkUrl: string
}

interface ApprovedAccount {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
  type: 'personal' | 'business'
}

interface ConnectAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ConnectAccountModal({ open, onOpenChange, onSuccess }: ConnectAccountModalProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [signerData, setSignerData] = useState<SignerData | null>(null)
  const [approvedAccount, setApprovedAccount] = useState<ApprovedAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasCreatedSigner = useRef(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Función de polling
  const startPolling = (uuid: string) => {
    if (!uuid) {
      console.error('[ConnectModal] startPolling called with empty uuid!')
      return
    }

    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    console.log('[ConnectModal] Starting polling for:', uuid)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/accounts/check-signer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signerUuid: uuid }),
        })

        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'approved') {
          console.log('[ConnectModal] Signer approved!', data.account)
          // Store approved account info for type selection UI
          if (data.account) {
            setApprovedAccount({
              id: data.account.id,
              username: data.account.username,
              displayName: data.account.displayName,
              pfpUrl: data.account.pfpUrl,
              type: data.account.type || 'personal',
            })
          }
          setStatus('choose_type')
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }
      } catch (err) {
        console.error('[ConnectModal] Error checking signer:', err)
      }
    }, 2000)
  }

  // Crear signer cuando se abre el modal
  useEffect(() => {
    if (!open) {
      // Reset al cerrar
      hasCreatedSigner.current = false
      setStatus('idle')
      setSignerData(null)
      setApprovedAccount(null)
      setError(null)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    if (hasCreatedSigner.current) return
    hasCreatedSigner.current = true

    const createSigner = async () => {
      setStatus('loading')
      setError(null)

      try {
        const res = await fetch('/api/accounts/create-signer', {
          method: 'POST',
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create signer')
        }

        const response = await res.json()
        const data = response.data || response

        if (!data.signerUuid) {
          throw new Error('No signerUuid in response')
        }

        setSignerData({
          signerUuid: data.signerUuid,
          publicKey: data.publicKey,
          deepLinkUrl: data.deepLinkUrl,
        })
        setStatus('pending')
        startPolling(data.signerUuid)
      } catch (err) {
        console.error('[ConnectModal] Error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setStatus('error')
        hasCreatedSigner.current = false
      }
    }

    createSigner()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [open])

  // Handle account type selection
  const handleSelectType = async (type: 'personal' | 'business') => {
    if (!signerData) return

    // Personal is already the default, just close
    if (type === 'personal') {
      onSuccess?.()
      onOpenChange(false)
      return
    }

    // Business requires updating the account type
    setStatus('saving_type')
    try {
      const res = await fetch('/api/accounts/check-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerUuid: signerData.signerUuid, type: 'business' }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update account type')
      }

      console.log('[ConnectModal] Account type updated to business')
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      console.error('[ConnectModal] Error updating type:', err)
      setError(err instanceof Error ? err.message : 'Failed to update account type')
      setStatus('error')
    }
  }

  const handleRetry = () => {
    hasCreatedSigner.current = false
    setStatus('idle')
    setSignerData(null)
    setError(null)
    // Trigger re-create
    setTimeout(() => {
      hasCreatedSigner.current = false
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Farcaster account</DialogTitle>
          <DialogDescription>
            Scan the QR code with the Farcaster app
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Generating QR code...</p>
            </div>
          )}

          {status === 'pending' && signerData && (
            <div className="text-center">
              {/* QR Code */}
              <div className="bg-white p-3 rounded-xl inline-block mb-4 shadow-sm">
                <QRCodeSVG
                  value={signerData.deepLinkUrl}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Instructions */}
              <div className="space-y-2 mb-4 text-left">
                <div className="flex items-center gap-3 p-2.5 bg-muted rounded-lg text-sm">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <p>Open Farcaster on your phone</p>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-muted rounded-lg text-sm">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <p>Go to Settings → Connected apps</p>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-muted rounded-lg text-sm">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <p>Scan this QR code</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for approval...</span>
              </div>

              {/* Mobile link */}
              <div className="pt-4 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <a href={signerData.deepLinkUrl}>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Open in Farcaster
                  </a>
                </Button>
              </div>
            </div>
          )}

          {status === 'choose_type' && approvedAccount && (
            <div className="text-center">
              {/* Success indicator */}
              <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              
              {/* Account info */}
              <div className="flex items-center justify-center gap-2 mb-2">
                {approvedAccount.pfpUrl ? (
                  <img
                    src={approvedAccount.pfpUrl}
                    alt={approvedAccount.username}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 bg-muted rounded-full" />
                )}
                <span className="font-semibold">@{approvedAccount.username}</span>
                <span className="text-muted-foreground">connected</span>
              </div>
              
              {/* Type selection */}
              <p className="text-muted-foreground text-sm mb-4">
                How will you use this account?
              </p>
              
              <div className="space-y-2">
                <button
                  onClick={() => handleSelectType('personal')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-accent transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center group-hover:bg-muted/80">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Personal</p>
                    <p className="text-sm text-muted-foreground">Only I will have access</p>
                  </div>
                </button>
                
                <button
                  onClick={() => handleSelectType('business')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-accent transition-all text-left group"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/15">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Business</p>
                    <p className="text-sm text-muted-foreground">I can invite collaborators</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {status === 'saving_type' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Saving...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">❌</span>
              </div>
              <h3 className="text-lg font-semibold mb-1">Error</h3>
              <p className="text-muted-foreground text-sm mb-4">{error}</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
