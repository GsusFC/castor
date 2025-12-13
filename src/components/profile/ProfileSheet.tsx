'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, Users, MapPin, Link as LinkIcon } from 'lucide-react'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { CastCard } from '@/components/feed/CastCard'

interface ProfileSheetProps {
  username: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function ProfileSheet({ username, open, onOpenChange }: ProfileSheetProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [casts, setCasts] = useState<Cast[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!username || !open) return

    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        // Fetch user profile
        const profileRes = await fetch(`/api/users/${username}`)
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.user)
        }

        // Fetch user casts
        const castsRes = await fetch(`/api/users/${username}/casts?limit=10`)
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
  }, [username, open])

  const bio = profile?.profile?.bio?.text || profile?.bio
  const location = profile?.profile?.location?.description

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto scrollbar-none">
        <SheetHeader className="sr-only">
          <SheetTitle>Perfil de @{username}</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start gap-4">
              {profile.pfp_url ? (
                <img 
                  src={profile.pfp_url} 
                  alt={profile.username}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl font-bold">{profile.display_name?.[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{profile.display_name}</h2>
                  {profile.power_badge && <PowerBadge size={20} />}
                </div>
                <p className="text-muted-foreground">@{profile.username}</p>
              </div>
            </div>

            {/* Bio */}
            {bio && (
              <p className="text-sm">{bio}</p>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{location}</span>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-semibold">{profile.following_count?.toLocaleString()}</span>
                <span className="text-muted-foreground ml-1">Following</span>
              </div>
              <div>
                <span className="font-semibold">{profile.follower_count?.toLocaleString()}</span>
                <span className="text-muted-foreground ml-1">Followers</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => window.open(`https://warpcast.com/${profile.username}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Warpcast
              </Button>
            </div>

            {/* Casts */}
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Casts recientes</h3>
              <div className="space-y-4">
                {casts.length > 0 ? (
                  casts.map((cast) => (
                    <CastCard 
                      key={cast.hash} 
                      cast={cast}
                      onOpenCast={(castHash) => router.push(`/cast/${castHash}`)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay casts
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Usuario no encontrado
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
