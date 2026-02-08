'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Search,
  Loader2,
  Hash,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AI_LANGUAGE_OPTIONS } from '@/lib/ai/languages'
import { useAiLanguagePreferences } from '@/context/AiLanguagePreferencesContext'
import { AppHeader } from '@/components/v2/AppHeader'
import { PageHeader } from '@/components/v2/PageHeader'
import { toast } from 'sonner'

type ChannelOption = {
  id: string
  name: string
  image_url?: string
}

interface SettingsV2ClientProps {
  user: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
}

const VERSION_COOKIE = 'castor_studio_version'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function SettingsV2Client({ user }: SettingsV2ClientProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)
  const { defaultLanguage, enabledLanguages, setDefaultLanguage, toggleEnabledLanguage } =
    useAiLanguagePreferences()
  const [followedChannels, setFollowedChannels] = useState<ChannelOption[]>([])
  const [pinnedChannels, setPinnedChannels] = useState<ChannelOption[]>([])
  const [pinnedChannelIds, setPinnedChannelIds] = useState<Set<string>>(new Set())
  const [isLoadingChannels, setIsLoadingChannels] = useState(true)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChannelOption[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const [channelsRes, pinnedRes] = await Promise.all([
          fetch('/api/channels/user?limit=200'),
          fetch('/api/channels/pinned'),
        ])

        const channelsData = channelsRes.ok ? await channelsRes.json() : { channels: [] }
        const pinnedData = pinnedRes.ok ? await pinnedRes.json() : { pinned: [] }

        setFollowedChannels(Array.isArray(channelsData?.channels) ? channelsData.channels : [])

        const pinned = Array.isArray(pinnedData?.pinned) ? pinnedData.pinned : []
        setPinnedChannels(pinned)
        setPinnedChannelIds(new Set(pinned.map((c: ChannelOption) => c.id)))
      } catch (error) {
        console.error('Error fetching channels:', error)
      } finally {
        setIsLoadingChannels(false)
      }
    }

    fetchChannels()
  }, [])

  // Debounced channel search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/channels?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(Array.isArray(data?.channels) ? data.channels : [])
        }
      } catch (error) {
        console.error('Error searching channels:', error)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const togglePinnedChannel = async (channel: ChannelOption) => {
    const isPinned = pinnedChannelIds.has(channel.id)
    if (!isPinned && pinnedChannelIds.size >= 5) {
      toast.error('You can pin up to 5 channels')
      return
    }

    const prevPinned = new Set(pinnedChannelIds)
    const prevPinnedList = [...pinnedChannels]
    const nextPinned = new Set(pinnedChannelIds)
    let nextPinnedList = [...pinnedChannels]

    if (isPinned) {
      nextPinned.delete(channel.id)
      nextPinnedList = nextPinnedList.filter(c => c.id !== channel.id)
    } else {
      nextPinned.add(channel.id)
      nextPinnedList.push(channel)
    }
    setPinnedChannelIds(nextPinned)
    setPinnedChannels(nextPinnedList)

    try {
      const res = await fetch('/api/channels/pinned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.id,
          channelName: channel.name,
          channelImageUrl: channel.image_url,
          isPinned: !isPinned,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to update pinned channels')
      }
    } catch (error) {
      console.error('Error updating pinned channels:', error)
      setPinnedChannelIds(prevPinned)
      setPinnedChannels(prevPinnedList)
      toast.error('Could not update pinned channels')
    }
  }

  const handleSwitchToV1 = () => {
    document.cookie = `${VERSION_COOKIE}=v1; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
    window.location.href = '/studio'
  }

  const currentTheme = isMounted ? theme : null

  return (
    <>
      <div className="hidden sm:block">
        <AppHeader user={user} />
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <PageHeader
          icon={<Settings className="w-5 h-5 text-primary" />}
          title="Configuration"
          subtitle="Customize your experience"
        />

        {/* Content */}
        <div className="space-y-6">
          {/* Theme Section */}
          <section className="p-4 rounded-xl border border-border/50 bg-card/50">
            <h2 className="text-sm font-medium mb-4">Appearance</h2>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
                  currentTheme === 'light'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <Sun className="w-6 h-6" />
                <span className="text-sm">Light</span>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
                  currentTheme === 'dark'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <Moon className="w-6 h-6" />
                <span className="text-sm">Dark</span>
              </button>

              <button
                onClick={() => setTheme('system')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors',
                  currentTheme === 'system'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <Monitor className="w-6 h-6" />
                <span className="text-sm">System</span>
              </button>
            </div>
          </section>

          {/* AI Language Section */}
          <section className="p-4 rounded-xl border border-border/50 bg-card/50">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-medium">AI Language</h2>
                <p className="text-sm text-muted-foreground">
                  Set the default output language and which languages are available for generation/translation.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    Default: {AI_LANGUAGE_OPTIONS.find((l) => l.value === defaultLanguage)?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {AI_LANGUAGE_OPTIONS.map((lang) => (
                    <DropdownMenuItem key={lang.value} onClick={() => setDefaultLanguage(lang.value)}>
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AI_LANGUAGE_OPTIONS.map((lang) => {
                const isEnabled = enabledLanguages.includes(lang.value)
                const isDefault = lang.value === defaultLanguage

                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => toggleEnabledLanguage(lang.value)}
                    disabled={isDefault}
                    aria-pressed={isEnabled}
                    className={cn(
                      'flex flex-col items-start gap-1 p-4 rounded-lg border transition-colors text-left',
                      isEnabled ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border',
                      isDefault && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    <span className="text-sm font-medium">{lang.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {isDefault ? 'Default' : isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Feed Tabs Section */}
          <section className="p-4 rounded-xl border border-border/50 bg-card/50">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-medium">Feed Tabs</h2>
                <p className="text-sm text-muted-foreground">
                  Choose up to 5 channels to show as tabs in your feed.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {pinnedChannelIds.size}/5 pinned
              </span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                className="pl-9 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {isLoadingChannels ? (
              <p className="text-sm text-muted-foreground">Loading channels...</p>
            ) : followedChannels.length === 0 && searchQuery.length < 2 ? (
              <p className="text-sm text-muted-foreground">You are not following any channels yet.</p>
            ) : (
              <div className="space-y-2">
                {(() => {
                  let channelsToShow: ChannelOption[] = []

                  if (searchQuery.length >= 2) {
                    channelsToShow = searchResults
                  } else {
                    const pinnedIds = new Set(pinnedChannels.map(c => c.id))
                    const uniqueFollowed = followedChannels.filter(c => !pinnedIds.has(c.id))
                    channelsToShow = [...pinnedChannels, ...uniqueFollowed]
                  }

                  return channelsToShow.map((channel) => {
                    const isPinned = pinnedChannelIds.has(channel.id)
                    return (
                      <div
                        key={channel.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border px-3 py-2 transition-colors',
                          isPinned ? 'border-primary/40 bg-primary/5' : 'border-border/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/50">
                            {channel.image_url ? (
                              <Image
                                src={channel.image_url}
                                alt=""
                                width={32}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Hash className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-sm font-medium truncate">#{channel.name}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isPinned ? 'default' : 'outline'}
                          onClick={() => togglePinnedChannel(channel)}
                          aria-pressed={isPinned}
                          className="shrink-0"
                        >
                          {isPinned ? 'Pinned' : 'Pin'}
                        </Button>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </section>

          {/* Version Switcher */}
          <section className="p-4 rounded-xl border border-border/50 bg-card/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-sm font-medium">Switch to Studio v1</h2>
                  <p className="text-sm text-muted-foreground">
                    Go back to the classic Castor interface.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSwitchToV1}>
                Switch
              </Button>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
