'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Users, Loader2, ExternalLink, Star, Github, Pencil, UserPlus, UserMinus } from 'lucide-react'
import { CastCard } from '@/components/feed/CastCard'
import { MiniAppDrawer } from '@/components/feed/MiniAppDrawer'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { EditProfileDialog } from '@/components/profile/EditProfileDialog'
import { FollowListDialog } from '@/components/profile/FollowListDialog'
import { ComposeModal } from '@/components/compose/ComposeModal'
import type { ReplyToCast } from '@/components/compose/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ProfileTab = 'casts' | 'replies' | 'likes'
type FollowListType = 'followers' | 'following' | null

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const username = params.username as string
  const [activeTab, setActiveTab] = useState<ProfileTab>('casts')
  const [editOpen, setEditOpen] = useState(false)
  const [followListOpen, setFollowListOpen] = useState<FollowListType>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyToCast, setReplyToCast] = useState<ReplyToCast | null>(null)
  const [miniApp, setMiniApp] = useState<{ url: string; title: string } | null>(null)

  // Fetch current user to check if viewing own profile
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/me')
      if (!res.ok) return null
      return res.json()
    },
  })

  // Fetch user profile
  const profileQuery = useQuery({
    queryKey: ['user-profile', username],
    queryFn: async () => {
      const res = await fetch(`/api/users/${username}`)
      if (!res.ok) throw new Error('User not found')
      return res.json()
    },
  })

  // Fetch user casts
  const castsQuery = useInfiniteQuery({
    queryKey: ['user-casts', username, activeTab],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(
        `/api/users/${username}/casts?cursor=${pageParam || ''}&type=${activeTab}`
      )
      if (!res.ok) throw new Error('Failed to fetch casts')
      return res.json()
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.next?.cursor,
    enabled: !!profileQuery.data,
  })

  const user = profileQuery.data?.user
  const casts = castsQuery.data?.pages.flatMap((page) => page.casts) || []
  
  const isOwnProfile = meQuery.data?.fid && user?.fid === meQuery.data.fid
  const isFollowing = user?.viewer_context?.following

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (fid: number) => {
      const res = await fetch(`/api/social/${fid}/follow`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to follow')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Siguiendo')
      queryClient.invalidateQueries({ queryKey: ['user-profile', username] })
    },
    onError: () => {
      toast.error('Error al seguir')
    },
  })

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (fid: number) => {
      const res = await fetch(`/api/social/${fid}/follow`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to unfollow')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Dejaste de seguir')
      queryClient.invalidateQueries({ queryKey: ['user-profile', username] })
    },
    onError: () => {
      toast.error('Error al dejar de seguir')
    },
  })

  const handleFollowToggle = () => {
    if (!user?.fid) return
    if (isFollowing) {
      unfollowMutation.mutate(user.fid)
    } else {
      followMutation.mutate(user.fid)
    }
  }

  const tabs: { value: ProfileTab; label: string }[] = [
    { value: 'casts', label: 'Casts' },
    { value: 'replies', label: 'Respuestas' },
    { value: 'likes', label: 'Likes' },
  ]

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (profileQuery.error || !user) {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="text-center py-12">
          <p className="text-lg font-medium">Usuario no encontrado</p>
          <p className="text-muted-foreground">@{username} no existe</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Profile Header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
        {/* Banner - Pro feature */}
        {user.profile?.banner?.url ? (
          <div className="h-32 md:h-40 overflow-hidden">
            <img 
              src={user.profile.banner.url} 
              alt="Banner" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-32 md:h-40 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
        )}

        {/* Avatar & Info */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <div className="relative">
              {user.pfp_url ? (
                <img
                  src={user.pfp_url}
                  alt={user.display_name}
                  className="w-24 h-24 rounded-full border-4 border-card bg-card"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-card bg-muted flex items-center justify-center">
                  <Users className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              {(user.power_badge || user.pro?.status === 'subscribed') && (
                <div className="absolute -bottom-1 -right-1">
                  <PowerBadge size={28} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold truncate">{user.display_name}</h1>
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            {/* Edit Profile button (only for own profile) */}
            {isOwnProfile ? (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            ) : (
              /* Follow/Unfollow button (only for other profiles) */
              <button
                onClick={handleFollowToggle}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
                  isFollowing
                    ? "bg-muted hover:bg-destructive/10 hover:text-destructive"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {followMutation.isPending || unfollowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <UserMinus className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {isFollowing ? 'Siguiendo' : 'Seguir'}
              </button>
            )}
            <a
              href={`https://warpcast.com/${user.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Warpcast
            </a>
          </div>

          {/* Bio */}
          {user.profile?.bio?.text && (
            <p className="text-sm mb-3 whitespace-pre-wrap">{user.profile.bio.text}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {user.profile?.location?.description && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {user.profile.location.description}
              </div>
            )}
          </div>

          {/* Verified Accounts */}
          {user.verified_accounts && user.verified_accounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {user.verified_accounts.map((account: { platform: string; username: string }, i: number) => (
                <a
                  key={i}
                  href={account.platform === 'x' 
                    ? `https://x.com/${account.username}` 
                    : `https://github.com/${account.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  {account.platform === 'x' ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  ) : (
                    <Github className="w-3 h-3" />
                  )}
                  @{account.username}
                </a>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setFollowListOpen('following')}
              className="hover:underline"
            >
              <span className="font-semibold">{user.following_count?.toLocaleString() || 0}</span>
              <span className="text-muted-foreground ml-1">Siguiendo</span>
            </button>
            <button
              onClick={() => setFollowListOpen('followers')}
              className="hover:underline"
            >
              <span className="font-semibold">{user.follower_count?.toLocaleString() || 0}</span>
              <span className="text-muted-foreground ml-1">Seguidores</span>
            </button>
            {user.score !== undefined && user.score > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold">{user.score.toFixed(2)}</span>
                <span className="text-muted-foreground">Score</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.value && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Casts */}
      <div className="space-y-4">
        {castsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : casts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay {activeTab === 'casts' ? 'casts' : activeTab === 'replies' ? 'respuestas' : 'likes'}
          </div>
        ) : (
          <>
            {casts.map((cast: any) => (
              <CastCard 
                key={cast.hash} 
                cast={cast}
                currentUserFid={meQuery.data?.fid}
                onOpenMiniApp={(url, title) => setMiniApp({ url, title })}
                onReply={(c) => {
                  setReplyToCast({
                    hash: c.hash,
                    text: c.text,
                    timestamp: c.timestamp,
                    author: {
                      fid: c.author.fid,
                      username: c.author.username,
                      displayName: c.author.display_name,
                      pfpUrl: c.author.pfp_url || null,
                    },
                  })
                  setComposeOpen(true)
                }}
              />
            ))}
            {castsQuery.hasNextPage && (
              <button
                onClick={() => castsQuery.fetchNextPage()}
                disabled={castsQuery.isFetchingNextPage}
                className="w-full py-3 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                {castsQuery.isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        currentProfile={{
          displayName: user.display_name || '',
          bio: user.profile?.bio?.text || '',
          pfpUrl: user.pfp_url || '',
          bannerUrl: user.profile?.banner?.url || '',
        }}
        isPro={user.pro?.status === 'subscribed'}
        onSave={() => {
          profileQuery.refetch()
        }}
      />

      {/* Follow List Dialog */}
      {followListOpen && user?.fid && (
        <FollowListDialog
          open={!!followListOpen}
          onOpenChange={(open) => !open && setFollowListOpen(null)}
          fid={user.fid}
          type={followListOpen}
          username={user.username}
        />
      )}

      {/* Compose Modal para Reply */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) setReplyToCast(null)
        }}
        defaultReplyTo={replyToCast}
      />

      {/* Mini App Drawer */}
      <MiniAppDrawer
        open={!!miniApp}
        onClose={() => setMiniApp(null)}
        url={miniApp?.url || null}
        title={miniApp?.title || 'Mini App'}
      />
    </div>
  )
}
