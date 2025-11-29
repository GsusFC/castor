'use client'

import { useState } from 'react'
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r transition-all duration-300 z-20 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className={`p-4 ${collapsed ? 'px-2' : 'p-6'}`}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-castor-black rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            {!collapsed && <span className="font-semibold text-lg">Castor</span>}
          </Link>
        </div>

        {/* Botón nuevo cast */}
        <div className={`mb-6 ${collapsed ? 'px-2' : 'px-4'}`}>
          <Link
            href="/dashboard/compose"
            className={`flex items-center justify-center gap-2 w-full bg-castor-black hover:bg-castor-dark text-white py-3 rounded-xl font-medium transition-colors ${
              collapsed ? 'px-0' : ''
            }`}
            title={collapsed ? 'Nuevo Cast' : undefined}
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Nuevo Cast</span>}
          </Link>
        </div>

        {/* Navegación */}
        <nav className={`space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-castor-light text-castor-dark'
                    : 'text-gray-700 hover:bg-gray-100'
                } ${collapsed ? 'justify-center px-2' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className={`absolute bottom-4 left-0 right-0 ${collapsed ? 'px-2' : 'px-4'}`}>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700 w-full ${
              collapsed ? 'justify-center px-2' : ''
            }`}
            title={collapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium">Cerrar sesión</span>}
          </button>
        </div>

        {/* Botón colapsar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-6 right-0 translate-x-1/2 w-6 h-6 bg-white border rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </aside>

      {/* Spacer para el contenido principal */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
      />
    </>
  )
}
