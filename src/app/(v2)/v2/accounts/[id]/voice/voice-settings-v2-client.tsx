'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Brain, Save } from 'lucide-react'
import { toast } from 'sonner'
import { AppHeader } from '@/components/v2/AppHeader'
import { PageHeader } from '@/components/v2/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type VoiceMode = 'auto' | 'brand' | 'personal'

interface VoiceSettingsV2ClientProps {
  user: {
    username: string
    displayName: string | null
    pfpUrl: string | null
  }
  account: {
    id: string
    username: string
    displayName: string | null
    pfpUrl: string | null
    type: 'personal' | 'business'
    voiceMode: VoiceMode
  }
  knowledgeBase: {
    brandVoice: string | null
    bio: string | null
    expertise: string | null
    alwaysDo: string | null
    neverDo: string | null
    hashtags: string | null
    defaultTone: string | null
    defaultLanguage: string | null
  } | null
  canEdit: boolean
}

const parseJsonArray = (value: string | null): string[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const toLines = (items: string[]): string => items.join('\n')
const fromLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const VOICE_MODE_OPTIONS: Array<{ value: VoiceMode; label: string; help: string }> = [
  { value: 'auto', label: 'Automático', help: 'Business => Brand Voice, Personal => Personal Voice.' },
  { value: 'brand', label: 'Forzar Brand Voice', help: 'Siempre aplica voz de marca.' },
  { value: 'personal', label: 'Forzar Personal Voice', help: 'No aplica reglas de marca en IA.' },
]

export function VoiceSettingsV2Client({
  user,
  account,
  knowledgeBase,
  canEdit,
}: VoiceSettingsV2ClientProps) {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(account.voiceMode || 'auto')
  const [brandVoice, setBrandVoice] = useState(knowledgeBase?.brandVoice || '')
  const [alwaysDoText, setAlwaysDoText] = useState(toLines(parseJsonArray(knowledgeBase?.alwaysDo || null)))
  const [neverDoText, setNeverDoText] = useState(toLines(parseJsonArray(knowledgeBase?.neverDo || null)))
  const [isSaving, setIsSaving] = useState(false)

  const modePreview = useMemo(() => {
    if (voiceMode === 'auto') return account.type === 'business' ? 'brand' : 'personal'
    return voiceMode
  }, [account.type, voiceMode])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/accounts/${account.id}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceMode,
          brandVoice,
          alwaysDo: fromLines(alwaysDoText),
          neverDo: fromLines(neverDoText),
          bio: knowledgeBase?.bio || '',
          expertise: parseJsonArray(knowledgeBase?.expertise || null),
          hashtags: parseJsonArray(knowledgeBase?.hashtags || null),
          defaultTone: knowledgeBase?.defaultTone || 'casual',
          defaultLanguage: knowledgeBase?.defaultLanguage || 'en',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Error saving voice settings')
      }

      toast.success('Voice settings saved')
    } catch (error) {
      console.error('Error saving voice settings:', error)
      toast.error(error instanceof Error ? error.message : 'Could not save voice settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="hidden sm:block">
        <AppHeader user={user} />
      </div>

      <main className="max-w-3xl xl:max-w-5xl mx-auto px-4 py-8">
        <PageHeader
          icon={<Brain className="w-5 h-5 text-primary" />}
          title={`Voice Settings · @${account.username}`}
          subtitle={`Modo efectivo actual: ${modePreview === 'brand' ? 'Brand Voice' : 'Personal Voice'}`}
          action={
            <Link href="/v2/accounts">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          }
        />

        <section className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-4">
          <h2 className="text-sm font-medium">Voice mode</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {VOICE_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={!canEdit}
                onClick={() => setVoiceMode(option.value)}
                className={cn(
                  'text-left rounded-lg border p-3 transition-colors',
                  voiceMode === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-border',
                  !canEdit && 'opacity-70 cursor-not-allowed'
                )}
              >
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.help}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
          <h2 className="text-sm font-medium">Brand Voice</h2>
          <Textarea
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            disabled={!canEdit}
            className="min-h-[180px] resize-y"
            placeholder="Define cómo escribe esta cuenta cuando usa Brand Voice..."
          />
          <p className="text-xs text-muted-foreground">
            Se usa cuando el modo efectivo es Brand Voice.
          </p>
        </section>

        <section className="mt-6 p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
          <h2 className="text-sm font-medium">Always Do (una regla por línea)</h2>
          <Textarea
            value={alwaysDoText}
            onChange={(e) => setAlwaysDoText(e.target.value)}
            disabled={!canEdit}
            className="min-h-[110px] resize-y"
            placeholder="Ej: Responder con claridad"
          />

          <h2 className="text-sm font-medium">Never Do (una regla por línea)</h2>
          <Textarea
            value={neverDoText}
            onChange={(e) => setNeverDoText(e.target.value)}
            disabled={!canEdit}
            className="min-h-[110px] resize-y"
            placeholder="Ej: Usar lenguaje agresivo"
          />
        </section>

        <div className="mt-6">
          <Button onClick={handleSave} disabled={!canEdit || isSaving} className="gap-1.5">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save voice settings'}
          </Button>
        </div>
      </main>
    </>
  )
}
