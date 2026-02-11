'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Brain, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AppHeader } from '@/components/v2/AppHeader'
import { PageHeader } from '@/components/v2/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  styleProfile: {
    tone: string
    avgLength: number
    languagePreference: string
    topics: string | null
    sampleCasts: string | null
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

const DEFAULT_TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'witty', label: 'Witty' },
  { value: 'controversial', label: 'Controversial' },
]

const DEFAULT_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
]

export function VoiceSettingsV2Client({
  user,
  account,
  knowledgeBase,
  styleProfile,
  canEdit,
}: VoiceSettingsV2ClientProps) {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(account.voiceMode || 'auto')
  const [brandVoice, setBrandVoice] = useState(knowledgeBase?.brandVoice || '')
  const [alwaysDoText, setAlwaysDoText] = useState(toLines(parseJsonArray(knowledgeBase?.alwaysDo || null)))
  const [neverDoText, setNeverDoText] = useState(toLines(parseJsonArray(knowledgeBase?.neverDo || null)))
  const [bio, setBio] = useState(knowledgeBase?.bio || '')
  const [expertiseText, setExpertiseText] = useState(toLines(parseJsonArray(knowledgeBase?.expertise || null)))
  const [hashtagsText, setHashtagsText] = useState(toLines(parseJsonArray(knowledgeBase?.hashtags || null)))
  const [defaultTone, setDefaultTone] = useState(knowledgeBase?.defaultTone || 'casual')
  const [defaultLanguage, setDefaultLanguage] = useState(knowledgeBase?.defaultLanguage || 'en')
  const [isSaving, setIsSaving] = useState(false)

  const topics = useMemo(() => parseJsonArray(styleProfile?.topics || null), [styleProfile?.topics])
  const sampleCasts = useMemo(() => parseJsonArray(styleProfile?.sampleCasts || null), [styleProfile?.sampleCasts])

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
          bio,
          expertise: fromLines(expertiseText),
          hashtags: fromLines(hashtagsText),
          defaultTone,
          defaultLanguage,
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

        {styleProfile && (
          <section className="mt-6 p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium">Detected Personal Style</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Tone</p>
                <p className="text-sm">{styleProfile.tone}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Language</p>
                <p className="text-sm">{styleProfile.languagePreference}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Avg length</p>
                <p className="text-sm">{styleProfile.avgLength}</p>
              </div>
              <div className="rounded-lg border border-border/50 p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Topics</p>
                <p className="text-sm">{topics.length}</p>
              </div>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topics.slice(0, 6).map((topic, i) => (
                  <span key={`${topic}-${i}`} className="text-xs rounded-full bg-primary/10 text-primary px-2 py-1">
                    {topic}
                  </span>
                ))}
              </div>
            )}
            {sampleCasts.length > 0 && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 line-clamp-2">
                "{sampleCasts[0]}"
              </p>
            )}
          </section>
        )}

        <section className="mt-6 p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
          <h2 className="text-sm font-medium">Default generation settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Default tone</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" disabled={!canEdit}>
                    {DEFAULT_TONES.find((t) => t.value === defaultTone)?.label || defaultTone}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {DEFAULT_TONES.map((tone) => (
                    <DropdownMenuItem key={tone.value} onClick={() => setDefaultTone(tone.value)}>
                      {tone.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Default language</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start" disabled={!canEdit}>
                    {DEFAULT_LANGUAGES.find((l) => l.value === defaultLanguage)?.label || defaultLanguage}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {DEFAULT_LANGUAGES.map((language) => (
                    <DropdownMenuItem key={language.value} onClick={() => setDefaultLanguage(language.value)}>
                      {language.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </section>

        <section className="mt-6 p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
          <h2 className="text-sm font-medium">Account context</h2>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Bio</p>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={!canEdit}
              className="min-h-[90px] resize-y"
              placeholder="Short account bio/context..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Expertise (one per line)</p>
              <Textarea
                value={expertiseText}
                onChange={(e) => setExpertiseText(e.target.value)}
                disabled={!canEdit}
                className="min-h-[110px] resize-y"
                placeholder="Farcaster growth"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hashtags (one per line)</p>
              <Textarea
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                disabled={!canEdit}
                className="min-h-[110px] resize-y"
                placeholder="#farcaster"
              />
            </div>
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
