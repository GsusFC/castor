'use client'

import { useState, useCallback } from 'react'
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

type AIMode = 'translate' | 'propose' | 'improve' | null

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

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
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
  const [activeTab, setActiveTab] = useState<AIMode>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState('casual')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [error, setError] = useState<string | null>(null)

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
        throw new Error(data.error || 'Error al generar sugerencias')
      }

      setSuggestions(data.suggestions || [])
    } catch (err) {
      console.error('AI error:', err)
      setError(err instanceof Error ? err.message : 'Error al generar. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, currentDraft, replyingTo, quotingCast, selectedTone, targetLanguage, isPro, accountId])

  const handleSelectSuggestion = (text: string) => {
    onSelectText(text)
    setActiveTab(null)
    setSuggestions([])
  }

  const showContent = activeTab !== null

  return (
    <div className="border-b border-border">
      {/* Tabs */}
      <div className="flex items-center gap-4 px-3">
        <button
          onClick={() => handleTabClick('translate')}
          className={cn(
            'flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'translate'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Languages className="w-4 h-4" />
          Traducir
        </button>
        <button
          onClick={() => handleTabClick('propose')}
          className={cn(
            'flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'propose'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileEdit className="w-4 h-4" />
          Proponer
        </button>
        <button
          onClick={() => handleTabClick('improve')}
          className={cn(
            'flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'improve'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Wand2 className="w-4 h-4" />
          Mejorar
        </button>
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
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {(activeTab === 'propose' || activeTab === 'improve') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
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
                <Button variant="outline" size="sm" className="gap-1.5">
                  {LANGUAGES.find(l => l.value === targetLanguage)?.label}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem key={lang.value} onClick={() => setTargetLanguage(lang.value)}>
                    {targetLanguage === lang.value && <Check className="w-4 h-4 mr-2" />}
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            <Button onClick={generateSuggestions} disabled={isLoading} variant="outline" size="sm" className="gap-1.5">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors bg-background"
                >
                  <p className="text-sm">{suggestion}</p>
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
