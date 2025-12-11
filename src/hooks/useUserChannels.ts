'use client'

import { useState, useEffect, useCallback } from 'react'

interface Channel {
  id: string
  name: string
  imageUrl?: string
  description?: string
  isFavorite?: boolean
}

interface UserChannelData {
  channelId: string
  channelName: string
  channelImageUrl?: string
  isFavorite: boolean
  useCount: number
  lastUsedAt?: string
}

export function useUserChannels() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [favorites, setFavorites] = useState<Channel[]>([])
  const [recent, setRecent] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchChannels = useCallback(async () => {
    try {
      // Obtener FID del usuario
      const meRes = await fetch('/api/me')
      if (!meRes.ok) {
        setIsLoading(false)
        return
      }
      
      const { fid } = await meRes.json()
      if (!fid) {
        setIsLoading(false)
        return
      }

      // Obtener canales de Neynar y favoritos/recientes en paralelo
      const [channelsRes, favoritesRes] = await Promise.all([
        fetch(`/api/channels?fid=${fid}`),
        fetch('/api/channels/favorites'),
      ])

      const { channels: neynarChannels } = channelsRes.ok ? await channelsRes.json() : { channels: [] }
      const { favorites: dbFavorites, recent: dbRecent } = favoritesRes.ok 
        ? await favoritesRes.json() 
        : { favorites: [], recent: [] }

      // Crear set de IDs favoritos para marcar
      const favoriteIds = new Set((dbFavorites as UserChannelData[]).map((f) => f.channelId))
      const recentIds = new Set((dbRecent as UserChannelData[]).map((r) => r.channelId))

      // Marcar canales como favoritos
      const markedChannels = (neynarChannels || []).map((ch: Channel) => ({
        ...ch,
        isFavorite: favoriteIds.has(ch.id),
      }))

      // Separar favoritos, recientes, y resto
      const favs = markedChannels.filter((ch: Channel) => ch.isFavorite)
      const recs = markedChannels.filter((ch: Channel) => !ch.isFavorite && recentIds.has(ch.id))
      const rest = markedChannels.filter((ch: Channel) => !ch.isFavorite && !recentIds.has(ch.id))

      setFavorites(favs)
      setRecent(recs)
      setChannels(rest)
    } catch (error) {
      console.error('Error fetching user channels:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  const toggleFavorite = useCallback(async (channel: Channel) => {
    const newIsFavorite = !channel.isFavorite
    
    // Optimistic update
    if (newIsFavorite) {
      setFavorites(prev => [...prev, { ...channel, isFavorite: true }])
      setChannels(prev => prev.filter(c => c.id !== channel.id))
      setRecent(prev => prev.filter(c => c.id !== channel.id))
    } else {
      setFavorites(prev => prev.filter(c => c.id !== channel.id))
      setChannels(prev => [...prev, { ...channel, isFavorite: false }])
    }

    try {
      await fetch('/api/channels/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.id,
          channelName: channel.name,
          channelImageUrl: channel.imageUrl,
          isFavorite: newIsFavorite,
        }),
      })
    } catch (error) {
      console.error('Error toggling favorite:', error)
      // Revert on error
      fetchChannels()
    }
  }, [fetchChannels])

  return { 
    channels, 
    favorites, 
    recent, 
    isLoading, 
    toggleFavorite,
    refetch: fetchChannels,
  }
}
