import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueuePanel, ActivityPanel } from './StudioV2Client'

const baseCast = {
  id: 'cast-1',
  content: 'hello',
  status: 'scheduled',
  scheduledAt: '2026-02-10T10:00:00.000Z',
  publishedAt: null,
  castHash: null,
  channelId: null,
  errorMessage: null,
  retryCount: 0,
  accountId: 'account-1',
  account: null,
  createdBy: null,
  media: [],
}

describe('StudioV2 panels keyboard access', () => {
  it('opens cast from Queue with keyboard', async () => {
    const user = userEvent.setup()
    const onSelectCast = vi.fn()

    render(
      <QueuePanel
        casts={[baseCast]}
        onSelectCast={onSelectCast}
        onStartCast={vi.fn()}
        onDeleteCast={vi.fn()}
        onDuplicateCast={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
        hasMore={false}
        locale="en-US"
        timeZone="UTC"
      />
    )

    const row = screen.getByRole('button', { name: /hello/i })
    row.focus()
    await user.keyboard('{Enter}')

    expect(onSelectCast).toHaveBeenCalledWith('cast-1')
  })

  it('opens cast from Activity with keyboard', async () => {
    const user = userEvent.setup()
    const onSelectCast = vi.fn()

    render(
      <ActivityPanel
        casts={[{ ...baseCast, status: 'published', publishedAt: '2026-02-10T11:00:00.000Z' }]}
        onSelectCast={onSelectCast}
        onStartCast={vi.fn()}
        onDuplicateCast={vi.fn()}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
        hasMore={false}
        locale="en-US"
        timeZone="UTC"
      />
    )

    const row = screen.getByRole('button')
    row.focus()
    await user.keyboard('{Enter}')

    expect(onSelectCast).toHaveBeenCalledWith('cast-1')
  })
})
