'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Languages, 
  FileEdit, 
  Wand2, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  Check,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AI_LANGUAGE_OPTIONS, type SupportedTargetLanguage } from '@/lib/ai/languages'
import { useAiLanguagePreferences } from '@/context/AiLanguagePreferencesContext'

type AIMode = 'translate' | 'propose' | 'improve' | null

type AISuggestion = {
  id: string
  text: string
  length: number
}

interface AITabsProps {
  onSelectText: (text: string) => void
  currentDraft: string
  replyingTo?: {
    text: string
    author: string
    pfpUrl?: string
  }
  quotingCast?: {
    text: string
    author: string
  }
  onClearReply?: () => void
  isPro?: boolean
  maxChars?: number
  accountId?: string
}

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Profesional' },
  { value: 'friendly', label: 'Amigable' },
  { value: 'witty', label: 'Ingenioso' },
  { value: 'controversial', label: 'Polémico' },
]

export function AITabs({
  onSelectText,
  currentDraft,
  replyingTo,
  quotingCast,
  onClearReply,
  isPro = false,
  maxChars = 320,
  accountId,
}: AITabsProps) {
  const { defaultLanguage, enabledLanguages } = useAiLanguagePreferences()
  const [activeTab, setActiveTab] = useState<AIMode>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState('casual')
  const [targetLanguage, setTargetLanguage] = useState<SupportedTargetLanguage>('en')
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (hasSelectedLanguage) return
    setTargetLanguage(defaultLanguage)
  }, [defaultLanguage, hasSelectedLanguage])

  useEffect(() => {
    if (enabledLanguages.includes(targetLanguage)) return
    setHasSelectedLanguage(false)
    setTargetLanguage(defaultLanguage)
  }, [defaultLanguage, enabledLanguages, targetLanguage])

  const languageOptions = AI_LANGUAGE_OPTIONS.filter((lang) => enabledLanguages.includes(lang.value))

  const handleTabClick = (tab: AIMode) => {
    if (activeTab === tab) {
      setActiveTab(null)
      setSuggestions([])
      setError(null)
    } else {
      setActiveTab(tab)
      setSuggestions([])
      setError(null)
    }
  }

  const generateSuggestions = useCallback(async () => {
    if (!activeTab) return

    if (activeTab === 'translate' && !currentDraft.trim()) {
      setError('Escribe algo primero para traducir')
      return
    }
    if (activeTab === 'improve' && !currentDraft.trim()) {
      setError('Escribe un borrador primero para mejorar')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const modeMap = { translate: 'translate', propose: 'write', improve: 'improve' }

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: modeMap[activeTab],
          draft: activeTab !== 'propose' ? currentDraft : undefined,
          replyingTo,
          quotingCast,
          targetTone: selectedTone,
          targetLanguage,
          isPro,
          accountId,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('AI API error:', data)
        const message = (data?.message as string | undefined) ?? (data?.error as string | undefined)
        throw new Error(message || 'Error al generar sugerencias')
      }

      const nextSuggestions = (data?.suggestions as AISuggestion[] | undefined) ?? []
      setSuggestions(nextSuggestions)
      if (nextSuggestions.length === 0) {
        setError('No se pudieron generar sugerencias. Prueba a regenerar.')
      }
    } catch (err) {
      console.error('AI error:', err)
      setError(err instanceof Error ? err.message : 'Error al generar. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, currentDraft, replyingTo, quotingCast, selectedTone, targetLanguage, isPro, accountId])

  const handleSelectSuggestion = (suggestion: AISuggestion) => {
    onSelectText(suggestion.text)
    setActiveTab(null)
    setSuggestions([])
  }

  const showContent = activeTab !== null

  return (
    <div className="border-b border-border">
      {/* Tabs */}
      <div className="px-3 py-2">
        <div
          role="tablist"
          className="flex w-full items-center gap-1 rounded-full bg-muted/30 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'translate'}
            onClick={() => handleTabClick('translate')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'translate'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Languages className="w-4 h-4" />
              Traducir
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'propose'}
            onClick={() => handleTabClick('propose')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'propose'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <FileEdit className="w-4 h-4" />
              Proponer
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'improve'}
            onClick={() => handleTabClick('improve')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'improve'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Wand2 className="w-4 h-4" />
              Mejorar
            </span>
          </button>
        </div>
      </div>

      {/* Content panel */}
      {showContent && (
        <div className="p-3 bg-muted/20 space-y-3">
          {/* Reply/Quote context */}
          {(replyingTo || quotingCast) && (
            <div className="flex items-start gap-3 p-2 bg-background rounded-lg border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {replyingTo?.pfpUrl && (
                    <img src={replyingTo.pfpUrl} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {replyingTo ? `Replying to @${replyingTo.author}` : `Quoting @${quotingCast?.author}`}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground/80 line-clamp-3">
                  {replyingTo?.text || quotingCast?.text}
                </p>
              </div>
              {onClearReply && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClearReply}
                  className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                  aria-label="Quitar respuesta"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-destructive/10">
                    <X className="w-4 h-4" />
                  </span>
                </Button>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {(activeTab === 'propose' || activeTab === 'improve') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    Tono: {TONES.find(t => t.value === selectedTone)?.label}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {TONES.map((tone) => (
                    <DropdownMenuItem key={tone.value} onClick={() => setSelectedTone(tone.value)}>
                      {selectedTone === tone.value && <Check className="w-4 h-4 mr-2" />}
                      {tone.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  {languageOptions.find((l) => l.value === targetLanguage)?.label}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {languageOptions.map((lang) => (
                  <DropdownMenuItem
                    key={lang.value}
                    onClick={() => {
                      setTargetLanguage(lang.value)
                      setHasSelectedLanguage(true)
                    }}
                  >
                    {targetLanguage === lang.value && <Check className="w-4 h-4 mr-2" />}
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            <Button onClick={generateSuggestions} disabled={isLoading} variant="outline" size="sm" className="h-8 gap-1.5">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : suggestions.length > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerar
                </>
              ) : (
                <>
                  {activeTab === 'translate' && <Languages className="w-4 h-4" />}
                  {activeTab === 'propose' && <FileEdit className="w-4 h-4" />}
                  {activeTab === 'improve' && <Wand2 className="w-4 h-4" />}
                  {activeTab === 'translate' ? 'Traducir' : activeTab === 'propose' ? 'Proponer' : 'Mejorar'}
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSuggestions}
                disabled={isLoading}
              >
                Reintentar
              </Button>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors bg-background"
                >
                  <p className="text-sm">{suggestion.text}</p>
                  <span className="text-xs text-muted-foreground mt-1">{suggestion.length}/{maxChars}</span>
                </button>
              ))}
            </div>
          )}

          {isLoading && suggestions.length === 0 && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
