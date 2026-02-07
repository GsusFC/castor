import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SerializedAccount, SessionUser } from '@/types'

vi.mock('@/components/v2/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}))

vi.mock('@/components/v2/ComposerPanel', () => ({
  ComposerPanel: React.forwardRef(() => <div data-testid="composer-panel" />),
}))

vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}))

vi.mock('@/context/SelectedAccountV2Context', () => ({
  SelectedAccountV2Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/v2/StudioLayout', () => ({
  StudioLayout: ({ rightPanelControls }: { rightPanelControls?: React.ReactNode }) => (
    <div>
      {rightPanelControls}
    </div>
  ),
}))

import { StudioV2Client } from './StudioV2Client'

const user: SessionUser = {
  userId: 'user-1',
  fid: 1,
  username: 'owner',
  displayName: 'Owner',
  pfpUrl: null,
  role: 'admin',
}

const accounts: SerializedAccount[] = [
  {
    id: 'account-a',
    fid: 1,
    username: 'alpha',
    displayName: 'Alpha',
    pfpUrl: null,
    signerStatus: 'approved',
    type: 'business',
    isPremium: false,
    ownerId: 'user-1',
    owner: null,
    hasBrandVoice: false,
  },
  {
    id: 'account-b',
    fid: 2,
    username: 'beta',
    displayName: 'Beta',
    pfpUrl: null,
    signerStatus: 'approved',
    type: 'business',
    isPremium: false,
    ownerId: 'user-1',
    owner: null,
    hasBrandVoice: false,
  },
]

describe('StudioV2Client account filter', () => {
  it('does not loop or revert when changing selected account', async () => {
    const userEventSetup = userEvent.setup()
    window.localStorage.setItem('castor_v2_studio_account_filter', 'account-a')

    render(
      <StudioV2Client
        user={user}
        accounts={accounts}
        casts={[]}
        templates={[]}
      />
    )

    const select = screen.getByLabelText('Filter studio panels by account') as HTMLSelectElement
    expect(select.value).toBe('account-a')

    await userEventSetup.selectOptions(select, 'account-b')

    await waitFor(() => {
      expect(select.value).toBe('account-b')
      expect(window.localStorage.getItem('castor_v2_studio_account_filter')).toBe('account-b')
    })
  })
})
