'use client'

import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Heart, Repeat2, MessageCircle, Bookmark, Globe, Sparkles, X, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserPopover } from './UserPopover'
import { toast } from 'sonner'

interface CastAuthor {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  pro?: { status: string }
}

interface CastChannel {
  id: string
  name: string
  image_url?: string
}

interface CastReactions {
  likes_count: number
  recasts_count: number
}

interface EmbeddedCast {
  hash: string
  text: string
  timestamp: string
  author: {
    fid: number
    username: string
    display_name: string
    pfp_url?: string
  }
  embeds?: { url: string; metadata?: { content_type?: string } }[]
  channel?: { id: string; name: string }
}

interface CastEmbed {
  url?: string
  cast?: EmbeddedCast
  metadata?: {
    content_type?: string
    image?: { width_px: number; height_px: number }
    video?: { 
      streams?: { codec_name?: string }[]
      duration_s?: number 
    }
    html?: {
      ogImage?: { url: string }[]
      ogTitle?: string
    }
    frame?: {
      title?: string
      image?: string
    }
  }
}

interface Cast {
  hash: string
  text: string
  timestamp: string
  author: CastAuthor
  reactions: CastReactions
  replies: { count: number }
  embeds?: CastEmbed[]
  channel?: CastChannel
}

interface CastCardProps {
  cast: Cast
  onTranslate?: (text: string) => void
  onAIReply?: (cast: Cast) => void
  onLike?: (hash: string) => void
  onRecast?: (hash: string) => void
  onSave?: (cast: Cast) => void
  onOpenMiniApp?: (url: string, title: string) => void
}

export function CastCard({ 
  cast, 
  onTranslate, 
  onAIReply,
  onLike,
  onRecast,
  onSave,
  onOpenMiniApp,
}: CastCardProps) {
  const [translation, setTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isRecasted, setIsRecasted] = useState(false)
  const [likesCount, setLikesCount] = useState(cast.reactions.likes_count)
  const [recastsCount, setRecastsCount] = useState(cast.reactions.recasts_count)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isExpanded) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isExpanded])

  // Cargar replies al expandir
  const handleExpand = async () => {
    if (isExpanded) return
    setIsExpanded(true)
    
    if (replies.length === 0 && cast.replies.count > 0) {
      setLoadingReplies(true)
      try {
        const res = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
        const data = await res.json()
        setReplies(data.replies || [])
        setShowReplies(true)
      } catch (error) {
        console.error('Error loading replies:', error)
      } finally {
        setLoadingReplies(false)
      }
    } else if (replies.length > 0) {
      setShowReplies(true)
    }
  }

  // Generar respuesta con AI
  const handleGenerateAIReply = async () => {
    setIsGeneratingAI(true)
    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castText: cast.text }),
      })
      const data = await res.json()
      if (data.reply) {
        setReplyText(data.reply)
      }
    } catch (error) {
      toast.error('Error al generar respuesta')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Traducir respuesta a inglés
  const handleTranslateReply = async () => {
    if (!replyText.trim()) return
    setIsTranslatingReply(true)
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText, targetLanguage: 'English' }),
      })
      const data = await res.json()
      if (data.translation) {
        setReplyText(data.translation)
      }
    } catch (error) {
      toast.error('Error al traducir')
    } finally {
      setIsTranslatingReply(false)
    }
  }

  // Enviar respuesta
  const handleSendReply = async () => {
    if (!replyText.trim() || isSendingReply) return
    
    setIsSendingReply(true)
    try {
      const res = await fetch('/api/casts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyText,
          parentHash: cast.hash,
        }),
      })
      
      if (!res.ok) throw new Error('Error al publicar')
      
      toast.success('Respuesta publicada')
      setReplyText('')
      
      // Recargar replies
      const repliesRes = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
      const data = await repliesRes.json()
      setReplies(data.replies || [])
    } catch (error) {
      toast.error('Error al publicar respuesta')
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleLoadReplies = async () => {
    if (showReplies) {
      setShowReplies(false)
      return
    }
    if (replies.length > 0) {
      setShowReplies(true)
      return
    }
    setLoadingReplies(true)
    try {
      const res = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=5`)
      const data = await res.json()
      setReplies(data.replies || [])
      setShowReplies(true)
    } catch (error) {
      console.error('Error loading replies:', error)
    } finally {
      setLoadingReplies(false)
    }
  }

  const handleLike = async () => {
    const wasLiked = isLiked
    setIsLiked(!wasLiked)
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1)
    
    try {
      const res = await fetch('/api/feed/reaction', {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'like' }),
      })
      if (!res.ok) {
        // Revertir si falla
        setIsLiked(wasLiked)
        setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
      }
    } catch {
      setIsLiked(wasLiked)
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1)
    }
  }

  const handleRecast = async () => {
    const wasRecasted = isRecasted
    setIsRecasted(!wasRecasted)
    setRecastsCount(prev => wasRecasted ? prev - 1 : prev + 1)
    
    try {
      const res = await fetch('/api/feed/reaction', {
        method: wasRecasted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ castHash: cast.hash, reactionType: 'recast' }),
      })
      if (!res.ok) {
        // Revertir si falla
        setIsRecasted(wasRecasted)
        setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
      }
    } catch {
      setIsRecasted(wasRecasted)
      setRecastsCount(prev => wasRecasted ? prev + 1 : prev - 1)
    }
  }

  const handleTranslate = async () => {
    if (translation) {
      setShowTranslation(!showTranslation)
      return
    }

    setIsTranslating(true)
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cast.text }),
      })
      const data = await res.json()
      if (data.translation) {
        setTranslation(data.translation)
        setShowTranslation(true)
      }
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setIsTranslating(false)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(cast.timestamp), { 
    addSuffix: false,
    locale: es,
  })

  return (
    <div 
      ref={cardRef}
      onClick={handleExpand}
      className={cn(
        "p-4 border rounded-lg bg-card transition-all cursor-pointer",
        isExpanded 
          ? "border-primary/50 shadow-lg ring-1 ring-primary/20" 
          : "border-border hover:bg-muted/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
        <UserPopover
          fid={cast.author.fid}
          username={cast.author.username}
          displayName={cast.author.display_name}
          pfpUrl={cast.author.pfp_url}
        >
          {cast.author.pfp_url ? (
            <img 
              src={cast.author.pfp_url} 
              alt={cast.author.username}
              className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:opacity-80 transition-opacity">
              <span className="text-sm font-medium">
                {cast.author.display_name?.[0] || cast.author.username?.[0] || '?'}
              </span>
            </div>
          )}
        </UserPopover>
        
        <div className="flex-1 min-w-0">
          {/* Nombre + PRO */}
          <div className="flex items-center gap-1.5">
            <UserPopover
              fid={cast.author.fid}
              username={cast.author.username}
              displayName={cast.author.display_name}
              pfpUrl={cast.author.pfp_url}
            >
              <span className="font-semibold truncate hover:underline">{cast.author.display_name}</span>
            </UserPopover>
            {cast.author.pro?.status === 'subscribed' && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">
                PRO
              </span>
            )}
          </div>
          {/* @username · tiempo · canal */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>@{cast.author.username}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            {cast.channel && (
              <>
                <span>·</span>
                <a 
                  href={`https://warpcast.com/~/channel/${cast.channel.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  {cast.channel.image_url && (
                    <img src={cast.channel.image_url} alt="" className="w-3.5 h-3.5 rounded" />
                  )}
                  <span>/{cast.channel.id}</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 ml-0 sm:ml-13">
        <p className="whitespace-pre-wrap break-words">{cast.text}</p>
        
        {/* Embeds (images, videos, frames, quote casts) */}
        {cast.embeds && cast.embeds.length > 0 && (() => {
          const images = cast.embeds.filter(e => e.url && e.metadata?.content_type?.startsWith('image/'))
          const videos = cast.embeds.filter(e => e.url && (e.metadata?.content_type?.startsWith('video/') || e.metadata?.video))
          const frames = cast.embeds.filter(e => e.url && e.metadata?.frame)
          const quoteCasts = cast.embeds.filter(e => e.cast)
          
          return (
            <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* Quote Casts */}
              {quoteCasts.map((embed, i) => embed.cast && (
                <a
                  key={`quote-${i}`}
                  href={`https://warpcast.com/${embed.cast.author.username}/${embed.cast.hash.slice(0, 10)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {embed.cast.author.pfp_url && (
                      <img 
                        src={embed.cast.author.pfp_url} 
                        alt="" 
                        className="w-5 h-5 rounded-full"
                      />
                    )}
                    <span className="font-medium text-sm">{embed.cast.author.display_name}</span>
                    <span className="text-muted-foreground text-xs">@{embed.cast.author.username}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{embed.cast.text}</p>
                  {embed.cast.embeds?.[0]?.url && embed.cast.embeds[0].metadata?.content_type?.startsWith('image/') && (
                    <img 
                      src={embed.cast.embeds[0].url} 
                      alt="" 
                      className="mt-2 rounded max-h-32 object-cover"
                    />
                  )}
                </a>
              ))}

              {/* Media en fila */}
              {(images.length > 0 || videos.length > 0 || frames.length > 0) && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {/* Imágenes */}
                  {images.map((embed, i) => (
                    <button
                      key={`img-${i}`}
                      onClick={() => embed.url && setLightboxImage(embed.url)}
                      className="relative h-44 w-44 flex-shrink-0 overflow-hidden rounded-lg bg-muted"
                    >
                      <img
                        src={embed.url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </button>
                  ))}
                  
                  {/* Videos */}
                  {videos.map((embed, i) => (
                    <div key={`video-${i}`} className="h-44 w-60 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                      <video
                        src={embed.url}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    </div>
                  ))}
                  
                  {/* Miniapps */}
                  {frames.map((embed, i) => {
                    const frameImage = embed.metadata?.frame?.image || embed.metadata?.html?.ogImage?.[0]?.url
                    const frameTitle = embed.metadata?.frame?.title || embed.metadata?.html?.ogTitle || 'Abrir'
                    
                    if (!frameImage || !embed.url) return null
                    
                    return (
                      <div
                        key={`frame-${i}`}
                        className="w-56 flex-shrink-0 rounded-xl overflow-hidden border border-border bg-card"
                      >
                        <img
                          src={frameImage}
                          alt={frameTitle}
                          className="w-full h-36 object-cover"
                          loading="lazy"
                        />
                        <div className="p-2 border-t border-border">
                          <button 
                            onClick={() => onOpenMiniApp?.(embed.url!, frameTitle)}
                            className="w-full py-1.5 px-3 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs rounded transition-colors truncate"
                          >
                            {frameTitle}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
        
        {/* Translation */}
        {showTranslation && translation && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Globe className="w-3 h-3" />
              <span>Traducción al español</span>
            </div>
            <p className="text-sm">{translation}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 ml-0 sm:ml-13 flex items-center gap-1 sm:gap-2 text-sm flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md transition-colors",
            isLiked 
              ? "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20" 
              : "text-muted-foreground hover:text-pink-500 hover:bg-muted"
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
          <span>{likesCount}</span>
        </button>

        <button
          onClick={handleRecast}
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md transition-colors",
            isRecasted 
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" 
              : "text-muted-foreground hover:text-green-500 hover:bg-muted"
          )}
        >
          <Repeat2 className={cn("w-4 h-4", isRecasted && "fill-current")} />
          <span>{recastsCount}</span>
        </button>

        <button 
          onClick={handleLoadReplies}
          className={cn(
            "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md transition-colors",
            showReplies 
              ? "bg-blue-500/10 text-blue-500" 
              : "text-muted-foreground hover:text-blue-500 hover:bg-muted"
          )}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{loadingReplies ? '...' : cast.replies.count}</span>
        </button>

        <button
          onClick={() => onSave?.(cast)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bookmark className="w-4 h-4" />
        </button>

        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors",
            showTranslation 
              ? "bg-blue-500/10 text-blue-500" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Globe className="w-4 h-4" />
        </button>

        <button
          onClick={() => onAIReply?.(cast)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* Replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-3 ml-0 sm:ml-13 space-y-3 border-l-2 border-border pl-3 sm:pl-4" onClick={(e) => e.stopPropagation()}>
          {replies.map((reply) => (
            <div key={reply.hash} className="text-sm group">
              <div className="flex items-center gap-2">
                {reply.author && (
                  <UserPopover
                    fid={reply.author.fid}
                    username={reply.author.username}
                    displayName={reply.author.display_name}
                    pfpUrl={reply.author.pfp_url}
                  >
                    <div className="flex items-center gap-2">
                      {reply.author.pfp_url && (
                        <img 
                          src={reply.author.pfp_url} 
                          alt={reply.author.username}
                          className="w-5 h-5 rounded-full hover:opacity-80"
                        />
                      )}
                      <span className="font-medium hover:underline">{reply.author.display_name}</span>
                      <span className="text-muted-foreground text-xs">@{reply.author.username}</span>
                    </div>
                  </UserPopover>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">{reply.text}</p>
              
              {/* Reply actions */}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {reply.reactions?.likes_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 className="w-3 h-3" />
                  {reply.reactions?.recasts_count || 0}
                </span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onLike?.(reply.hash)}
                    className="hover:text-pink-500 transition-colors"
                    title="Like"
                  >
                    <Heart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRecast?.(reply.hash)}
                    className="hover:text-green-500 transition-colors"
                    title="Recast"
                  >
                    <Repeat2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onAIReply?.({
                      hash: reply.hash,
                      text: reply.text,
                      timestamp: reply.timestamp,
                      author: reply.author,
                      reactions: reply.reactions || { likes_count: 0, recasts_count: 0 },
                      replies: { count: 0 },
                    })}
                    className="hover:text-primary transition-colors"
                    title="AI Reply"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Reply Composer (solo cuando está expandido) */}
      {isExpanded && (
        <div 
          className="mt-4 ml-0 sm:ml-13 pt-4 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Responder a @${cast.author.username}...`}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendReply()
                  }
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingAI}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    title="Generar respuesta con AI"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>AI</span>
                  </button>
                  {replyText.trim() && (
                    <button
                      onClick={handleTranslateReply}
                      disabled={isTranslatingReply}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-blue-500 hover:bg-muted transition-colors"
                      title="Traducir a inglés"
                    >
                      {isTranslatingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      <span>EN</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSendingReply}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    replyText.trim() 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isSendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Responder</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para imágenes */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxImage}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
