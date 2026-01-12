import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Esta página redirige a /accounts con el modal abierto
// Se mantiene por compatibilidad con URLs existentes
export default function ConnectAccountPage() {
  redirect('/accounts?connect=true')
}
