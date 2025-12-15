'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { CastCard } from '@/components/feed/CastCard'
import { cn } from '@/lib/utils'

interface ProfileViewProps {
  username: string
  onBack: () => void
  onSelectUser?: (username: string) => void
  onReply?: (cast: Cast) => void
  onQuote?: (castUrl: string) => void
  onOpenCast?: (castHash: string) => void
  currentUserFid?: number
  isPro?: boolean
}

interface UserProfile {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  bio?: string
  follower_count: number
  following_count: number
  power_badge?: boolean
  profile?: {
    bio?: { text?: string }
    location?: { description?: string }
    banner?: { url?: string } // Cover/banner image
  }
}

interface Cast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
  }
  reactions: { likes_count: number; recasts_count: number }
  replies: { count: number }
  embeds?: any[]
  channel?: { id: string; name: string; image_url?: string }
}

type ProfileTab = 'casts' | 'replies' | 'likes'

export function ProfileView({ 
  username, 
  onBack, 
  onSelectUser, 
  onReply, 
  onQuote,
  onOpenCast,
  currentUserFid,
  isPro = false,
}: ProfileViewProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [casts, setCasts] = useState<Cast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('casts')
  const [isCastsLoading, setIsCastsLoading] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        const profileRes = await fetch(`/api/users/${username}`)
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.user)
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [username])

  useEffect(() => {
    const controller = new AbortController()

    const fetchCasts = async () => {
      setIsCastsLoading(true)
      try {
        const castsRes = await fetch(
          `/api/users/${username}/casts?limit=20&type=${encodeURIComponent(activeTab)}`,
          { signal: controller.signal }
        )
        if (!castsRes.ok) {
          setCasts([])
          return
        }

        const data = await castsRes.json()
        setCasts(data.casts || [])
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return
        console.error('Error fetching profile casts:', error)
        setCasts([])
      } finally {
        setIsCastsLoading(false)
      }
    }

    fetchCasts()

    return () => {
      controller.abort()
    }
  }, [activeTab, username])

  const bio = profile?.profile?.bio?.text || profile?.bio
  const location = profile?.profile?.location?.description
  const coverImage = profile?.profile?.banner?.url

  const handleOpenCast = (castHash: string) => {
    if (onOpenCast) {
      onOpenCast(castHash)
      return
    }
    router.push(`/cast/${castHash}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Usuario no encontrado</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl relative">
      {/* Sticky Header with Back button */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">{profile.display_name}</span>
        </button>
      </div>

      {/* Header Area */}
      <div className="relative mb-6">
        {/* Cover Image */}
        <div className="h-32 sm:h-48 w-full bg-muted overflow-hidden rounded-lg">
          {coverImage && (
            <img 
              src={coverImage} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Avatar & Actions Row */}
        <div className="px-2 sm:px-4">
          <div className="relative flex justify-between items-end -mt-10 sm:-mt-12 mb-3">
            {/* Avatar with border */}
            <div className="relative">
              {profile.pfp_url ? (
                <img 
                  src={profile.pfp_url} 
                  alt={profile.username}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-[4px] border-background bg-background"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted border-[4px] border-background flex items-center justify-center">
                  <span className="text-2xl font-bold">{profile.display_name?.[0]}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-1">
              <Button variant="outline" size="sm" className="rounded-full font-medium h-9 px-4">
                Seguir
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-full h-9 w-9 p-0 hover:bg-muted"
                onClick={() => window.open(`https://warpcast.com/${profile.username}`, '_blank')}
                title="Ver en Farcaster"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                  {profile.display_name}
                </h1>
                {profile.power_badge && <PowerBadge size={22} />}
              </div>
              <p className="text-muted-foreground text-[15px]">@{profile.username}</p>
            </div>

            {/* Bio */}
            {bio && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap max-w-2xl text-foreground/90">
                {bio}
              </p>
            )}

            {/* Meta Info (Location, etc) */}
            {location && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-muted-foreground/70" />
                  <span>{location}</span>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-5 pt-1">
              <button className="hover:underline decoration-muted-foreground/50 underline-offset-4 flex items-center gap-1.5 group">
                <span className="font-bold text-foreground">{profile.following_count?.toLocaleString()}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">Siguiendo</span>
              </button>
              <button className="hover:underline decoration-muted-foreground/50 underline-offset-4 flex items-center gap-1.5 group">
                <span className="font-bold text-foreground">{profile.follower_count?.toLocaleString()}</span>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">Seguidores</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - sticky below header */}
      <div className="sticky top-12 z-10 bg-background/95 backdrop-blur-sm flex border-b border-border mb-4 -mx-4 px-4">
        {(['casts', 'replies', 'likes'] as ProfileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === 'casts' && 'Casts'}
            {tab === 'replies' && 'Respuestas'}
            {tab === 'likes' && 'Likes'}
          </button>
        ))}
      </div>

      {/* Casts */}
      <div className="space-y-4">
        {isCastsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : casts.length > 0 ? (
          casts.map((cast) => (
            <CastCard 
              key={cast.hash} 
              cast={cast}
              onOpenCast={handleOpenCast}
              onSelectUser={onSelectUser}
              onReply={onReply}
              onQuote={onQuote}
              currentUserFid={currentUserFid}
              isPro={isPro}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {activeTab === 'casts' ? 'No hay casts' : activeTab === 'replies' ? 'No hay respuestas' : 'No hay likes'}
          </p>
        )}
      </div>
    </div>
  )
}
