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
import { NAV } from '@/lib/spacing-system'
import { buildAssistantRequest, getAssistantErrorMessage } from '@/lib/ai/assistant-client'

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

    if (activeTab === 'translate' && !enabledLanguages.includes(targetLanguage)) {
      setError('Selected language is not available')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAssistantRequest({
          mode: activeTab,
          draft: currentDraft,
          replyingTo,
          quotingCast,
          targetTone: selectedTone,
          targetLanguage,
          isPro,
          accountId,
        })),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('AI API error:', data)
        throw new Error(getAssistantErrorMessage(data, 'Error generating suggestions'))
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
      <div className={cn(NAV.PILL_TABS.containerPadding)}>
        <div
          role="tablist"
          className={cn(
            'flex w-full items-center',
            NAV.PILL_TABS.containerBg,
            NAV.PILL_TABS.containerPadding,
            NAV.PILL_TABS.gap
          )}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'translate'}
            onClick={() => handleTabClick('translate')}
            className={cn(
              'flex-1',
              NAV.PILL_TABS.pill.base,
              NAV.PILL_TABS.iconText,
              activeTab === 'translate'
                ? NAV.PILL_TABS.pill.active
                : NAV.PILL_TABS.pill.inactive
            )}
          >
            <Languages className={NAV.PILL_TABS.iconSize} />
            <span className="hidden sm:inline">Translate</span>
            <span className="sm:hidden">Trans</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'propose'}
            onClick={() => handleTabClick('propose')}
            className={cn(
              'flex-1',
              NAV.PILL_TABS.pill.base,
              NAV.PILL_TABS.iconText,
              activeTab === 'propose'
                ? NAV.PILL_TABS.pill.active
                : NAV.PILL_TABS.pill.inactive
            )}
          >
            <FileEdit className={NAV.PILL_TABS.iconSize} />
            <span className="hidden sm:inline">Propose</span>
            <span className="sm:hidden">Prop</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'improve'}
            onClick={() => handleTabClick('improve')}
            className={cn(
              'flex-1',
              NAV.PILL_TABS.pill.base,
              NAV.PILL_TABS.iconText,
              activeTab === 'improve'
                ? NAV.PILL_TABS.pill.active
                : NAV.PILL_TABS.pill.inactive
            )}
          >
            <Wand2 className={NAV.PILL_TABS.iconSize} />
            <span className="hidden sm:inline">Improve</span>
            <span className="sm:hidden">Impr</span>
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
