'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, Send, Plus, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard/scheduled', label: 'Casts', icon: Send },
  { href: '/dashboard/accounts', label: 'Cuentas', icon: Users },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Cargar estado inicial
  useEffect(() => {
    const stored = localStorage.getItem('sidebar_collapsed')
    if (stored) {
      setCollapsed(stored === 'true')
    }
  }, [])

  const toggleCollapsed = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 z-20 flex flex-col ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className={`p-4 ${collapsed ? 'px-2 flex justify-center' : 'p-6'}`}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <img 
              src="/brand/logo.png" 
              alt="Castor" 
              className="w-9 h-9 flex-shrink-0 group-hover:scale-105 transition-transform"
            />
            {!collapsed && <span className="font-display text-lg text-gray-900">Castor</span>}
          </Link>
        </div>

        {/* Botón nuevo cast */}
        <div className={`mb-6 ${collapsed ? 'px-2' : 'px-4'}`}>
          <Link
            href="/dashboard/compose"
            className={`flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-lg font-medium text-sm transition-all shadow-md shadow-gray-900/10 hover:shadow-gray-900/20 ${
              collapsed ? 'px-0 aspect-square' : ''
            }`}
            title={collapsed ? 'Nuevo Cast' : undefined}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Nuevo Cast</span>}
          </Link>
        </div>

        {/* Navegación */}
        <nav className={`space-y-1 flex-1 ${collapsed ? 'px-2' : 'px-4'}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className={`p-4 border-t border-gray-200/50 space-y-2 ${collapsed ? 'px-2' : ''}`}>
          <button
            onClick={toggleCollapsed}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <span>Colapsar</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* Spacer para el contenido principal */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
      />
    </>
  )
}
