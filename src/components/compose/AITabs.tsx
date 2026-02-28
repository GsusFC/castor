'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Languages,
  FileEdit,
  Wand2,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  X,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AI_LANGUAGE_OPTIONS, type SupportedTargetLanguage } from '@/lib/ai/languages'

const BeaverIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.39.5.09.68-.22.68-.48 0-.24-.01-.86-.01-1.69-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.54 9.54 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    <circle cx="9" cy="11" r="0.5" fill="currentColor" />
    <circle cx="15" cy="11" r="0.5" fill="currentColor" />
    <path d="M10 14h4l-1 1-1-1h-2" fill="currentColor" />
  </svg>
)
import { useAiLanguagePreferences } from '@/context/AiLanguagePreferencesContext'
import { NAV } from '@/lib/spacing-system'
import { buildAssistantRequest, getAssistantErrorMessage } from '@/lib/ai/assistant-client'
import type { PublishNetwork } from './types'

type AIMode = 'translate' | 'propose' | 'improve' | 'humanize' | null

type AISuggestion = {
  id: string
  text: string
  length: number
}

const AI_MODE_UI: Record<Exclude<AIMode, null>, {
  tabLabel: string
  tabShortLabel: string
  actionLabel: string
  title: string
  description: string
}> = {
  propose: {
    tabLabel: 'Draft',
    tabShortLabel: 'Draft',
    actionLabel: 'Generate drafts',
    title: 'Draft new options',
    description: 'Use this when you have a topic and want 3 ready-to-post starting points.',
  },
  translate: {
    tabLabel: 'Translate',
    tabShortLabel: 'Trans',
    actionLabel: 'Translate draft',
    title: 'Translate your draft',
    description: 'Keeps the same meaning in another language without changing intent.',
  },
  improve: {
    tabLabel: 'Polish',
    tabShortLabel: 'Polish',
    actionLabel: 'Polish draft',
    title: 'Polish for publishing',
    description: 'Makes your draft tighter, clearer, and adapted to the selected network limit.',
  },
  humanize: {
    tabLabel: 'Natural',
    tabShortLabel: 'Natural',
    actionLabel: 'Make natural',
    title: 'Make it sound natural',
    description: 'Softens robotic phrasing and improves flow while preserving your message.',
  },
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
  selectedNetworks?: PublishNetwork[]
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
  maxChars = 1024,
  accountId,
  selectedNetworks = ['farcaster'],
}: AITabsProps) {
  const { defaultLanguage, enabledLanguages } = useAiLanguagePreferences()
  const [activeTab, setActiveTab] = useState<AIMode>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState('casual')
  const [improveTargetNetwork, setImproveTargetNetwork] = useState<'farcaster' | 'x' | 'linkedin'>('farcaster')
  const [targetLanguage, setTargetLanguage] = useState<SupportedTargetLanguage>('en')
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
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

  useEffect(() => {
    const improveNetworks = selectedNetworks.filter(
      (network): network is 'farcaster' | 'x' | 'linkedin' =>
        network === 'farcaster' || network === 'x' || network === 'linkedin'
    )
    if (improveNetworks.length === 0) return
    if (!improveNetworks.includes(improveTargetNetwork)) {
      setImproveTargetNetwork(improveNetworks[0])
    }
  }, [selectedNetworks, improveTargetNetwork])

  const improveNetworkOptions = (
    selectedNetworks.filter(
      (network): network is 'farcaster' | 'x' | 'linkedin' =>
        network === 'farcaster' || network === 'x' || network === 'linkedin'
    ).length > 0
      ? selectedNetworks.filter(
          (network): network is 'farcaster' | 'x' | 'linkedin' =>
            network === 'farcaster' || network === 'x' || network === 'linkedin'
        )
      : (['farcaster', 'x', 'linkedin'] as const)
  )

  const getNetworkLabel = (network: 'farcaster' | 'x' | 'linkedin') =>
    network === 'farcaster' ? 'Farcaster' : network === 'x' ? 'X' : 'LinkedIn'

  const getNetworkLimit = (network: 'farcaster' | 'x' | 'linkedin') => {
    if (network === 'x') return 280
    if (network === 'linkedin') return 3000
    return maxChars
  }

  const activeMaxChars = (activeTab === 'improve' || activeTab === 'humanize') ? getNetworkLimit(improveTargetNetwork) : maxChars

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
    if ((activeTab === 'improve' || activeTab === 'humanize') && !currentDraft.trim()) {
      setError(activeTab === 'humanize' ? 'Write a draft first to humanize' : 'Write a draft first to improve')
      return
    }

    if (activeTab === 'translate' && !enabledLanguages.includes(targetLanguage)) {
      setError('Selected language is not available')
      return
    }

    setIsLoading(true)
    setError(null)
    setStreamStatus('Generando sugerencias con IA...')
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
          targetPlatform: activeTab === 'improve' || activeTab === 'humanize' ? improveTargetNetwork : undefined,
          maxCharsOverride: activeTab === 'improve' || activeTab === 'humanize' ? getNetworkLimit(improveTargetNetwork) : undefined,
          isPro,
          accountId,
          includeBrandValidation: false,
          stream: false,
        })),
      })
      
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        console.error('AI API error:', data)
        throw new Error(getAssistantErrorMessage(data, 'Hubo un problema de conexión al generar sugerencias. Por favor, reintenta.'))
      }

      if (!data || !Array.isArray(data.suggestions)) {
        throw new Error('El servidor devolvió datos inválidos. Por favor, reintenta.')
      }
      
      const nextSuggestions = data.suggestions as AISuggestion[]
      setSuggestions(nextSuggestions)
      setStreamStatus(null)
      
      if (nextSuggestions.length === 0) {
        setError('No se pudieron generar sugerencias. Intenta cambiar el texto o regenerar.')
      }

    } catch (err) {
      console.error('AI error:', err)
      setError(err instanceof Error ? err.message : 'Hubo un error inesperado. Por favor, reintenta.')
      setStreamStatus(null)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, currentDraft, replyingTo, quotingCast, selectedTone, targetLanguage, improveTargetNetwork, isPro, accountId, maxChars])

  const handleSelectSuggestion = (suggestion: AISuggestion) => {
    onSelectText(suggestion.text)
    setActiveTab(null)
    setSuggestions([])
  }

  const showContent = activeTab !== null
  const activeModeMeta = activeTab ? AI_MODE_UI[activeTab] : null

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
          aria-label="AI actions"
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
            aria-selected={activeTab === 'propose'}
            onClick={() => handleTabClick('propose')}
            aria-label="Draft new suggestions"
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
            <span className="hidden sm:inline">{AI_MODE_UI.propose.tabLabel}</span>
            <span className="sm:hidden">{AI_MODE_UI.propose.tabShortLabel}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'translate'}
            onClick={() => handleTabClick('translate')}
            aria-label="Translate current draft"
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
            <span className="hidden sm:inline">{AI_MODE_UI.translate.tabLabel}</span>
            <span className="sm:hidden">{AI_MODE_UI.translate.tabShortLabel}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'improve'}
            onClick={() => handleTabClick('improve')}
            aria-label="Polish current draft"
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
            <span className="hidden sm:inline">{AI_MODE_UI.improve.tabLabel}</span>
            <span className="sm:hidden">{AI_MODE_UI.improve.tabShortLabel}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'humanize'}
            onClick={() => handleTabClick('humanize')}
            aria-label="Make draft sound natural"
            className={cn(
              'flex-1',
              NAV.PILL_TABS.pill.base,
              NAV.PILL_TABS.iconText,
              activeTab === 'humanize'
                ? NAV.PILL_TABS.pill.active
                : NAV.PILL_TABS.pill.inactive
            )}
          >
            <Sparkles className={NAV.PILL_TABS.iconSize} />
            <span className="hidden sm:inline">{AI_MODE_UI.humanize.tabLabel}</span>
            <span className="sm:hidden">{AI_MODE_UI.humanize.tabShortLabel}</span>
          </button>
        </div>
      </div>

      {/* Content panel */}
      {showContent && (
        <div className="p-3 bg-muted/20 space-y-3">
          {activeModeMeta && (
            <div className="rounded-lg border border-border/60 bg-background/80 p-2.5">
              <p className="text-sm font-medium text-foreground">{activeModeMeta.title}</p>
              <p className="text-xs text-muted-foreground">{activeModeMeta.description}</p>
            </div>
          )}

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
          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'propose' || activeTab === 'improve' || activeTab === 'humanize') && (
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

            {(activeTab === 'improve' || activeTab === 'humanize') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    {getNetworkLabel(improveTargetNetwork)} ({getNetworkLimit(improveTargetNetwork)})
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {improveNetworkOptions.map((network) => (
                    <DropdownMenuItem
                      key={network}
                      onClick={() => setImproveTargetNetwork(network)}
                    >
                      {improveTargetNetwork === network && <Check className="w-4 h-4 mr-2" />}
                      {getNetworkLabel(network)} ({getNetworkLimit(network)})
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

            <div className="flex-1 min-w-2" />

            <Button
              onClick={generateSuggestions}
              disabled={isLoading}
              variant={isPro || activeTab === 'improve' || activeTab === 'humanize' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                (isPro || activeTab === 'improve' || activeTab === 'humanize') && "border-none shadow-sm"
              )}
            >
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
                  {(isPro || activeTab === 'improve' || activeTab === 'humanize') ? (
                    <BeaverIcon className="w-4 h-4" />
                  ) : (
                    <>
                      {activeTab === 'translate' && <Languages className="w-4 h-4" />}
                      {activeTab === 'propose' && <FileEdit className="w-4 h-4" />}
                    </>
                  )}
                  <span className="flex items-center gap-1.5">
                    {activeModeMeta?.actionLabel ?? 'Generate'}
                    {(isPro || activeTab === 'improve' || activeTab === 'humanize') && (
                      <span className="text-[10px] font-bold px-1 bg-white/20 rounded uppercase tracking-tighter">Pro</span>
                    )}
                  </span>
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

          {isLoading && streamStatus && !error && (
            <p className="text-xs text-muted-foreground">{streamStatus}</p>
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
                  <span className="text-xs text-muted-foreground mt-1">{suggestion.length}/{activeMaxChars}</span>
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
