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
import { HERO } from '@/lib/spacing-system'
import type { Cast } from '@/components/feed/cast-card'

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
        {/* Cover Image */}
        <div className={cn(
          "relative z-0 bg-muted overflow-hidden rounded-t-lg",
          HERO.BANNER.PROFILE
        )}>
          {coverImage && (
            <Image
              src={coverImage}
              alt="Cover"
              fill
              className="w-full h-full object-cover object-center"
              unoptimized
            />
          )}

          {/* Header Actions */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 z-10">
            {currentUserFid !== profile.fid && (
              <Button
                variant="ghost"
                className="rounded-full h-9 px-3 text-xs sm:text-sm font-medium bg-background/70 backdrop-blur border border-border/60 hover:bg-background/90"
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
                title={isFollowing ? 'Following' : 'Follow'}
              >
                {isFollowLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isFollowing ? 'Following' : 'Follow'}</span>
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              className="rounded-full h-9 w-9 p-0 bg-background/70 backdrop-blur border border-border/60 hover:bg-background/90"
              onClick={() => window.open(`https://warpcast.com/${profile.username}`, '_blank')}
              title="View on Farcaster"
              aria-label="View on Warpcast"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Profile Card Container */}
        <div className="relative z-10 bg-card border-x border-b border-border rounded-b-lg">
          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 border-b border-border/50">
            {/* Avatar Row + Stats */}
            <div className={cn(
              "relative z-20 flex justify-between items-end gap-6 sm:gap-8"
            )}>
              {/* Avatar */}
              <div className={cn("flex-shrink-0", HERO.AVATAR_OFFSET.LARGE)}>
                {profile.pfp_url ? (
                  <Image
                    src={profile.pfp_url}
                    alt={profile.username}
                    width={96}
                    height={96}
                    className={cn(
                      "rounded-full object-cover bg-background shadow-md",
                      HERO.AVATAR_SIZE.STANDARD,
                      HERO.AVATAR_BORDER
                    )}
                    priority
                    unoptimized
                  />
                ) : (
                  <div className={cn(
                    "rounded-full bg-muted flex items-center justify-center shadow-md",
                    HERO.AVATAR_SIZE.STANDARD,
                    HERO.AVATAR_BORDER
                  )}>
                    <span className="text-2xl font-bold">{profile.display_name?.[0]}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 sm:gap-8 text-xs sm:text-sm">
                <div className="text-right">
                  <div className="font-semibold text-foreground text-base sm:text-lg">
                    {profile.following_count?.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground text-[10px] sm:text-xs">following</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground text-base sm:text-lg">
                    {profile.follower_count?.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground text-[10px] sm:text-xs">followers</div>
                </div>
              </div>
            </div>

            {/* User Info Section */}
            <div className="space-y-3 sm:space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-foreground">
                    {profile.display_name}
                  </h1>
                  {profile.power_badge && <PowerBadge size={20} />}
                </div>
                <p className="text-muted-foreground text-xs sm:text-sm">@{profile.username}</p>
              </div>

            </div>

            {/* Bio */}
            {bio && (
              <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/85">
                {bio}
              </p>
            )}

            {/* Meta Info - Location */}
            {location && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - unificado con estilo de Pills del Feed */}
      <div className="sticky top-[53px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 py-2 sm:py-2.5">
        <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1">
          {(['casts', 'replies', 'likes'] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex-1 h-8 sm:h-9 px-3 text-xs sm:text-sm rounded-full transition-all",
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
