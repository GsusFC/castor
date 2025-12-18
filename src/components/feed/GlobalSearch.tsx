'use client'

import { Search } from 'lucide-react'
import { useSearch } from '@/context/SearchContext'
import { useEffect } from 'react'

interface GlobalSearchProps {
  onSelectChannel?: (channel: { id: string; name: string; image_url?: string }) => void
  onSelectUser?: (user: { fid: number; username: string }) => void
  onSelectCast?: (cast: { hash: string }) => void
}

export function GlobalSearch({ onSelectChannel, onSelectUser, onSelectCast }: GlobalSearchProps) {
  const { open } = useSearch()

  // Make sure we just use this as a trigger

  return (
    <div className="relative w-full max-w-md group">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        <button
          onClick={open}
          className="w-full pl-9 pr-4 py-2 text-sm text-left rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-background hover:border-primary/50 hover:text-foreground transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/20"
        >
          Search... <span className="ml-1 text-[10px] opacity-60 border border-border px-1 py-0.5 rounded">⌘K</span>
        </button>
      </div>
    </div>
  )
}
