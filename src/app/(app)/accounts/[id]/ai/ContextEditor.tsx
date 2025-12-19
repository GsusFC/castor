'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { 
  FileText, 
  Plus, 
  X, 
  Save, 
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  Hash,
  Brain,
  RefreshCw,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Account, AccountKnowledgeBase, AccountDocument, AccountMember, UserStyleProfile } from '@/lib/db'
import { Sparkles, MessageSquare, Globe, Smile } from 'lucide-react'

interface CastorUserSuggestion {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

export interface ContextEditorProps {
  accountId: string
  account: Account
  knowledgeBase: AccountKnowledgeBase | null | undefined
  documents: AccountDocument[]
  members: (AccountMember & { user: { id: string; username: string; displayName: string | null; pfpUrl: string | null } })[]
  canEdit: boolean
  canManageMembers: boolean
  styleProfile?: UserStyleProfile | null
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

export interface ContextEditorHandle {
  save: () => Promise<void>
  isSaving: boolean
  saveSuccess: boolean
}

export const ContextEditor = forwardRef<ContextEditorHandle, ContextEditorProps>(function ContextEditor({
  accountId,
  account,
  knowledgeBase,
  documents: initialDocuments,
  members,
  canEdit,
  canManageMembers,
  styleProfile,
}, ref) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [currentStyleProfile, setCurrentStyleProfile] = useState(styleProfile)
  
  // Form state
  const [brandVoice, setBrandVoice] = useState(knowledgeBase?.brandVoice || '')
  const [bio, setBio] = useState(knowledgeBase?.bio || '')
  const [expertise, setExpertise] = useState<string[]>(
    knowledgeBase?.expertise ? JSON.parse(knowledgeBase.expertise) : []
  )
  const [alwaysDo, setAlwaysDo] = useState<string[]>(
    knowledgeBase?.alwaysDo ? JSON.parse(knowledgeBase.alwaysDo) : []
  )
  const [neverDo, setNeverDo] = useState<string[]>(
    knowledgeBase?.neverDo ? JSON.parse(knowledgeBase.neverDo) : []
  )
  const [hashtags, setHashtags] = useState<string[]>(
    knowledgeBase?.hashtags ? JSON.parse(knowledgeBase.hashtags) : []
  )
  const [defaultTone, setDefaultTone] = useState(knowledgeBase?.defaultTone || 'casual')
  const [defaultLanguage, setDefaultLanguage] = useState(knowledgeBase?.defaultLanguage || 'en')
  
  // New item inputs
  const [newExpertise, setNewExpertise] = useState('')
  const [newAlwaysDo, setNewAlwaysDo] = useState('')
  const [newNeverDo, setNewNeverDo] = useState('')
  const [newHashtag, setNewHashtag] = useState('')

  const [documents, setDocuments] = useState(initialDocuments)

  const [membersState, setMembersState] = useState(members)
  const membersBaselineRef = useRef(new Map<string, ContextEditorProps['members'][number]>())
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteCanEditContext, setInviteCanEditContext] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)

  const [inviteSuggestions, setInviteSuggestions] = useState<CastorUserSuggestion[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false)
  const inviteSearchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMembersState(members)
    membersBaselineRef.current = new Map(members.map((m) => [m.id, m]))
  }, [members])

  useImperativeHandle(ref, () => ({
    save: handleSave,
    isSaving,
    saveSuccess,
  }), [isSaving, saveSuccess])

  useEffect(() => {
    if (!canManageMembers) return

    const q = inviteUsername.trim().replace(/^@/, '')
    if (q.length < 1) {
      setInviteSuggestions([])
      setIsSearchingUsers(false)
      return
    }
    const timeoutId = setTimeout(() => {
      inviteSearchAbortRef.current?.abort()
      const controller = new AbortController()
      inviteSearchAbortRef.current = controller
      setIsSearchingUsers(true)

      fetch(`/api/users/castor-search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then(data => {
          setInviteSuggestions((data?.users || []) as CastorUserSuggestion[])
        })
        .catch(err => {
          if (err?.name !== 'AbortError') {
            console.error('[Invite] Search users error:', err)
          }
        })
        .finally(() => {
          setIsSearchingUsers(false)
        })
    }, 200)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [inviteUsername, canManageMembers])

  const handleUpdateMemberLocal = (
    memberId: string,
    updates: Partial<{ role: 'admin' | 'member'; canEditContext: boolean }>
  ) => {
    setMembersState((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
    )
  }

  const handleSaveMember = async (memberId: string) => {
    if (!canManageMembers) return

    const member = membersState.find((m) => m.id === memberId)
    if (!member) return

    const original = membersBaselineRef.current.get(memberId)
    const roleChanged = original ? member.role !== original.role : true
    const canEditChanged = original ? member.canEditContext !== original.canEditContext : true
    if (!roleChanged && !canEditChanged) return

    setSavingMemberId(memberId)
    try {
      const res = await fetch(`/api/accounts/${accountId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(roleChanged && { role: member.role }),
          ...(canEditChanged && { canEditContext: member.canEditContext }),
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Error actualizando miembro')
      }

      if (data?.member) {
        setMembersState((prev) => prev.map((m) => (m.id === memberId ? data.member : m)))
        membersBaselineRef.current.set(memberId, data.member)
      }
    } catch (error) {
      console.error('Error updating member:', error)
    } finally {
      setSavingMemberId(null)
    }
  }

  const handleInviteMember = async () => {
    if (!canManageMembers) return
    const username = inviteUsername.trim()
    if (!username) return

    setIsInviting(true)
    try {
      const res = await fetch(`/api/accounts/${accountId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          role: inviteRole,
          canEditContext: inviteCanEditContext,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Error invitando miembro')
      }

      if (data?.member) {
        setMembersState((prev) => [data.member, ...prev])
        membersBaselineRef.current.set(data.member.id, data.member)
      }

      setInviteUsername('')
      setInviteRole('member')
      setInviteCanEditContext(false)
    } catch (error) {
      console.error('Error inviting member:', error)
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!canManageMembers) return
    setRemovingMemberId(memberId)
    try {
      const res = await fetch(`/api/accounts/${accountId}/members/${memberId}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Error eliminando miembro')
      }

      setMembersState((prev) => prev.filter((m) => m.id !== memberId))
      membersBaselineRef.current.delete(memberId)
    } catch (error) {
      console.error('Error removing member:', error)
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleUpdateStyleProfile = async () => {
    setIsUpdatingProfile(true)
    try {
      const response = await fetch(`/api/accounts/${accountId}/style-profile`, {
        method: 'POST',
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Error updating profile')
      }

      if (data?.profile) {
        setCurrentStyleProfile(data.profile)
      }
      
      // Auto-rellenar campos con datos del análisis AI
      if (data?.brandVoice && !brandVoice) {
        setBrandVoice(data.brandVoice)
      }
      if (data?.alwaysDo?.length && alwaysDo.length === 0) {
        setAlwaysDo(data.alwaysDo)
      }
      if (data?.neverDo?.length && neverDo.length === 0) {
        setNeverDo(data.neverDo)
      }
      if (data?.hashtags?.length && hashtags.length === 0) {
        setHashtags(data.hashtags)
      }
    } catch (error) {
      console.error('Error updating style profile:', error)
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch(`/api/accounts/${accountId}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandVoice,
          bio,
          expertise,
          alwaysDo,
          neverDo,
          hashtags,
          defaultTone,
          defaultLanguage,
        }),
      })

      if (!response.ok) {
        throw new Error('Error saving context')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving context:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const addItem = (
    list: string[],
    setList: (items: string[]) => void,
    value: string,
    setValue: (value: string) => void
  ) => {
    if (value.trim() && !list.includes(value.trim())) {
      setList([...list, value.trim()])
      setValue('')
    }
  }

  const removeItem = (list: string[], setList: (items: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index))
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/documents/${docId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDocuments(documents.filter(d => d.id !== docId))
      }
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  // Parse style profile data
  const sampleCasts = currentStyleProfile?.sampleCasts ? JSON.parse(currentStyleProfile.sampleCasts) : []
  const topics = currentStyleProfile?.topics ? JSON.parse(currentStyleProfile.topics) : []
  const commonPhrases = currentStyleProfile?.commonPhrases ? JSON.parse(currentStyleProfile.commonPhrases) : []

  const toneLabels: Record<string, string> = {
    casual: 'Casual',
    formal: 'Formal',
    technical: 'Técnico',
    humorous: 'Humorístico',
    mixed: 'Mixto',
  }

  const emojiLabels: Record<string, string> = {
    none: 'Sin emojis',
    light: 'Uso ligero',
    heavy: 'Uso frecuente',
  }

  const langLabels: Record<string, string> = {
    en: 'Inglés',
    es: 'Español',
    mixed: 'Mixto',
  }

  return (
    <div className="space-y-6">
      {/* Perfil automático de Neynar */}
      {currentStyleProfile && (
        <section className="bg-card border border-border rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-medium">Detected Style</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateStyleProfile}
              disabled={isUpdatingProfile}
              className="ml-auto h-7 px-2 gap-1"
            >
              {isUpdatingProfile ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span className="text-xs">Refresh</span>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-background rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Tone</span>
                <p className="text-sm font-medium">{toneLabels[currentStyleProfile.tone] || currentStyleProfile.tone}</p>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Language</span>
                <p className="text-sm font-medium">{langLabels[currentStyleProfile.languagePreference] || currentStyleProfile.languagePreference}</p>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Emojis</span>
                <p className="text-sm font-medium">{emojiLabels[currentStyleProfile.emojiUsage] || currentStyleProfile.emojiUsage}</p>
              </div>
              <div className="p-2 bg-background rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg length</span>
                <p className="text-sm font-medium">{currentStyleProfile.avgLength} chars</p>
              </div>
            </div>

            {/* Right: Topics & Samples */}
            <div className="space-y-2">
              {topics.length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Topics</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {topics.slice(0, 5).map((topic: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-background text-xs rounded">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {sampleCasts.length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Sample</span>
                  <p className="text-xs text-muted-foreground bg-background p-1.5 rounded mt-1 line-clamp-2">
                    "{sampleCasts[0]}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!currentStyleProfile && (
        <section className="bg-card border border-border rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="w-5 h-5" />
            <p className="text-sm">
              El perfil de estilo se generará automáticamente cuando publiques casts.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateStyleProfile}
              disabled={isUpdatingProfile}
              className="ml-auto gap-1.5"
            >
              {isUpdatingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Generar ahora
            </Button>
          </div>
        </section>
      )}

      {/* Brand Voice */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-medium">Brand Voice</h2>
        </div>
        <Textarea
          placeholder="Describe el tono y estilo de comunicación. Ej: Profesional pero cercano, usamos humor cuando es apropiado..."
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          disabled={!canEdit}
          className="min-h-[200px] resize-y"
        />
      </section>

      {/* Bio */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <h2 className="text-sm font-medium">Bio / Description</h2>
        <Textarea
          placeholder="Descripción de la cuenta, proyecto o empresa..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={!canEdit}
          className="min-h-[80px]"
        />
      </section>

      {/* Default Settings */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <h2 className="text-sm font-medium">Default Settings</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Tono</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id={`account-${accountId}-default-tone-trigger`}>
                <Button variant="outline" className="w-full justify-start" disabled={!canEdit}>
                  {TONES.find(t => t.value === defaultTone)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {TONES.map((tone) => (
                  <DropdownMenuItem key={tone.value} onClick={() => setDefaultTone(tone.value as typeof defaultTone)}>
                    {tone.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Idioma</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id={`account-${accountId}-default-language-trigger`}>
                <Button variant="outline" className="w-full justify-start" disabled={!canEdit}>
                  {LANGUAGES.find(l => l.value === defaultLanguage)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem key={lang.value} onClick={() => setDefaultLanguage(lang.value as typeof defaultLanguage)}>
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>

      {/* Expertise */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <h2 className="text-sm font-medium">Expertise</h2>
        <div className="flex flex-wrap gap-2">
          {expertise.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
              {item}
              {canEdit && (
                <button
                  onClick={() => removeItem(expertise, setExpertise, i)}
                  className="hover:text-destructive"
                  aria-label={`Eliminar ${item}`}
                  title={`Eliminar ${item}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <div className="flex items-center gap-1">
              <Input
                placeholder="Añadir..."
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem(expertise, setExpertise, newExpertise, setNewExpertise)}
                className="w-32 h-8 text-sm"
              />
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => addItem(expertise, setExpertise, newExpertise, setNewExpertise)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Rules: Always Do / Never Do */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-medium">Always Do</h2>
          </div>
          <div className="space-y-2">
            {alwaysDo.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg text-sm">
                <span className="flex-1">{item}</span>
                {canEdit && (
                  <button
                    onClick={() => removeItem(alwaysDo, setAlwaysDo, i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar ${item}`}
                    title={`Eliminar ${item}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="flex items-center gap-1">
                <Input
                  placeholder="Añadir regla..."
                  value={newAlwaysDo}
                  onChange={(e) => setNewAlwaysDo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem(alwaysDo, setAlwaysDo, newAlwaysDo, setNewAlwaysDo)}
                  className="h-9 text-sm"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => addItem(alwaysDo, setAlwaysDo, newAlwaysDo, setNewAlwaysDo)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <h2 className="text-sm font-medium">Never Do</h2>
          </div>
          <div className="space-y-2">
            {neverDo.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-sm">
                <span className="flex-1">{item}</span>
                {canEdit && (
                  <button
                    onClick={() => removeItem(neverDo, setNeverDo, i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar ${item}`}
                    title={`Eliminar ${item}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="flex items-center gap-1">
                <Input
                  placeholder="Añadir regla..."
                  value={newNeverDo}
                  onChange={(e) => setNewNeverDo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem(neverDo, setNeverDo, newNeverDo, setNewNeverDo)}
                  className="h-9 text-sm"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => addItem(neverDo, setNeverDo, newNeverDo, setNewNeverDo)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Hashtags */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-medium">Hashtags</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm flex items-center gap-1">
              #{item}
              {canEdit && (
                <button
                  onClick={() => removeItem(hashtags, setHashtags, i)}
                  className="hover:text-destructive"
                  aria-label={`Eliminar #${item}`}
                  title={`Eliminar #${item}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <div className="flex items-center gap-1">
              <Input
                placeholder="Añadir..."
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value.replace('#', ''))}
                onKeyDown={(e) => e.key === 'Enter' && addItem(hashtags, setHashtags, newHashtag, setNewHashtag)}
                className="w-32 h-8 text-sm"
              />
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => addItem(hashtags, setHashtags, newHashtag, setNewHashtag)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Documents */}
      <section className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <h2 className="text-sm font-medium">Documents</h2>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Añadir documento
            </Button>
          )}
        </div>
        {documents.length === 0 ? (
          <div className="p-6 border border-dashed border-border rounded-lg text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay documentos añadidos</p>
            <p className="text-xs mt-1">Añade brand guidelines, FAQs, specs de producto...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.type} · {new Date(doc.addedAt).toLocaleDateString()}
                  </p>
                </div>
                {canEdit && (
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar documento ${doc.name}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
})
