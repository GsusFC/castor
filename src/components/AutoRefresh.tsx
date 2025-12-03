'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRefreshProps {
  /** Intervalo de refresco en milisegundos (default: 30000 = 30s) */
  interval?: number
  /** Solo refrescar si hay casts pendientes de publicar */
  enabled?: boolean
}

/**
 * Componente que refresca automáticamente la página cada X segundos
 * Útil para páginas que muestran datos que cambian en el servidor (ej: casts publicándose)
 */
export function AutoRefresh({ interval = 30000, enabled = true }: AutoRefreshProps) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      router.refresh()
    }, interval)

    return () => clearInterval(timer)
  }, [router, interval, enabled])

  // No renderiza nada visible
  return null
}
