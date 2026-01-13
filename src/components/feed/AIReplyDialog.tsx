'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Send, Sparkles, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { BrandValidationResult } from '@/lib/ai/brand-validator'
import { ReplyStrategySelector, type ReplyStrategy } from '@/components/ai/ReplyStrategySelector'
import { SuggestionCard } from '@/components/ai/SuggestionCard'
import { buildAssistantRequest, getAssistantErrorMessage } from '@/lib/ai/assistant-client'

import { useSelectedAccount } from '@/context/SelectedAccountContext'

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
  maxChars?: number
}

const TONES = [
  { value: 'professional', label: 'Profesional', emoji: '💼' },
  { value: 'casual', label: 'Casual', emoji: '😎' },
  { value: 'friendly', label: 'Amigable', emoji: '🤝' },
  { value: 'witty', label: 'Ingenioso', emoji: '✨' },
  { value: 'controversial', label: 'Polémico', emoji: '🔥' },
]

const LANGUAGES = [
  { value: 'en', label: 'EN', flag: '🇺🇸' },
  { value: 'es', label: 'ES', flag: '🇪🇸' },
]

type AISuggestion = {
  id: string
  text: string
  length: number
  brandValidation?: BrandValidationResult
}

export function AIReplyDialog({ 
  cast, 
  open, 
  onOpenChange,
  onPublish,
  maxChars = 1024,
}: AIReplyDialogProps) {
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount()
  const lastGeneratedAccountIdRef = useRef<string | null>(null)
  const [tone, setTone] = useState('friendly')
  const [language, setLanguage] = useState('en')
  const [strategy, setStrategy] = useState<ReplyStrategy | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isTranslatingReply, setIsTranslatingReply] = useState(false)
  const [showFullText, setShowFullText] = useState(false)
  const [accounts, setAccounts] = useState<Array<{ id: string; username: string; pfpUrl?: string | null }>>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [isBrandModeOn, setIsBrandModeOn] = useState<boolean | null>(null)
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (selectedAccountId) return

    let isActive = true
    const loadAccounts = async () => {
      setIsLoadingAccounts(true)
      setAccountsError(null)
      try {
        const res = await fetch('/api/accounts')
        const data = res.ok ? await res.json() : null
        const nextAccounts = (data?.accounts as Array<{ id: string; username: string; pfpUrl?: string | null }> | undefined) ?? []
        if (!isActive) return
        setAccounts(nextAccounts)
      } catch (err) {
        if (!isActive) return
        setAccountsError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas')
      } finally {
        if (!isActive) return
        setIsLoadingAccounts(false)
      }
    }

    loadAccounts()
    return () => {
      isActive = false
    }
  }, [open, selectedAccountId])

  useEffect(() => {
    if (!open) return
    if (!selectedAccountId) {
      setIsBrandModeOn(null)
      return
    }

    let isActive = true
    const loadBrandMode = async () => {
      try {
        const res = await fetch(`/api/accounts/${selectedAccountId}/context`)
        const data = res.ok ? await res.json() : null
        const brandVoice = (data?.knowledgeBase?.brandVoice as string | undefined) ?? ''
        if (!isActive) return
        setIsBrandModeOn(brandVoice.trim().length > 0)
      } catch {
        if (!isActive) return
        setIsBrandModeOn(false)
      }
    }

    loadBrandMode()
    return () => {
      isActive = false
    }
  }, [open, selectedAccountId])

  const translateReply = async () => {
    if (!replyText.trim()) return
    if (!selectedAccountId) {
      setError('Selecciona una cuenta para usar IA')
      return
    }

    setIsTranslatingReply(true)
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssistantRequest({
          mode: 'translate',
          draft: replyText,
          targetLanguage: language,
          accountId: selectedAccountId,
          isPro: false,
        })),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(getAssistantErrorMessage(data, 'Error al traducir'))
      }
      const nextTranslation = (data?.suggestions?.[0]?.text as string | undefined)?.trim()
      if (nextTranslation) setReplyText(nextTranslation)
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setIsTranslatingReply(false)
    }
  }

  const generateSuggestions = async (selectedTone?: string, selectedLanguage?: string) => {
    if (!cast) return
    if (!selectedAccountId) {
      setError('Selecciona una cuenta para usar IA')
      return
    }

    const toneToUse = selectedTone || tone
    const languageToUse = selectedLanguage || language
    setIsLoading(true)
    setSuggestions([])
    setError(null)
    
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'write',
          replyingTo: {
            text: cast.text,
            author: cast.author.username,
          },
          targetTone: toneToUse,
          targetLanguage: languageToUse,
          isPro: false,
          accountId: selectedAccountId,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        const message = (data?.message as string | undefined) ?? (data?.error as string | undefined)
        throw new Error(message || 'Error al generar sugerencias')
      }
      
      const nextSuggestions = (data?.suggestions as AISuggestion[] | undefined) ?? []
      setSuggestions(nextSuggestions)
      if (nextSuggestions.length === 0) {
        setError('No se pudieron generar sugerencias. Prueba a regenerar.')
      }
    } catch (error) {
      console.error('AI Reply error:', error)
      setError(error instanceof Error ? error.message : 'Error al generar sugerencias')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToneChange = (newTone: string) => {
    setTone(newTone)
    generateSuggestions(newTone)
  }

  const handleUseSuggestion = (suggestion: AISuggestion) => {
    setReplyText(suggestion.text)
  }

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    generateSuggestions(undefined, newLanguage)
  }

  useEffect(() => {
    if (!open) return
    if (!cast) return
    if (!selectedAccountId) return
    if (isLoading) return
    if (suggestions.length > 0) return
    if (lastGeneratedAccountIdRef.current === selectedAccountId) return

    lastGeneratedAccountIdRef.current = selectedAccountId
    setError(null)
    generateSuggestions()
  }, [open, cast, selectedAccountId, isLoading, suggestions.length])

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
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && cast) {
      if (selectedAccountId) {
        generateSuggestions()
      } else {
        setSuggestions([])
        setError('Selecciona una cuenta para usar IA')
      }
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
          {!selectedAccountId && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
              <p className="text-sm text-muted-foreground">
                Para usar IA necesitas seleccionar una cuenta.
              </p>
              {accountsError ? (
                <p className="text-sm text-destructive">{accountsError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {isLoadingAccounts ? (
                  <div className="text-sm text-muted-foreground">Cargando cuentas...</div>
                ) : accounts.length > 0 ? (
                  accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/50 transition-colors"
                      aria-label={`Seleccionar cuenta @${account.username}`}
                    >
                      {account.pfpUrl ? (
                        <img
                          src={account.pfpUrl}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted" />
                      )}
                      <span className="text-sm font-medium">@{account.username}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No hay cuentas disponibles</div>
                )}
              </div>
            </div>
          )}

          {selectedAccountId && isBrandModeOn === false && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Activa AI Brand Mode completando tu Brand Voice.
              </p>
              <Link
                href={`/accounts/${selectedAccountId}/ai`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Completar contexto
              </Link>
            </div>
          )}

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
                  onClick={() => handleLanguageChange(l.value)}
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

          {/* Reply Strategy Selector - con Brand Mode */}
          {isBrandModeOn && (
            <ReplyStrategySelector selected={strategy} onChange={setStrategy} />
          )}

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

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                  ))}
                </>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive">
                  {error}
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    text={suggestion.text}
                    length={suggestion.length}
                    brandValidation={suggestion.brandValidation}
                    isSelected={selectedSuggestionId === suggestion.id}
                    onSelect={() => {
                      handleUseSuggestion(suggestion)
                      setSelectedSuggestionId(suggestion.id)
                    }}
                  />
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
                  {isTranslatingReply ? 'Traduciendo...' : `→ ${language.toUpperCase()}`}
                </button>
              )}
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escribe o selecciona una sugerencia..."
              maxLength={maxChars}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:ring-1 focus:ring-primary focus:border-primary"
              rows={3}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{replyText.length}/{maxChars}</span>
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
