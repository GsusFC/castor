'use client'

import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, User } from 'lucide-react'
import { PowerBadge } from '@/components/ui/PowerBadge'
import Link from 'next/link'

interface FollowListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fid: number
  type: 'followers' | 'following'
  username: string
}

interface UserItem {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  follower_count: number
  power_badge?: boolean
  bio?: string
}

export function FollowListDialog({ 
  open, 
  onOpenChange, 
  fid, 
  type,
  username,
}: FollowListDialogProps) {
  const query = useInfiniteQuery({
    queryKey: ['follow-list', fid, type],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '25' })
      if (pageParam) params.set('cursor', pageParam)
      
      const res = await fetch(`/api/social/${fid}/${type}?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: open,
  })

  const users = query.data?.pages.flatMap((page) => page.users) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {type === 'followers' ? 'Seguidores' : 'Siguiendo'} de @{username}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {query.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {type === 'followers' ? 'Sin seguidores' : 'No sigue a nadie'}
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user: UserItem) => (
                <Link
                  key={user.fid}
                  href={`/user/${user.username}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  {user.pfp_url ? (
                    <img 
                      src={user.pfp_url} 
                      alt={user.username}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm truncate">
                        {user.display_name}
                      </span>
                      {user.power_badge && <PowerBadge size={14} />}
                    </div>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {user.follower_count.toLocaleString()} seg.
                  </span>
                </Link>
              ))}

              {query.hasNextPage && (
                <button
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="w-full py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  {query.isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
