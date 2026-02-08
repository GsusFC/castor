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

    const row = screen.getByRole('button', { name: /hello/i })
    row.focus()
    await user.keyboard('{Enter}')

    expect(onSelectCast).toHaveBeenCalledWith('cast-1')
  })

  it('calls duplicate without selecting row from Queue action button', async () => {
    const user = userEvent.setup()
    const onSelectCast = vi.fn()
    const onDuplicateCast = vi.fn()

    render(
      <QueuePanel
        casts={[baseCast]}
        onSelectCast={onSelectCast}
        onStartCast={vi.fn()}
        onDeleteCast={vi.fn()}
        onDuplicateCast={onDuplicateCast}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
        hasMore={false}
        locale="en-US"
        timeZone="UTC"
      />
    )

    await user.click(screen.getByRole('button', { name: /duplicate as draft/i }))

    expect(onDuplicateCast).toHaveBeenCalledWith('cast-1')
    expect(onSelectCast).not.toHaveBeenCalled()
  })

  it('shows queue status badges for retrying and failed', () => {
    render(
      <QueuePanel
        casts={[
          { ...baseCast, id: 'retrying-cast', status: 'retrying' as const },
          { ...baseCast, id: 'failed-cast', status: 'failed' as const },
        ]}
        onSelectCast={vi.fn()}
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

    expect(screen.getByText('Retrying')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('calls duplicate without selecting row from Activity action button', async () => {
    const user = userEvent.setup()
    const onSelectCast = vi.fn()
    const onDuplicateCast = vi.fn()

    render(
      <ActivityPanel
        casts={[{ ...baseCast, status: 'published', publishedAt: '2026-02-10T11:00:00.000Z' }]}
        onSelectCast={onSelectCast}
        onStartCast={vi.fn()}
        onDuplicateCast={onDuplicateCast}
        onLoadMore={vi.fn()}
        isLoadingMore={false}
        hasMore={false}
        locale="en-US"
        timeZone="UTC"
      />
    )

    await user.click(screen.getByRole('button', { name: /duplicate as draft/i }))

    expect(onDuplicateCast).toHaveBeenCalledWith('cast-1')
    expect(onSelectCast).not.toHaveBeenCalled()
  })
})
