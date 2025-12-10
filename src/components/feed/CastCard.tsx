'use client'

import { useState, useRef, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Heart, Repeat2, MessageCircle, Globe, X, Send, Loader2, Share, Image, Film, ExternalLink, Trash2, Quote, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserPopover } from './UserPopover'
import { HLSVideo } from '@/components/ui/HLSVideo'
import { PowerBadge } from '@/components/ui/PowerBadge'
import { GifPicker } from '@/components/compose/GifPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AIReplyDialog } from './AIReplyDialog'
import { 
  CastRenderer, 
  TweetRenderer, 
  YouTubeRenderer, 
  LinkRenderer,
  extractYouTubeId,
  isFarcasterCastUrl,
} from '@/components/embeds'
import { toast } from 'sonner'

import { MorphText } from '@/components/ui/MorphText'
import { ScrambleText } from '@/components/ui/ScrambleText'

interface CastAuthor {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  power_badge?: boolean
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
      ogDescription?: string
      favicon?: string
    }
    frame?: {
      version?: string
      title?: string
      image?: string
      buttons?: { title?: string; index?: number }[]
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
  onOpenMiniApp?: (url: string, title: string) => void
  onQuote?: (castUrl: string) => void
  onDelete?: (castHash: string) => void
  onReply?: (cast: Cast) => void
  onSelectUser?: (username: string) => void
  currentUserFid?: number
  isPro?: boolean
}

export function CastCard({ 
  cast, 
  onOpenMiniApp,
  onQuote,
  onDelete,
  onReply,
  onSelectUser,
  currentUserFid,
  isPro = false,
}: CastCardProps) {
  const [translation, setTranslation] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isRecasted, setIsRecasted] = useState(false)
  const [likesCount, setLikesCount] = useState(cast.reactions.likes_count)
  const [recastsCount, setRecastsCount] = useState(cast.reactions.recasts_count)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [replies, setReplies] = useState<any[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyMedia, setReplyMedia] = useState<{ preview: string; url?: string; uploading: boolean; isGif?: boolean } | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showAIPicker, setShowAIPicker] = useState(false)
  const [aiReplyTarget, setAiReplyTarget] = useState<Cast | null>(null)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)
  const [showRecastMenu, setShowRecastMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showFullText, setShowFullText] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  
  const isOwnCast = currentUserFid === cast.author.fid
  const castUrl = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
  
  // Truncar texto largo (> 280 caracteres)
  const MAX_TEXT_LENGTH = 280
  const needsTruncation = cast.text.length > MAX_TEXT_LENGTH
  const displayText = showFullText || !needsTruncation 
    ? cast.text 
    : cast.text.slice(0, MAX_TEXT_LENGTH) + '...'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Auto-resize textarea cuando cambia el texto (ej: AI genera contenido)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [replyText])

  // Manejar selección de sugerencia AI
  const handleAIPublish = (text: string) => {
    setReplyText(text)
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

  // Subir imagen para reply
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    
    // Crear preview
    const preview = URL.createObjectURL(file)
    setReplyMedia({ preview, uploading: true })
    
    try {
      // Obtener URL de subida
      const urlRes = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error || 'Error al obtener URL')
      
      const { uploadUrl, cloudflareId } = urlJson.data
      
      // Subir imagen
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Error al subir imagen')
      
      // Confirmar subida
      const confirmRes = await fetch('/api/media/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudflareId, type: 'image' }),
      })
      const confirmJson = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirmJson.error || 'Error al confirmar')
      
      setReplyMedia({ preview, url: confirmJson.data.url, uploading: false })
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Error al subir imagen')
      setReplyMedia(null)
    }
    
    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Seleccionar GIF
  const handleGifSelect = (gifUrl: string) => {
    setReplyMedia({ preview: gifUrl, url: gifUrl, uploading: false, isGif: true })
    setShowGifPicker(false)
  }

  // Enviar respuesta
  const handleSendReply = async () => {
    if ((!replyText.trim() && !replyMedia?.url) || isSendingReply) return
    if (replyMedia?.uploading) {
      toast.error('Espera a que termine de subir la imagen')
      return
    }
    
    setIsSendingReply(true)
    try {
      const embeds = replyMedia?.url ? [{ url: replyMedia.url }] : undefined
      
      const res = await fetch('/api/casts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyText,
          parentHash: cast.hash,
          embeds,
        }),
      })
      
      if (!res.ok) throw new Error('Error al publicar')
      
      toast.success('Respuesta publicada')
      setReplyText('')
      setReplyMedia(null)
      
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

  // Unificado: bocadillo también expande el cast
  const handleToggleReplies = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    if (isExpanded) {
      // Si ya está expandido, colapsar
      setIsExpanded(false)
      return
    }
    
    // Expandir y cargar replies
    setIsExpanded(true)
    
    if (replies.length === 0 && cast.replies.count > 0) {
      setLoadingReplies(true)
      try {
        const res = await fetch(`/api/feed/replies?hash=${cast.hash}&limit=10`)
        const data = await res.json()
        setReplies(data.replies || [])
      } catch (error) {
        console.error('Error loading replies:', error)
      } finally {
        setLoadingReplies(false)
      }
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

  const handleQuote = () => {
    setShowRecastMenu(false)
    if (onQuote) {
      onQuote(castUrl)
    } else {
      navigator.clipboard.writeText(castUrl)
      toast.success('URL copiada. Pégala en el composer para citar.')
    }
  }

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return
    
    if (!confirm('¿Estás seguro de que quieres eliminar este cast?')) return
    
    setIsDeleting(true)
    try {
      onDelete(cast.hash)
    } finally {
      setIsDeleting(false)
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

  const handleShare = async () => {
    const url = `https://farcaster.xyz/${cast.author.username}/${cast.hash.slice(0, 10)}`
    
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado')
    } catch {
      toast.error('Error al copiar')
    }
  }

  const timeAgo = formatDistanceToNow(new Date(cast.timestamp), { 
    addSuffix: false,
    locale: es,
  })

  return (
    <div 
      ref={cardRef}
      onClick={handleToggleReplies}
      className={cn(
        "p-4 border rounded-lg bg-card transition-all cursor-pointer",
        isExpanded 
          ? "border-primary/50 shadow-lg ring-1 ring-primary/20" 
          : "border-border hover:bg-muted/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelectUser?.(cast.author.username)
          }}
          className="cursor-pointer"
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
        </button>
        
        <div className="flex-1 min-w-0">
          {/* Nombre + PRO */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelectUser?.(cast.author.username)
              }}
              className="font-semibold truncate hover:underline cursor-pointer"
            >
              {cast.author.display_name}
            </button>
            {(cast.author.power_badge || cast.author.pro?.status === 'subscribed') && <PowerBadge size={16} />}
          </div>
          {/* @username · tiempo · canal */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onSelectUser?.(cast.author.username)
              }}
              className="hover:underline cursor-pointer"
            >
              @{cast.author.username}
            </button>
            <span>·</span>
            <span>{timeAgo}</span>
            {cast.channel && (
              <>
                <span>·</span>
                <a 
                  href={`https://farcaster.xyz/~/channel/${cast.channel.id}`}
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
        <div className="relative">
          {/* Indicador de traducción flotante */}
          {showTranslation && (
            <div className="absolute -top-6 right-0 flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded animate-in fade-in zoom-in duration-300">
              <Globe className="w-3 h-3" />
              <span>Traducido</span>
            </div>
          )}
          
          {/* Texto con efecto Morph */}
          <MorphText 
            text={showTranslation && translation ? translation : displayText} 
            className={cn(
              "text-[16px] leading-relaxed whitespace-pre-wrap break-words transition-colors duration-300",
              showTranslation && translation 
                ? "text-primary/90 font-medium" 
                : "text-foreground"
            )}
          />
          
          {/* Botón ver más/menos */}
          {needsTruncation && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFullText(!showFullText)
              }}
              className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5"
            >
              {showFullText ? (
                <>ver menos <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>ver más <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          )}
        </div>
        
        {/* Embeds (images, videos, frames, links, quote casts) */}
        {cast.embeds && cast.embeds.length > 0 && (() => {
          // Helpers para detectar por URL cuando no hay metadata
          const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url)
          const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url) || 
            url.includes('stream.warpcast.com') || url.includes('cloudflarestream.com')
          
          const images = cast.embeds.filter(e => e.url && (
            e.metadata?.content_type?.startsWith('image/') || 
            (!e.metadata?.content_type && isImageUrl(e.url))
          ))
          const videos = cast.embeds.filter(e => e.url && (
            e.metadata?.content_type?.startsWith('video/') || 
            e.metadata?.video ||
            (!e.metadata?.content_type && isVideoUrl(e.url))
          ))
          // Frames/Miniapps
          const frames = cast.embeds.filter(e => e.url && (
            e.metadata?.frame?.version || 
            e.metadata?.frame?.image
          ))
          const quoteCasts = cast.embeds.filter(e => e.cast)
          // Media grid calculation
          const mediaCount = images.length + videos.length
          const getGridClass = (count: number) => {
            if (count === 1) return "grid-cols-1"
            if (count === 2) return "grid-cols-2 aspect-[2/1]"
            if (count === 3) return "grid-cols-2 aspect-[2/1]" // Especial handling for 3 via row-span
            return "grid-cols-2 aspect-square"
          }

          // Links (no images, videos, frames ni quotes)
          const processedUrls = new Set([
            ...images.map(e => e.url),
            ...videos.map(e => e.url),
            ...frames.map(e => e.url),
          ])
          const links = cast.embeds.filter(e => 
            e.url && 
            !e.cast &&
            !processedUrls.has(e.url) &&
            !e.metadata?.content_type?.startsWith('image/') &&
            !e.metadata?.content_type?.startsWith('video/')
          )
          
          // Separar tweets, youtube, farcaster casts y otros links
          const tweets = links.filter(e => 
            e.url && (e.url.includes('twitter.com/') || e.url.includes('x.com/')) && e.url.includes('/status/')
          )
          const youtubeLinks = links.filter(e =>
            e.url && (e.url.includes('youtube.com') || e.url.includes('youtu.be'))
          )
          const farcasterCastLinks = links.filter(e =>
            e.url && isFarcasterCastUrl(e.url)
          )
          const regularLinks = links.filter(e => 
            !tweets.some(t => t.url === e.url) &&
            !youtubeLinks.some(y => y.url === e.url) &&
            !farcasterCastLinks.some(f => f.url === e.url)
          )
          
          return (
            <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* Quote Casts */}
              {quoteCasts.map((embed, i) => embed.cast && (
                <button
                  key={`quote-${i}`}
                  onClick={() => onSelectUser?.(embed.cast!.author.username)}
                  className="block w-full text-left"
                >
                  <CastRenderer cast={embed.cast} />
                </button>
              ))}

              {/* Media Grid */}
              {(images.length > 0 || videos.length > 0) && (
                <div className={cn("grid gap-1 rounded-xl overflow-hidden", getGridClass(mediaCount))}>
                  {images.map((embed, i) => (
                    <button
                      key={`img-${i}`}
                      onClick={() => embed.url && setLightboxImage(embed.url)}
                      className={cn(
                        "relative w-full h-full bg-muted overflow-hidden hover:opacity-95 transition-opacity",
                        mediaCount === 1 ? "aspect-auto max-h-[500px]" : "aspect-square",
                        mediaCount === 3 && i === 0 ? "row-span-2 aspect-auto" : ""
                      )}
                    >
                      <img
                        src={embed.url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                  
                  {videos.map((embed, i) => (
                    <div 
                      key={`video-${i}`} 
                      className={cn(
                        "relative w-full h-full bg-black overflow-hidden",
                        mediaCount === 1 ? "aspect-video" : "aspect-square",
                        mediaCount === 3 && i === 0 && images.length === 0 ? "row-span-2 aspect-auto" : ""
                      )}
                    >
                      <HLSVideo
                        src={embed.url || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Frames / Miniapps (Scroll horizontal separado para no romper el grid) */}
              {frames.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {frames.map((embed, i) => {
                    const frameImage = embed.metadata?.frame?.image || embed.metadata?.html?.ogImage?.[0]?.url
                    const frameTitle = embed.metadata?.frame?.title || embed.metadata?.html?.ogTitle || 'Abrir Mini App'
                    const buttons = embed.metadata?.frame?.buttons || []
                    
                    if (!frameImage || !embed.url) return null
                    
                    return (
                      <div
                        key={`frame-${i}`}
                        className="w-full max-w-[300px] flex-shrink-0 rounded-xl overflow-hidden border border-border bg-card shadow-sm"
                      >
                        <div className="relative aspect-[1.91/1] bg-muted">
                           <img
                            src={frameImage}
                            alt={frameTitle}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                            FRAME
                          </div>
                        </div>
                        <div className="p-3 border-t border-border">
                          <h4 className="font-medium text-sm truncate mb-2">{frameTitle}</h4>
                          <div className="grid grid-cols-2 gap-2">
                             {buttons.slice(0, 2).map((btn, idx) => (
                               <button 
                                 key={idx}
                                 className="w-full py-1.5 px-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded transition-colors truncate border border-border/50"
                               >
                                 {btn.title || `Action ${idx + 1}`}
                               </button>
                             ))}
                             <button 
                               onClick={() => onOpenMiniApp?.(embed.url!, frameTitle)}
                               className={cn(
                                 "w-full py-1.5 px-2 bg-primary text-primary-foreground text-xs font-medium rounded transition-colors truncate flex items-center justify-center gap-1",
                                 buttons.length > 0 ? "col-span-2" : "col-span-2"
                               )}
                             >
                               <span>Abrir App</span>
                               <ExternalLink className="w-3 h-3" />
                             </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {/* Tweet Embeds */}
              {tweets.map((embed, i) => {
                const tweetId = embed.url?.match(/status\/(\d+)/)?.[1]
                return tweetId ? (
                  <TweetRenderer key={`tweet-${i}`} tweetId={tweetId} />
                ) : null
              })}

              {/* YouTube Embeds */}
              {youtubeLinks.map((embed, i) => {
                const videoId = extractYouTubeId(embed.url!)
                return videoId ? (
                  <YouTubeRenderer key={`yt-${i}`} videoId={videoId} />
                ) : null
              })}

              {/* Farcaster Cast Links */}
              {farcasterCastLinks.map((embed, i) => (
                <CastRenderer key={`fc-${i}`} url={embed.url!} />
              ))}

              {/* Link Previews */}
              {regularLinks.map((embed, i) => (
                <LinkRenderer key={`link-${i}`} url={embed.url!} />
              ))}
            </div>
          )
        })()}
      </div>

      {/* Actions - distributed across width */}
      <div className="mt-3 ml-0 sm:ml-13 flex items-center justify-between text-sm" onClick={(e) => e.stopPropagation()}>
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
            isLiked 
              ? "text-pink-500" 
              : "text-muted-foreground hover:text-pink-500"
          )}
        >
          <Heart className={cn("w-4 h-4 transition-transform group-active:scale-125", isLiked && "fill-current")} />
          <span className="text-xs">{likesCount}</span>
        </button>

        {/* Recast */}
        <Popover open={showRecastMenu} onOpenChange={setShowRecastMenu}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
                isRecasted 
                  ? "text-green-500" 
                  : "text-muted-foreground hover:text-green-500"
              )}
            >
              <Repeat2 className={cn("w-4 h-4 transition-transform group-active:scale-125", isRecasted && "fill-current")} />
              <span className="text-xs">{recastsCount}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <button
              onClick={() => { handleRecast(); setShowRecastMenu(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Repeat2 className="w-4 h-4" />
              <span>Recast</span>
            </button>
            <button
              onClick={handleQuote}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Quote className="w-4 h-4" />
              <span>Quote</span>
            </button>
          </PopoverContent>
        </Popover>

        {/* Reply */}
        <button 
          onClick={() => {
            if (onReply) {
              onReply(cast)
            } else {
              handleToggleReplies()
            }
          }}
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors",
            isExpanded 
              ? "text-blue-500" 
              : "text-muted-foreground hover:text-blue-500"
          )}
        >
          <MessageCircle className="w-4 h-4 transition-transform group-active:scale-125" />
          <span className="text-xs">{loadingReplies ? '...' : cast.replies.count}</span>
        </button>

        {/* Translate */}
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className={cn(
            "group flex items-center px-2 py-1.5 rounded-md transition-colors",
            showTranslation 
              ? "text-blue-500" 
              : "text-muted-foreground hover:text-foreground"
          )}
          title="Traducir"
        >
          {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
        </button>

        {/* Delete (solo para casts propios) */}
        {isOwnCast && onDelete && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="group flex items-center px-2 py-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
            title="Eliminar"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}

        {/* Share - último */}
        <button
          onClick={handleShare}
          className="group flex items-center px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Compartir"
        >
          <Share className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded Section: Composer first, then Replies */}
      {isExpanded && (
        <div className="mt-4 ml-0 sm:ml-13 space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* Composer placeholder - Opens modal */}
          <div className="pt-4 border-t border-border">
            <button
              onClick={() => onReply?.(cast)}
              className="w-full px-3 py-3 text-sm text-left text-muted-foreground rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors"
            >
              Responder a @{cast.author.username}...
            </button>
          </div>

          {/* Replies - Scrollable area with max 5 */}
          {loadingReplies ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : replies.length > 0 && (
            <div className="max-h-64 overflow-y-auto space-y-4 border-l-2 border-border/50 pl-4 ml-2 scrollbar-thin">
              {replies.slice(0, 5).map((reply) => (
                <div key={reply.hash} className="text-sm group">
                  <div className="flex items-start gap-2">
                    {reply.author && (
                      <UserPopover
                        fid={reply.author.fid}
                        username={reply.author.username}
                        displayName={reply.author.display_name}
                        pfpUrl={reply.author.pfp_url}
                      >
                        <img 
                          src={reply.author.pfp_url || `https://avatar.vercel.sh/${reply.author.username}`} 
                          alt={reply.author.username}
                          className="w-6 h-6 rounded-full hover:opacity-80 object-cover mt-0.5"
                        />
                      </UserPopover>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-xs hover:underline cursor-pointer">
                          {reply.author?.display_name}
                        </span>
                        <span className="text-muted-foreground text-xs">@{reply.author?.username}</span>
                        <span className="text-muted-foreground text-[10px] mx-0.5">·</span>
                        <span className="text-muted-foreground text-[10px]">
                          {formatDistanceToNow(new Date(reply.timestamp), { addSuffix: false, locale: es })}
                        </span>
                      </div>
                      
                      <p className="text-[15px] leading-relaxed text-foreground mt-0.5 break-words">{reply.text}</p>
                      
                      {/* Imágenes en respuestas */}
                      {reply.embeds && reply.embeds.length > 0 && (
                        <div className="mt-2 flex gap-2 overflow-x-auto">
                          {reply.embeds
                            .filter((e: any) => e.metadata?.content_type?.startsWith('image/') || e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
                            .map((e: any, idx: number) => (
                              <img 
                                key={idx}
                                src={e.url} 
                                alt="" 
                                className="h-24 rounded-lg object-cover border border-border"
                              />
                            ))
                          }
                        </div>
                      )}

                      <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="flex items-center gap-1.5 hover:text-pink-500 transition-colors"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await fetch('/api/feed/reaction', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ castHash: reply.hash, reactionType: 'like' }),
                              })
                              toast.success('Like añadido')
                            } catch {
                              toast.error('Error al dar like')
                            }
                          }}
                        >
                          <Heart className="w-4 h-4" />
                          {reply.reactions?.likes_count || 0}
                        </button>
                        <button 
                          className="flex items-center gap-1.5 hover:text-green-500 transition-colors"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await fetch('/api/feed/reaction', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ castHash: reply.hash, reactionType: 'recast' }),
                              })
                              toast.success('Recast añadido')
                            } catch {
                              toast.error('Error al recastear')
                            }
                          }}
                        >
                          <Repeat2 className="w-4 h-4" />
                          {reply.reactions?.recasts_count || 0}
                        </button>
                        <button 
                          className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Construir un Cast-like object para el modal
                            onReply?.({
                              hash: reply.hash,
                              text: reply.text,
                              timestamp: reply.timestamp,
                              author: reply.author,
                              reactions: reply.reactions || { likes_count: 0, recasts_count: 0 },
                              replies: { count: 0 },
                            })
                          }}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button 
                          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            const replyUrl = `https://farcaster.xyz/${reply.author?.username}/${reply.hash.slice(0, 10)}`
                            navigator.clipboard.writeText(replyUrl)
                            toast.success('Enlace copiado')
                          }}
                        >
                          <Share className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {replies.length > 5 && (
                <button 
                  className="w-full text-xs text-muted-foreground text-center py-2 hover:text-primary transition-colors"
                  onClick={() => {/* TODO: Cargar más o ir al detalle */}}
                >
                  Ver {replies.length - 5} respuestas más
                </button>
              )}
            </div>
          )}
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

      {/* AI Reply Dialog */}
      {aiReplyTarget && (
        <AIReplyDialog
          cast={aiReplyTarget}
          open={showAIPicker}
          onOpenChange={(open) => {
            setShowAIPicker(open)
            if (!open) setAiReplyTarget(null)
          }}
          onPublish={handleAIPublish}
          maxChars={isPro ? 10000 : 1024}
        />
      )}
    </div>
  )
}
