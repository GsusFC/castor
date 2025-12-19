'use client'

import Link from 'next/link'
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
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'witty', label: 'Witty' },
  { value: 'controversial', label: 'Controversial' },
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
  const [isBrandModeOn, setIsBrandModeOn] = useState<boolean | null>(null)

  useEffect(() => {
    if (hasSelectedLanguage) return
    setTargetLanguage(defaultLanguage)
  }, [defaultLanguage, hasSelectedLanguage])

  useEffect(() => {
    if (enabledLanguages.includes(targetLanguage)) return
    setHasSelectedLanguage(false)
    setTargetLanguage(defaultLanguage)
  }, [defaultLanguage, enabledLanguages, targetLanguage])

  useEffect(() => {
    if (!accountId) {
      setIsBrandModeOn(null)
      return
    }

    let isActive = true
    const loadBrandMode = async () => {
      try {
        const res = await fetch(`/api/accounts/${accountId}/context`)
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
  }, [accountId])

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

    if (!accountId) {
      setError('Select an account to use AI')
      return
    }

    if (activeTab === 'translate' && !currentDraft.trim()) {
      setError('Write something first to translate')
      return
    }
    if (activeTab === 'improve' && !currentDraft.trim()) {
      setError('Write a draft first to improve')
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
        throw new Error(message || 'Error generating suggestions')
      }

      const nextSuggestions = (data?.suggestions as AISuggestion[] | undefined) ?? []
      setSuggestions(nextSuggestions)
      if (nextSuggestions.length === 0) {
        setError('Could not generate suggestions. Try regenerating.')
      }
    } catch (err) {
      console.error('AI error:', err)
      setError(err instanceof Error ? err.message : 'Generation error. Try again.')
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
      {!accountId && (
        <div className="px-3 pt-3">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-2 text-sm text-muted-foreground">
            Select an account to use AI.
          </div>
        </div>
      )}

      {accountId && isBrandModeOn === false && (
        <div className="px-3 pt-3">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-2 text-sm">
            <p className="text-muted-foreground">Enable AI Brand Mode by completing your Brand Voice.</p>
            <Link
              href={`/accounts/${accountId}/ai`}
              className="font-medium text-primary hover:underline"
            >
              Complete context
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-3 py-2">
        <div
          role="tablist"
          className="flex w-full items-center gap-1 rounded-full bg-muted/50 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'translate'}
            onClick={() => handleTabClick('translate')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm transition-all',
              activeTab === 'translate'
                ? 'bg-background text-foreground shadow-md border border-border/10 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Languages className="w-4 h-4" />
              Translate
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'propose'}
            onClick={() => handleTabClick('propose')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm transition-all',
              activeTab === 'propose'
                ? 'bg-background text-foreground shadow-md border border-border/10 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <FileEdit className="w-4 h-4" />
              Propose
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'improve'}
            onClick={() => handleTabClick('improve')}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm transition-all',
              activeTab === 'improve'
                ? 'bg-background text-foreground shadow-md border border-border/10 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Wand2 className="w-4 h-4" />
              Improve
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
                  aria-label="Remove reply"
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
                    Tone: {TONES.find(t => t.value === selectedTone)?.label}
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
                  Generating...
                </>
              ) : suggestions.length > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  {activeTab === 'translate' && <Languages className="w-4 h-4" />}
                  {activeTab === 'propose' && <FileEdit className="w-4 h-4" />}
                  {activeTab === 'improve' && <Wand2 className="w-4 h-4" />}
                  {activeTab === 'translate' ? 'Translate' : activeTab === 'propose' ? 'Propose' : 'Improve'}
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
                Retry
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
