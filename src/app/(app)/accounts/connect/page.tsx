'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Esta página redirige a /accounts con el modal abierto
// Se mantiene por compatibilidad con URLs existentes
export default function ConnectAccountPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/accounts?connect=true')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[50dvh]">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  )
}
