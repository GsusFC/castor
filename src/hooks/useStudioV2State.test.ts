import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudioV2State } from './useStudioV2State'
import type { SerializedCast } from '@/types'

const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

const baseCast: SerializedCast = {
  id: 'f7113d54d4a2a29abeacc',
  accountId: 'account-1',
  content: 'Draft cast',
  status: 'draft',
  scheduledAt: '2026-03-06T15:30:00.000Z',
  publishedAt: null,
  castHash: null,
  channelId: null,
  errorMessage: null,
  retryCount: 0,
  media: [],
  account: null,
  createdBy: null,
}

describe('useStudioV2State delete behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    toastSuccess.mockReset()
    toastError.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('keeps optimistic removal when DELETE returns 404', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const { result } = renderHook(() =>
      useStudioV2State({
        casts: [baseCast],
        templates: [],
        approvedAccountIds: ['account-1'],
      })
    )

    expect(result.current.upcomingCasts).toHaveLength(1)

    await act(async () => {
      await result.current.handleDeleteCast(baseCast.id)
    })

    await waitFor(() => {
      expect(result.current.upcomingCasts).toHaveLength(0)
    })

    expect(global.fetch).toHaveBeenCalledWith(`/api/casts/${baseCast.id}`, { method: 'DELETE' })
    expect(toastSuccess).toHaveBeenCalledWith('Cast was already deleted')
    expect(toastError).not.toHaveBeenCalled()
  })

  it('rolls back optimistic removal when DELETE fails with non-404', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() =>
      useStudioV2State({
        casts: [baseCast],
        templates: [],
        approvedAccountIds: ['account-1'],
      })
    )

    expect(result.current.upcomingCasts).toHaveLength(1)

    await act(async () => {
      await result.current.handleDeleteCast(baseCast.id)
    })

    await waitFor(() => {
      expect(result.current.upcomingCasts).toHaveLength(1)
    })

    expect(toastError).toHaveBeenCalledWith('Could not delete cast')
  })
})

