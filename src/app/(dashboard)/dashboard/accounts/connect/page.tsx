'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Loader2, CheckCircle, RefreshCw, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'pending' | 'approved' | 'error'

interface SignerData {
  signerUuid: string
  publicKey: string
  deepLinkUrl: string
}

export default function ConnectAccountPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [signerData, setSignerData] = useState<SignerData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createSigner = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/accounts/create-signer', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to create signer')
      }

      const data = await res.json()
      
      setSignerData({
        signerUuid: data.signerUuid,
        publicKey: data.publicKey,
        deepLinkUrl: data.deepLinkUrl,
      })
      setStatus('pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }, [])

  // Crear signer al montar
  useEffect(() => {
    createSigner()
  }, [createSigner])

  // Polling para verificar estado
  useEffect(() => {
    if (status !== 'pending' || !signerData) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/accounts/check-signer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signerUuid: signerData.signerUuid }),
        })

        const data = await res.json()

        if (data.status === 'approved') {
          setStatus('approved')
          clearInterval(interval)
        }
      } catch (err) {
        console.error('Error checking signer:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [status, signerData])

  // Redirigir cuando se aprueba
  useEffect(() => {
    if (status !== 'approved') return
    
    const timer = setTimeout(() => {
      // Usar window.location para forzar recarga completa
      window.location.href = '/dashboard/accounts'
    }, 1500)

    return () => clearTimeout(timer)
  }, [status])

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/accounts">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-display text-foreground">Conectar cuenta</h1>
          <p className="text-muted-foreground mt-1">Escanea el QR con Warpcast</p>
        </div>
      </div>

      <Card className="p-8">
        {status === 'loading' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-castor-black mx-auto mb-4" />
            <p className="text-muted-foreground">Generando código QR...</p>
          </div>
        )}

        {status === 'pending' && signerData && (
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-card p-4 rounded-xl border inline-block mb-6 shadow-sm">
              <QRCodeSVG
                value={signerData.deepLinkUrl}
                size={240}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-left p-3 bg-muted rounded-lg border border-border">
                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  1
                </div>
                <p className="text-foreground text-sm">Abre Warpcast en tu móvil</p>
              </div>
              <div className="flex items-center gap-3 text-left p-3 bg-muted rounded-lg border border-border">
                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  2
                </div>
                <p className="text-foreground text-sm">Ve a Configuración → Cuentas conectadas</p>
              </div>
              <div className="flex items-center gap-3 text-left p-3 bg-muted rounded-lg border border-border">
                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  3
                </div>
                <p className="text-foreground text-sm">Escanea este código QR</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Esperando aprobación...</span>
            </div>

            {/* Mobile link */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">¿Estás en el móvil?</p>
              <Button variant="link" asChild>
                <a href={signerData.deepLinkUrl} className="text-castor-black">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Abrir en Warpcast
                </a>
              </Button>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500/10 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              ¡Cuenta conectada!
            </h2>
            <p className="text-muted-foreground">Redirigiendo...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-500/10 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Error</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={createSigner}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
