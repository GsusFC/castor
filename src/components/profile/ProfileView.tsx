'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, MapPin, UserPlus, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { CastCard } from '@/components/feed/CastCard'
import { ViewHeader } from '@/components/ui/ViewHeader'
import { cn } from '@/lib/utils'
import { HERO, CONTENT } from '@/lib/spacing-system'

interface ProfileViewProps {
  username: string
  onBack: () => void
  onSelectUser?: (username: string) => void
  onReply?: (cast: Cast) => void
  onQuote?: (castUrl: string) => void
  onOpenCast?: (castHash: string) => void
  currentUserFid?: number
  currentUserFids?: number[]
  onDelete?: (castHash: string) => void
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
  viewer_context?: { following: boolean }
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
  currentUserFids,
  onDelete,
  isPro = false,
}: ProfileViewProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [casts, setCasts] = useState<Cast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ProfileTab>('casts')
  const [isCastsLoading, setIsCastsLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        const profileRes = await fetch(`/api/users/${username}`)
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.user)
          if (data.user?.viewer_context?.following !== undefined) {
            setIsFollowing(data.user.viewer_context.following)
          }
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
      <div className="text-center py-20 px-4">
        <p className="text-muted-foreground mb-4">User not found</p>
        <Button variant="outline" onClick={onBack}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-screen">
      <ViewHeader
        title={profile.display_name}
        onBack={onBack}
      />

      {/* Header Area - Premium Profile */}
      <div className="relative mb-6">
        {/* Cover Image - Larger */}
        <div className="relative h-56 sm:h-64 w-full bg-muted overflow-hidden rounded-xl sm:mt-2">
          {coverImage && (
            <Image
              src={coverImage}
              alt="Cover"
              fill
              className="w-full h-full object-cover"
              unoptimized
            />
          )}
        </div>

        {/* Avatar & Actions Row - Proportional */}
        <div>
          <div className="relative flex justify-between items-end gap-6 sm:gap-8 -mt-20 sm:-mt-24 px-4 sm:px-6 mb-6 sm:mb-8">
            {/* Avatar with border */}
            <div className="flex-shrink-0">
              {profile.pfp_url ? (
                <Image
                  src={profile.pfp_url}
                  alt={profile.username}
                  width={96}
                  height={96}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-[5px] border-background bg-background shadow-md"
                  priority
                  unoptimized
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-muted border-[5px] border-background flex items-center justify-center shadow-md">
                  <span className="text-4xl font-bold">{profile.display_name?.[0]}</span>
                </div>
              )}
            </div>

            {/* Actions - Aligned with avatar */}
            <div className="flex gap-2 sm:gap-3 mb-1">
              {currentUserFid !== profile.fid && (
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  className="rounded-full font-medium h-9 px-4"
                  disabled={isFollowLoading}
                  onClick={async () => {
                    const targetFid = profile.fid
                    setIsFollowLoading(true)
                    try {
                      const res = await fetch('/api/users/follow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetFid }),
                      })
                      if (res.ok) {
                        setIsFollowing(true)
                        toast.success(`Now following @${profile.username}`)
                      } else {
                        const data = await res.json()
                        toast.error(data.error || 'Failed to follow')
                      }
                    } catch {
                      toast.error('Failed to follow')
                    } finally {
                      setIsFollowLoading(false)
                    }
                  }}
                >
                  {isFollowLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9 w-9 p-0 hover:bg-muted"
                onClick={() => window.open(`https://warpcast.com/${profile.username}`, '_blank')}
                title="View on Farcaster"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* User Info - Modular Sections */}
          <div className="px-4 sm:px-6 space-y-3 sm:space-y-4">
            {/* Name + Badge */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground">
                  {profile.display_name}
                </h1>
                {profile.power_badge && <PowerBadge size={26} />}
              </div>
              <p className="text-muted-foreground text-sm">@{profile.username}</p>
            </div>

            {/* Bio */}
            {bio && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/85">
                {bio}
              </p>
            )}

            {/* Meta Info - Location */}
            {location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}

            {/* Stats - Separated with visual divide */}
            <div className="flex items-center gap-6 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground text-lg">{profile.following_count?.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">Following</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-foreground text-lg">{profile.follower_count?.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm">Followers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - unificado con estilo de Pills del Feed */}
      <div className="sticky top-[53px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 py-2 sm:py-3">
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
          {(['casts', 'replies', 'likes'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex-1 h-9 px-3 text-sm rounded-full transition-all",
                activeTab === tab
                  ? "bg-background text-foreground shadow-md border border-border/10 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
              )}
            >
              {tab === 'casts' && 'Casts'}
              {tab === 'replies' && 'Respuestas'}
              {tab === 'likes' && 'Likes'}
            </button>
          ))}
        </div>
      </div>

      {/* Casts */}
      <div className="space-y-3 sm:space-y-4 pt-2">
        {isCastsLoading ? (
          <div className="flex items-center justify-center py-20">
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
              currentUserFids={currentUserFids}
              onDelete={onDelete}
              isPro={isPro}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-20 px-4">
            {activeTab === 'casts' ? 'No hay casts' : activeTab === 'replies' ? 'No hay respuestas' : 'No hay likes'}
          </p>
        )}
      </div>
    </div>
  )
}
