'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Loader2, CheckCircle, RefreshCw, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Status = 'loading' | 'pending' | 'approved' | 'error'

interface SignerData {
  signerUuid: string
  publicKey: string
  deepLinkUrl: string
}

export default function ConnectAccountPage() {
  const router = useRouter()
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
          // Redirigir después de 1.5s
          setTimeout(() => {
            router.push('/dashboard/accounts')
            router.refresh()
          }, 1500)
        }
      } catch (err) {
        console.error('Error checking signer:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [status, signerData, router])

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/accounts"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conectar cuenta</h1>
          <p className="text-gray-500 mt-1">Escanea el QR con Warpcast</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-8">
        {status === 'loading' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-farcaster-purple mx-auto mb-4" />
            <p className="text-gray-600">Generando código QR...</p>
          </div>
        )}

        {status === 'pending' && signerData && (
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl inline-block mb-6">
              <QRCodeSVG
                value={signerData.deepLinkUrl}
                size={240}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-farcaster-purple text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <p className="text-gray-700">Abre Warpcast en tu móvil</p>
              </div>
              <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-farcaster-purple text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <p className="text-gray-700">Ve a Configuración → Cuentas conectadas</p>
              </div>
              <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-farcaster-purple text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <p className="text-gray-700">Escanea este código QR</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Esperando aprobación...</span>
            </div>

            {/* Mobile link */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500 mb-3">¿Estás en el móvil?</p>
              <a
                href={signerData.deepLinkUrl}
                className="inline-flex items-center gap-2 text-farcaster-purple hover:underline font-medium"
              >
                <Smartphone className="w-4 h-4" />
                Abrir en Warpcast
              </a>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ¡Cuenta conectada!
            </h2>
            <p className="text-gray-600">Redirigiendo...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={createSigner}
              className="inline-flex items-center gap-2 bg-farcaster-purple hover:bg-farcaster-purple-dark text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
