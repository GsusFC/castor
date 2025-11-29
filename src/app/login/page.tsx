'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignInButton, useProfile } from '@farcaster/auth-kit'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, profile } = useProfile()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuccess = useCallback(async () => {
    if (!profile?.fid) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: profile.fid }),
      })

      if (!res.ok) {
        throw new Error('Error al verificar')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setIsLoading(false)
    }
  }, [profile, router])

  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      handleSuccess()
    }
  }, [isAuthenticated, profile, handleSuccess])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-castor-black rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-2xl font-bold">C</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Bienvenido a Castor
        </h1>
        <p className="text-gray-500 mb-8">
          Programa y gestiona tus casts de Farcaster
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Iniciando sesión...</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <SignInButton />
          </div>
        )}

        {error && (
          <p className="mt-4 text-red-500 text-sm">{error}</p>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Al iniciar sesión, aceptas los términos de uso de la aplicación.
        </p>
      </div>
    </div>
  )
}
