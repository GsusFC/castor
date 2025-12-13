'use client'

import { useState, useCallback } from 'react'
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
  const [mode, setMode] = useState<AIMode>('write')
  const [draft, setDraft] = useState(initialDraft)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTone, setSelectedTone] = useState('casual')
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [error, setError] = useState<string | null>(null)

  const generateSuggestions = useCallback(async () => {
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
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
      setError(err instanceof Error ? err.message : 'Error al generar sugerencias. Inténtalo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [mode, draft, replyingTo, quotingCast, selectedTone, targetLanguage, isPro])

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
            Asistente IA
          </DialogTitle>
        </DialogHeader>

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
            Escribir
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
            Mejorar
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
            Traducir
          </button>
        </div>

        {/* Context Display */}
        {(replyingTo || quotingCast) && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="text-muted-foreground text-xs mb-1">
              {replyingTo ? 'Respondiendo a' : 'Citando a'} @{replyingTo?.author || quotingCast?.author}
            </p>
            <p className="line-clamp-2">{replyingTo?.text || quotingCast?.text}</p>
          </div>
        )}

        {/* Draft Input (for improve/translate modes) */}
        {mode !== 'write' && (
          <div className="space-y-2">
            <Textarea
              placeholder={mode === 'improve' ? 'Escribe tu borrador...' : 'Texto a traducir...'}
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
                  Tono: {TONES.find(t => t.value === selectedTone)?.label}
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
                  Traducir a: {LANGUAGES.find(l => l.value === targetLanguage)?.label}
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
            disabled={isLoading || (mode !== 'write' && !draft.trim())}
            className="ml-auto gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar
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
              Reintentar
            </Button>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Sugerencias</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateSuggestions}
                disabled={isLoading}
                className="gap-1"
              >
                <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
                Regenerar
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
