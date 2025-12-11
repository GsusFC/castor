'use client'

import { useState } from 'react'
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

interface ContextEditorProps {
  accountId: string
  account: Account
  knowledgeBase: AccountKnowledgeBase | null | undefined
  documents: AccountDocument[]
  members: (AccountMember & { user: { id: string; username: string; displayName: string | null; pfpUrl: string | null } })[]
  canEdit: boolean
  isShared: boolean
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

export function ContextEditor({
  accountId,
  account,
  knowledgeBase,
  documents: initialDocuments,
  members,
  canEdit,
  isShared,
  styleProfile,
}: ContextEditorProps) {
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

  const handleUpdateStyleProfile = async () => {
    setIsUpdatingProfile(true)
    try {
      const response = await fetch(`/api/accounts/${accountId}/style-profile`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error updating profile')
      }

      const data = await response.json()
      setCurrentStyleProfile(data.profile)
      
      // Auto-rellenar campos con datos del análisis AI
      if (data.brandVoice && !brandVoice) {
        setBrandVoice(data.brandVoice)
      }
      if (data.alwaysDo?.length && alwaysDo.length === 0) {
        setAlwaysDo(data.alwaysDo)
      }
      if (data.neverDo?.length && neverDo.length === 0) {
        setNeverDo(data.neverDo)
      }
      if (data.hashtags?.length && hashtags.length === 0) {
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
    <div className="space-y-8">
      {/* Perfil automático de Neynar */}
      {currentStyleProfile && (
        <section className="p-4 border border-primary/20 rounded-xl bg-primary/5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Estilo detectado (automático)</h2>
            <Button
              variant="ghost"
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
              Actualizar
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-background rounded-lg">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Tono</span>
              </div>
              <p className="font-medium">{toneLabels[currentStyleProfile.tone] || currentStyleProfile.tone}</p>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Globe className="w-4 h-4" />
                <span className="text-xs">Idioma</span>
              </div>
              <p className="font-medium">{langLabels[currentStyleProfile.languagePreference] || currentStyleProfile.languagePreference}</p>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Smile className="w-4 h-4" />
                <span className="text-xs">Emojis</span>
              </div>
              <p className="font-medium">{emojiLabels[currentStyleProfile.emojiUsage] || currentStyleProfile.emojiUsage}</p>
            </div>
            <div className="p-3 bg-background rounded-lg">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs">Long. media</span>
              </div>
              <p className="font-medium">{currentStyleProfile.avgLength} chars</p>
            </div>
          </div>

          {topics.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1.5">Temas frecuentes:</p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((topic: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-background text-xs rounded-full">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {sampleCasts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Ejemplos de estilo:</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {sampleCasts.slice(0, 3).map((cast: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground bg-background p-2 rounded line-clamp-2">
                    "{cast}"
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {!currentStyleProfile && (
        <section className="p-4 border border-dashed border-border rounded-xl">
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
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Voz de marca (manual)</h2>
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
      <section className="space-y-3">
        <h2 className="font-semibold">Bio / Descripción</h2>
        <Textarea
          placeholder="Descripción de la cuenta, proyecto o empresa..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          disabled={!canEdit}
          className="min-h-[80px]"
        />
      </section>

      {/* Default Settings */}
      <section className="space-y-3">
        <h2 className="font-semibold">Configuración por defecto</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Tono</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
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
              <DropdownMenuTrigger asChild>
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
      <section className="space-y-3">
        <h2 className="font-semibold">Áreas de expertise</h2>
        <div className="flex flex-wrap gap-2">
          {expertise.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1">
              {item}
              {canEdit && (
                <button onClick={() => removeItem(expertise, setExpertise, i)} className="hover:text-destructive">
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
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold">Siempre hacer</h2>
          </div>
          <div className="space-y-2">
            {alwaysDo.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-green-500/10 rounded-lg text-sm">
                <span className="flex-1">{item}</span>
                {canEdit && (
                  <button onClick={() => removeItem(alwaysDo, setAlwaysDo, i)} className="text-muted-foreground hover:text-destructive">
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

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <h2 className="font-semibold">Nunca hacer</h2>
          </div>
          <div className="space-y-2">
            {neverDo.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg text-sm">
                <span className="flex-1">{item}</span>
                {canEdit && (
                  <button onClick={() => removeItem(neverDo, setNeverDo, i)} className="text-muted-foreground hover:text-destructive">
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
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold">Hashtags frecuentes</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((item, i) => (
            <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm flex items-center gap-1">
              #{item}
              {canEdit && (
                <button onClick={() => removeItem(hashtags, setHashtags, i)} className="hover:text-destructive">
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
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold">Documentos</h2>
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
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members (if shared) */}
      {isShared && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold">Miembros</h2>
            </div>
            {canEdit && (
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Invitar
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                {member.user.pfpUrl ? (
                  <img src={member.user.pfpUrl} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-muted rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {member.user.displayName || member.user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{member.user.username} · {member.role}
                    {member.canEditContext && ' · puede editar contexto'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Save Button */}
      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Guardado
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar cambios
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
