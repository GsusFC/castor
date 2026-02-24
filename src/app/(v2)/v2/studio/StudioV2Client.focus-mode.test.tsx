import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SerializedAccount, SessionUser } from '@/types'

vi.mock('@/components/v2/AppHeader', () => ({
  AppHeader: () => <div data-testid="app-header" />,
}))

vi.mock('@/components/v2/ComposerPanel', () => ({
  ComposerPanel: React.forwardRef((
    props: {
      onComposerStateChange?: (state: {
        selectedNetworks: Array<'farcaster' | 'x' | 'linkedin'>
        availableNetworks: Record<'farcaster' | 'x' | 'linkedin', boolean>
        hasContent: boolean
        hasMedia: boolean
        isMediaReady: boolean
        hasOverLimit: boolean
        typefullyLinked: boolean
        scheduleReady: boolean
      }) => void
    },
    _ref
  ) => {
    React.useEffect(() => {
      props.onComposerStateChange?.({
        selectedNetworks: ['farcaster'],
        availableNetworks: { farcaster: true, x: false, linkedin: false },
        hasContent: true,
        hasMedia: false,
        isMediaReady: true,
        hasOverLimit: false,
        typefullyLinked: false,
        scheduleReady: true,
      })
    }, [props.onComposerStateChange])
    return <div data-testid="composer-panel" />
  }),
}))

vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}))

vi.mock('@/context/SelectedAccountV2Context', () => ({
  SelectedAccountV2Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/v2/StudioLayout', () => ({
  StudioLayout: ({
    rightPanelControls,
    isCalendarCollapsed,
    focusAside,
  }: {
    rightPanelControls?: React.ReactNode
    isCalendarCollapsed?: boolean
    focusAside?: React.ReactNode
  }) => (
    <div>
      <div data-testid="collapsed-state">{isCalendarCollapsed ? 'collapsed' : 'normal'}</div>
      <div data-testid="focus-aside">{focusAside}</div>
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
    voiceMode: 'auto',
    isPremium: false,
    ownerId: 'user-1',
    owner: null,
    hasBrandVoice: false,
  },
]

describe('StudioV2Client focus mode', () => {
  it('loads composer focus from localStorage and toggles back to normal', async () => {
    const userEventSetup = userEvent.setup()
    window.localStorage.setItem('castor:studio:v2:desktop-focus-mode', 'composer')
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <StudioV2Client
        user={user}
        accounts={accounts}
        casts={[]}
        templates={[]}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('collapsed-state')).toHaveTextContent('collapsed')
    })

    await userEventSetup.click(screen.getByRole('button', { name: /show calendar/i }))

    await waitFor(() => {
      expect(window.localStorage.getItem('castor:studio:v2:desktop-focus-mode')).toBe('normal')
    })
  })

  it('renders focus checklist from composer snapshot', async () => {
    window.localStorage.setItem('castor:studio:v2:desktop-focus-mode', 'composer')
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <StudioV2Client
        user={user}
        accounts={accounts}
        casts={[]}
        templates={[]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Focus Checklist')).toBeInTheDocument()
      expect(screen.getByText('Within limits')).toBeInTheDocument()
    })
  })
})
