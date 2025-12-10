'use client'

import { useState, useEffect } from 'react'
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
  currentUserFid,
  isPro = false,
}: ProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [casts, setCasts] = useState<Cast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('casts')

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        const profileRes = await fetch(`/api/users/${username}`)
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.user)
        }

        const castsRes = await fetch(`/api/users/${username}/casts?limit=20`)
        if (castsRes.ok) {
          const data = await castsRes.json()
          setCasts(data.casts || [])
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [username])

  const bio = profile?.profile?.bio?.text || profile?.bio
  const location = profile?.profile?.location?.description
  const coverImage = profile?.profile?.banner?.url

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
    <div className="max-w-2xl">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al feed
      </button>

      {/* Cover Image */}
      {coverImage && (
        <div className="relative h-32 mb-4 -mx-4 overflow-hidden rounded-lg">
          <img 
            src={coverImage} 
            alt="Cover" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Profile Header */}
      <div className="flex items-start gap-4 mb-4">
        {profile.pfp_url ? (
          <img 
            src={profile.pfp_url} 
            alt={profile.username}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xl font-bold">{profile.display_name?.[0]}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-bold truncate">{profile.display_name}</h1>
              {profile.power_badge && <PowerBadge size={18} />}
            </div>
            {/* Actions - aligned right */}
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm">
                Seguir
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => window.open(`https://warpcast.com/${profile.username}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Farcaster
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
        </div>
      </div>

      {/* Bio */}
      {bio && <p className="text-sm mb-3">{bio}</p>}

      {/* Location */}
      {location && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm mb-6">
        <div>
          <span className="font-semibold">{profile.following_count?.toLocaleString()}</span>
          <span className="text-muted-foreground ml-1">Siguiendo</span>
        </div>
        <div>
          <span className="font-semibold">{profile.follower_count?.toLocaleString()}</span>
          <span className="text-muted-foreground ml-1">Seguidores</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
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
        {casts.length > 0 ? (
          casts.map((cast) => (
            <CastCard 
              key={cast.hash} 
              cast={cast}
              onSelectUser={onSelectUser}
              onReply={onReply}
              onQuote={onQuote}
              currentUserFid={currentUserFid}
              isPro={isPro}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay casts
          </p>
        )}
      </div>
    </div>
  )
}
