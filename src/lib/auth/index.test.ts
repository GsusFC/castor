import { describe, expect, it } from 'vitest'
import { canAccess, canModify, type AuthUser } from './index'

describe('permission helpers', () => {
  const baseUser: AuthUser = {
    userId: 'user-1',
    fid: 1,
    username: 'u1',
    displayName: 'U1',
    pfpUrl: '',
    role: 'member',
  }

  it('allows admin', () => {
    const admin: AuthUser = { ...baseUser, role: 'admin' }
    expect(canAccess(admin, { ownerId: 'other', isMember: false })).toBe(true)
    expect(canModify(admin, { ownerId: 'other', isMember: false })).toBe(true)
  })

  it('allows owner', () => {
    expect(canAccess(baseUser, { ownerId: baseUser.userId, isMember: false })).toBe(true)
    expect(canModify(baseUser, { ownerId: baseUser.userId, isMember: false })).toBe(true)
  })

  it('allows explicit member', () => {
    expect(canAccess(baseUser, { ownerId: 'other', isMember: true })).toBe(true)
    expect(canModify(baseUser, { ownerId: 'other', isMember: true })).toBe(true)
  })

  it('denies non-member non-owner', () => {
    expect(canAccess(baseUser, { ownerId: 'other', isMember: false })).toBe(false)
    expect(canModify(baseUser, { ownerId: 'other', isMember: false })).toBe(false)
  })
})
