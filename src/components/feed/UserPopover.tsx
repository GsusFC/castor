'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserPlus, UserCheck, ExternalLink, User } from 'lucide-react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { toast } from 'sonner'

interface UserPopoverProps {
  fid: number
  username: string
  displayName: string
  pfpUrl?: string
  children: React.ReactNode
}

interface UserProfile {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  bio?: string
  follower_count: number
  following_count: number
  verified_addresses?: {
    eth_addresses?: string[]
  }
}

export function UserPopover({ fid, username, displayName, pfpUrl, children }: UserPopoverProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)

  const fetchProfile = async () => {
    if (profile || isLoading) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/users/${fid}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollow = async () => {
    setIsFollowLoading(true)
    try {
      const res = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFid: fid }),
      })
      if (res.ok) {
        setIsFollowing(true)
        toast.success(`Siguiendo a @${username}`)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al seguir')
      }
    } catch (error) {
      toast.error('Error al seguir')
    } finally {
      setIsFollowLoading(false)
    }
  }

  const farcasterUrl = `https://farcaster.xyz/${username}`

  return (
    <HoverCard openDelay={300} onOpenChange={(open: boolean) => open && fetchProfile()}>
      <HoverCardTrigger asChild>
        <Link 
          href={`/dashboard/user/${username}`}
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            {(profile?.pfp_url || pfpUrl) && (
              <img 
                src={profile?.pfp_url || pfpUrl} 
                alt={username}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{profile?.display_name || displayName}</p>
              <p className="text-sm text-muted-foreground">@{profile?.username || username}</p>
            </div>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
          )}

          {/* Stats */}
          {profile && (
            <div className="flex items-center gap-4 text-sm">
              <span>
                <strong>{(profile.following_count ?? 0).toLocaleString()}</strong>
                <span className="text-muted-foreground ml-1">siguiendo</span>
              </span>
              <span>
                <strong>{(profile.follower_count ?? 0).toLocaleString()}</strong>
                <span className="text-muted-foreground ml-1">seguidores</span>
              </span>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-4 text-sm">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/dashboard/user/${username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <User className="w-4 h-4" />
              Ver perfil
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleFollow()
              }}
              disabled={isFollowing || isFollowLoading}
              className={`p-1.5 rounded-lg transition-colors ${
                isFollowing 
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              title={isFollowing ? 'Siguiendo' : 'Seguir'}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </button>
            <a
              href={farcasterUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              title="Ver en Warpcast"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
