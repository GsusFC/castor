'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Camera } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentProfile: {
    displayName?: string
    bio?: string
    pfpUrl?: string
    url?: string
    bannerUrl?: string
  }
  isPro?: boolean
  onSave?: () => void
}

export function EditProfileDialog({
  open,
  onOpenChange,
  currentProfile,
  isPro = false,
  onSave
}: EditProfileDialogProps) {
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [pfpUrl, setPfpUrl] = useState('')
  const [url, setUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDisplayName(currentProfile.displayName || '')
      setBio(currentProfile.bio || '')
      setPfpUrl(currentProfile.pfpUrl || '')
      setUrl(currentProfile.url || '')
      setBannerUrl(currentProfile.bannerUrl || '')
    }
  }, [open, currentProfile])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || undefined,
          bio: bio || undefined,
          pfpUrl: pfpUrl || undefined,
          url: url || undefined,
          bannerUrl: isPro ? (bannerUrl || undefined) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error saving')
      }

      toast.success('Profile updated')
      onSave?.()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error saving profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              {pfpUrl ? (
                <img
                  src={pfpUrl}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* URL de avatar */}
          <div>
            <label className="text-sm font-medium">Profile photo URL</label>
            <input
              type="url"
              value={pfpUrl}
              onChange={(e) => setPfpUrl(e.target.value)}
              placeholder="https://..."
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>

          {/* Banner - Solo Pro */}
          {isPro && (
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                Banner URL
                <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Pro</span>
              </label>
              {bannerUrl && (
                <div className="mt-1 mb-2 h-20 rounded-lg overflow-hidden">
                  <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://... (recomendado: 1500x500px)"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
              />
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">{displayName.length}/50</p>
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              maxLength={256}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{bio.length}/256</p>
          </div>

          {/* URL */}
          <div>
            <label className="text-sm font-medium">Link</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tu-web.com"
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
