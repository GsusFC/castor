'use client'

import { useState } from 'react'
import { RefreshCw, Send, Calendar, Sparkles, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  onSchedule?: (text: string, castHash: string) => void
}

const TONES = [
  { value: 'professional', label: 'Profesional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Amigable' },
  { value: 'witty', label: 'Ingenioso' },
]

const LANGUAGES = [
  { value: 'English', label: 'Inglés' },
  { value: 'Spanish', label: 'Español' },
]

export function AIReplyDialog({ 
  cast, 
  open, 
  onOpenChange,
  onPublish,
  onSchedule,
}: AIReplyDialogProps) {
  const [tone, setTone] = useState('friendly')
  const [language, setLanguage] = useState('English')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [translation, setTranslation] = useState<string | null>(null)
  const [detectedInfo, setDetectedInfo] = useState<{ topic?: string; tone?: string }>({})
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)

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

  const generateSuggestions = async () => {
    if (!cast) return

    setIsLoading(true)
    setSuggestions([])
    
    try {
      // Primero traducir si es necesario
      const translateRes = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cast.text }),
      })
      const translateData = await translateRes.json()
      if (translateData.translation) {
        setTranslation(translateData.translation)
      }

      // Generar sugerencias
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: cast.text,
          authorUsername: cast.author.username,
          tone,
          language,
        }),
      })
      const data = await res.json()
      
      if (data.suggestions) {
        setSuggestions(data.suggestions)
      }
      if (data.detectedTopic || data.detectedTone) {
        setDetectedInfo({
          topic: data.detectedTopic,
          tone: data.detectedTone,
        })
      }
    } catch (error) {
      console.error('AI Reply error:', error)
    } finally {
      setIsLoading(false)
    }
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

  const handleSchedule = () => {
    if (replyText && cast) {
      onSchedule?.(replyText, cast.hash)
      onOpenChange(false)
      resetState()
    }
  }

  const resetState = () => {
    setSuggestions([])
    setReplyText('')
    setTranslation(null)
    setDetectedInfo({})
  }

  // Generar sugerencias al abrir
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && cast) {
      generateSuggestions()
    } else if (!newOpen) {
      resetState()
    }
    onOpenChange(newOpen)
  }

  if (!cast) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Responder a @{cast.author.username}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cast original */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              {cast.author.pfp_url && (
                <img 
                  src={cast.author.pfp_url} 
                  alt={cast.author.username}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="font-medium text-sm">@{cast.author.username}</span>
            </div>
            <p className="text-sm">{cast.text}</p>
            
            {translation && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">🌐 Traducción:</p>
                <p className="text-sm text-muted-foreground">{translation}</p>
              </div>
            )}
          </div>

          {/* Contexto detectado */}
          {(detectedInfo.topic || detectedInfo.tone) && (
            <div className="text-xs text-muted-foreground">
              {detectedInfo.topic && <span>• Tema: {detectedInfo.topic}</span>}
              {detectedInfo.tone && <span className="ml-3">• Tono: {detectedInfo.tone}</span>}
            </div>
          )}

          {/* Opciones */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Tono</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sugerencias */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Sugerencias AI</span>
              <button
                onClick={generateSuggestions}
                disabled={isLoading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Regenerar
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleUseSuggestion(suggestion)}
                    className="w-full p-3 text-left text-sm rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay sugerencias disponibles
              </p>
            )}
          </div>

          {/* Tu respuesta */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Tu respuesta</label>
              {replyText.trim() && (
                <button
                  onClick={translateReply}
                  disabled={isTranslatingReply}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                  <Globe className="w-3 h-3" />
                  {isTranslatingReply ? 'Traduciendo...' : `Traducir a ${language === 'English' ? 'inglés' : 'español'}`}
                </button>
              )}
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escribe tu respuesta..."
              className="w-full mt-2 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none"
              rows={3}
            />
            <div className="text-xs text-muted-foreground text-right mt-1">
              {replyText.length}/320
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSchedule}
              disabled={!replyText}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              Programar
            </button>
            <button
              onClick={handlePublish}
              disabled={!replyText}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
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
