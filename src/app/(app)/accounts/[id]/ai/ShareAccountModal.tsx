'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Users, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AccountMember } from '@/lib/db'

interface CastorUserSuggestion {
  id: string
  username: string
  displayName: string | null
  pfpUrl: string | null
}

type MemberWithUser = AccountMember & {
  user: { id: string; username: string; displayName: string | null; pfpUrl: string | null }
}

interface ShareAccountModalProps {
  isOpen: boolean
  onClose: () => void
  accountId: string
  members: MemberWithUser[]
}

export function ShareAccountModal({ isOpen, onClose, accountId, members: initialMembers }: ShareAccountModalProps) {
  const [membersState, setMembersState] = useState(initialMembers)
  const membersBaselineRef = useRef(new Map<string, MemberWithUser>())

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
    setMembersState(initialMembers)
    membersBaselineRef.current = new Map(initialMembers.map((m) => [m.id, m]))
  }, [initialMembers])

  useEffect(() => {
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
  }, [inviteUsername])

  const handleUpdateMemberLocal = (
    memberId: string,
    updates: Partial<{ role: 'admin' | 'member'; canEditContext: boolean }>
  ) => {
    setMembersState((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m))
    )
  }

  const handleSaveMember = async (memberId: string) => {
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
          role: member.role,
          canEditContext: member.canEditContext,
        }),
      })
      if (!res.ok) throw new Error('Failed to update member')
      membersBaselineRef.current.set(memberId, member)
    } catch (err) {
      console.error('Error updating member:', err)
    } finally {
      setSavingMemberId(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId)
    try {
      const res = await fetch(`/api/accounts/${accountId}/members/${memberId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove member')
      setMembersState((prev) => prev.filter((m) => m.id !== memberId))
      membersBaselineRef.current.delete(memberId)
    } catch (err) {
      console.error('Error removing member:', err)
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleInviteMember = async () => {
    const username = inviteUsername.trim().replace(/^@/, '')
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

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to invite member')
      }

      const { member } = await res.json()
      setMembersState((prev) => [...prev, member])
      membersBaselineRef.current.set(member.id, member)
      setInviteUsername('')
      setInviteRole('member')
      setInviteCanEditContext(false)
    } catch (err) {
      console.error('Error inviting member:', err)
    } finally {
      setIsInviting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Share Account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Invite form */}
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Invite by @username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInviteMember()}
                onFocus={() => setShowInviteSuggestions(true)}
                onBlur={() => setTimeout(() => setShowInviteSuggestions(false), 150)}
                disabled={isInviting}
              />

              {showInviteSuggestions && (isSearchingUsers || inviteSuggestions.length > 0) && (
                <div className="absolute z-50 mt-2 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                  {isSearchingUsers ? (
                    <div className="flex items-center justify-center p-3">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {inviteSuggestions.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setInviteUsername(`@${u.username}`)
                            setShowInviteSuggestions(false)
                          }}
                        >
                          {u.pfpUrl ? (
                            <img src={u.pfpUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {u.displayName || u.username}
                            </div>
                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isInviting} className="flex-1 justify-start">
                    {inviteRole === 'admin' ? 'Admin' : 'Member'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setInviteRole('member')}>Member</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteRole('admin')}>Admin</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleInviteMember}
                disabled={isInviting || !inviteUsername.trim()}
                className="gap-1.5"
              >
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Invite
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={inviteCanEditContext}
                onChange={(e) => setInviteCanEditContext(e.target.checked)}
                disabled={isInviting}
              />
              Can edit context
            </label>
          </div>

          {/* Members list */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Members</p>
            {membersState.length === 0 ? (
              <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground">
                <p className="text-sm">No members yet</p>
              </div>
            ) : (
              membersState.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  {member.user.pfpUrl ? (
                    <img src={member.user.pfpUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-muted rounded-full" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {member.user.displayName || member.user.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{member.user.username}
                      {member.canEditContext && ' · can edit'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          {member.role === 'admin' ? 'Admin' : 'Member'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleUpdateMemberLocal(member.id, { role: 'member' })}>Member</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateMemberLocal(member.id, { role: 'admin' })}>Admin</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveMember(member.id)}
                      disabled={savingMemberId === member.id}
                      className="h-7 text-xs"
                    >
                      {savingMemberId === member.id ? '...' : 'Save'}
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingMemberId === member.id}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
