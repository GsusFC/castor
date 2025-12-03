'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
}

interface MentionAutocompleteProps {
  query: string
  position: { top: number; left: number }
  onSelect: (user: User) => void
  onClose: () => void
}

export function MentionAutocomplete({
  query,
  position,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 1) {
      setUsers([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || [])
        setSelectedIndex(0)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[Mention] Search error:', err)
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, users.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && users[selectedIndex]) {
        e.preventDefault()
        onSelect(users[selectedIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [users, selectedIndex, onSelect, onClose])

  if (users.length === 0 && !isLoading) {
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={containerRef}
        className="absolute z-50 bg-white border rounded-lg shadow-xl overflow-hidden min-w-[250px] max-h-[300px] overflow-y-auto"
        style={{ top: position.top, left: position.left }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        ) : (
          users.map((user, index) => (
            <button
              key={user.fid}
              type="button"
              onClick={() => onSelect(user)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors",
                index === selectedIndex && "bg-gray-100"
              )}
            >
              {user.pfpUrl ? (
                <img
                  src={user.pfpUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {user.displayName || user.username}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  @{user.username}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  )
}
