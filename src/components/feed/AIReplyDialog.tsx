'use client'

import { useState } from 'react'
import { RefreshCw, Send, Sparkles, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Cast {
  hash: string
  text: string
  author: {
    username: string
    display_name: string
    pfp_url?: string
  }
}

interface AIReplyDialogProps {
  cast: Cast | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish?: (text: string, castHash: string) => void
}

const TONES = [
  { value: 'professional', label: 'Profesional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😎' },
  { value: 'friendly', label: 'Amigable', emoji: '🤝' },
  { value: 'witty', label: 'Ingenioso', emoji: '✨' },
  { value: 'controversial', label: 'Polémico', emoji: '🔥' },
]

const LANGUAGES = [
  { value: 'English', label: 'EN', flag: '🇺🇸' },
  { value: 'Spanish', label: 'ES', flag: '🇪🇸' },
]

export function AIReplyDialog({ 
  cast, 
  open, 
  onOpenChange,
  onPublish,
}: AIReplyDialogProps) {
  const [tone, setTone] = useState('friendly')
  const [language, setLanguage] = useState('English')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)
  const [showFullText, setShowFullText] = useState(false)

  const translateReply = async () => {
    if (!replyText.trim()) return
    
    setIsTranslatingReply(true)
    try {
      const targetLang = language === 'English' ? 'English' : 'Spanish'
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: replyText,
          targetLanguage: targetLang,
        }),
      })
      const data = await res.json()
      if (data.translation) {
        setReplyText(data.translation)
      }
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setIsTranslatingReply(false)
    }
  }

  const generateSuggestions = async (selectedTone?: string) => {
    if (!cast) return

    const toneToUse = selectedTone || tone
    setIsLoading(true)
    setSuggestions([])
    
    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: cast.text,
          authorUsername: cast.author.username,
          tone: toneToUse,
          language,
        }),
      })
      const data = await res.json()
      
      if (data.suggestions) {
        setSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error('AI Reply error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToneChange = (newTone: string) => {
    setTone(newTone)
    generateSuggestions(newTone)
  }

  const handleUseSuggestion = (suggestion: string) => {
    setReplyText(suggestion)
  }

  const handlePublish = () => {
    if (replyText && cast) {
      onPublish?.(replyText, cast.hash)
      onOpenChange(false)
      resetState()
    }
  }

  const resetState = () => {
    setSuggestions([])
    setReplyText('')
    setShowFullText(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && cast) {
      generateSuggestions()
    } else if (!newOpen) {
      resetState()
    }
    onOpenChange(newOpen)
  }

  if (!cast) return null

  // Truncar texto a ~100 caracteres
  const truncatedText = cast.text.length > 100 
    ? cast.text.slice(0, 100) + '...' 
    : cast.text
  const needsTruncation = cast.text.length > 100

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-[600px] p-0 gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-primary" />
            Responder a @{cast.author.username}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Cast original - Colapsado */}
          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-start gap-2">
              {cast.author.pfp_url && (
                <img 
                  src={cast.author.pfp_url} 
                  alt={cast.author.username}
                  className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  {showFullText ? cast.text : truncatedText}
                </p>
                {needsTruncation && (
                  <button
                    onClick={() => setShowFullText(!showFullText)}
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
            </div>
          </div>

          {/* Tono - Pills horizontales */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tono</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleToneChange(t.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-all",
                    tone === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Idioma - Pills compactos */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Idioma</label>
            <div className="flex gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
                  className={cn(
                    "px-2.5 py-1 text-sm rounded-md border transition-all",
                    language === l.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sugerencias */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sugerencias
              </label>
              <button
                onClick={() => generateSuggestions()}
                disabled={isLoading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                Regenerar
              </button>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleUseSuggestion(suggestion)}
                    className={cn(
                      "w-full p-3 text-left text-sm rounded-lg border transition-all group",
                      replyText === suggestion
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                  >
                    <p className="line-clamp-2">{suggestion}</p>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Selecciona un tono para generar sugerencias
                </div>
              )}
            </div>
          </div>

          {/* Tu respuesta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tu respuesta
              </label>
              {replyText.trim() && (
                <button
                  onClick={translateReply}
                  disabled={isTranslatingReply}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                  <Globe className="w-3 h-3" />
                  {isTranslatingReply ? 'Traduciendo...' : `→ ${language === 'English' ? 'EN' : 'ES'}`}
                </button>
              )}
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escribe o selecciona una sugerencia..."
              maxLength={1024}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:ring-1 focus:ring-primary focus:border-primary"
              rows={3}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{replyText.length}/1024</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={!replyText.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Publicar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
