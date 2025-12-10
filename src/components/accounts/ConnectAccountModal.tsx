'use client'

import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, CheckCircle, RefreshCw, Smartphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Status = 'idle' | 'loading' | 'pending' | 'approved' | 'error'

interface SignerData {
  signerUuid: string
  publicKey: string
  deepLinkUrl: string
}

interface ConnectAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ConnectAccountModal({ open, onOpenChange, onSuccess }: ConnectAccountModalProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [signerData, setSignerData] = useState<SignerData | null>(null)
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
          console.log('[ConnectModal] Signer approved!')
          setStatus('approved')
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
        setError(err instanceof Error ? err.message : 'Error desconocido')
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

  // Callback cuando se aprueba
  useEffect(() => {
    if (status !== 'approved') return
    
    const timer = setTimeout(() => {
      onSuccess?.()
      onOpenChange(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [status, onSuccess, onOpenChange])

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
          <DialogTitle>Conectar cuenta de Farcaster</DialogTitle>
          <DialogDescription>
            Escanea el código QR con la app de Farcaster
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Generando código QR...</p>
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
                  <p>Abre Farcaster en tu móvil</p>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-muted rounded-lg text-sm">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <p>Ve a Configuración → Apps conectadas</p>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-muted rounded-lg text-sm">
                  <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <p>Escanea este código QR</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Esperando aprobación...</span>
              </div>

              {/* Mobile link */}
              <div className="pt-4 border-t border-border">
                <Button variant="outline" size="sm" asChild>
                  <a href={signerData.deepLinkUrl}>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Abrir en Farcaster
                  </a>
                </Button>
              </div>
            </div>
          )}

          {status === 'approved' && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-1">¡Cuenta conectada!</h3>
              <p className="text-muted-foreground text-sm">Redirigiendo...</p>
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
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
