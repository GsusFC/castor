'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Wand2,
  Languages,
  Loader2,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useSelectedAccount } from '@/context/SelectedAccountContext'

type AIMode = 'write' | 'improve' | 'translate'

type AISuggestion = {
  id: string
  text: string
  length: number
}

interface AIAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectText: (text: string) => void
  // Contexto opcional
  replyingTo?: {
    text: string
    author: string
  }
  quotingCast?: {
    text: string
    author: string
  }
  initialDraft?: string
  isPro?: boolean
  maxChars?: number
}

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'witty', label: 'Witty' },
  { value: 'controversial', label: 'Controversial' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
]

export function AIAssistant({
  open,
  onOpenChange,
  onSelectText,
  replyingTo,
  quotingCast,
  initialDraft = '',
  isPro = false,
  maxChars = 320,
}: AIAssistantProps) {
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount()
  const [mode, setMode] = useState<AIMode>('write')
  const [draft, setDraft] = useState(initialDraft)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState('casual')
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Array<{ id: string; username: string; pfpUrl?: string | null }>>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [isBrandModeOn, setIsBrandModeOn] = useState<boolean | null>(null)

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
        setAccountsError(err instanceof Error ? err.message : 'Could not load accounts')
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

  const generateSuggestions = useCallback(async () => {
    if (!selectedAccountId) {
      setError('Select an account to use AI')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuggestions([])

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          draft: mode !== 'write' ? draft : undefined,
          replyingTo,
          quotingCast,
          targetTone: selectedTone,
          targetLanguage: mode === 'translate' ? targetLanguage : undefined,
          isPro,
          accountId: selectedAccountId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
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
      setError(err instanceof Error ? err.message : 'Error generating suggestions. Try again.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedAccountId, mode, draft, replyingTo, quotingCast, selectedTone, targetLanguage, isPro])

  const handleSelectSuggestion = (suggestion: AISuggestion) => {
    onSelectText(suggestion.text)
    onOpenChange(false)
    // Reset state
    setSuggestions([])
    setDraft('')
  }

  const handleModeChange = (newMode: AIMode) => {
    setMode(newMode)
    setSuggestions([])
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>

        {!selectedAccountId && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              To use the AI assistant you need to select an account.
            </p>
            {accountsError ? (
              <p className="text-sm text-destructive">{accountsError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {isLoadingAccounts ? (
                <div className="text-sm text-muted-foreground">Loading accounts...</div>
              ) : accounts.length > 0 ? (
                accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-background hover:bg-muted/50 transition-colors"
                    aria-label={`Select account @${account.username}`}
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
                <div className="text-sm text-muted-foreground">No accounts available</div>
              )}
            </div>
          </div>
        )}

        {selectedAccountId && isBrandModeOn === false && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Enable AI Brand Mode by completing your Brand Voice.
            </p>
            <Link
              href={`/accounts/${selectedAccountId}/ai`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Complete context
            </Link>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => handleModeChange('write')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              mode === 'write'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="w-4 h-4" />
            Write
          </button>
          <button
            onClick={() => handleModeChange('improve')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              mode === 'improve'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Wand2 className="w-4 h-4" />
            Improve
          </button>
          <button
            onClick={() => handleModeChange('translate')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              mode === 'translate'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Languages className="w-4 h-4" />
            Translate
          </button>
        </div>

        {/* Context Display */}
        {(replyingTo || quotingCast) && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="text-muted-foreground text-xs mb-1">
              {replyingTo ? 'Replying to' : 'Quoting'} @{replyingTo?.author || quotingCast?.author}
            </p>
            <p className="line-clamp-2">{replyingTo?.text || quotingCast?.text}</p>
          </div>
        )}

        {/* Draft Input (for improve/translate modes) */}
        {mode !== 'write' && (
          <div className="space-y-2">
            <Textarea
              placeholder={mode === 'improve' ? 'Write your draft...' : 'Text to translate...'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{draft.length} / {maxChars}</span>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="flex gap-2">
          {/* Tone selector (for write/improve) */}
          {mode !== 'translate' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Tone: {TONES.find(t => t.value === selectedTone)?.label}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {TONES.map((tone) => (
                  <DropdownMenuItem
                    key={tone.value}
                    onClick={() => setSelectedTone(tone.value)}
                  >
                    {selectedTone === tone.value && <Check className="w-4 h-4 mr-2" />}
                    {tone.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Language selector (for translate) */}
          {mode === 'translate' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Translate to: {LANGUAGES.find(l => l.value === targetLanguage)?.label}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.value}
                    onClick={() => setTargetLanguage(lang.value)}
                  >
                    {targetLanguage === lang.value && <Check className="w-4 h-4 mr-2" />}
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Generate button */}
          <Button
            onClick={generateSuggestions}
            disabled={isLoading || !selectedAccountId || (mode !== 'write' && !draft.trim())}
            className="ml-auto gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Error */}
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

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Suggestions</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateSuggestions}
                disabled={isLoading}
                className="gap-1"
              >
                <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
                Regenerate
              </Button>
            </div>

            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <p className="text-sm">{suggestion.text}</p>
                  <span className="text-xs text-muted-foreground mt-1">
                    {suggestion.length}/{maxChars}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && suggestions.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-muted animate-pulse rounded-lg"
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
