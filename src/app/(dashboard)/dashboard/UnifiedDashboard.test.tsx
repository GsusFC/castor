import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UnifiedDashboard } from './UnifiedDashboard'
import { SelectedAccountProvider, useSelectedAccount } from '@/context/SelectedAccountContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}))

vi.mock('sonner', () => {
  const fn = vi.fn()
  return {
    toast: Object.assign(fn, {
      success: vi.fn(),
      error: vi.fn(),
    }),
  }
})

vi.mock('@/components/compose/ComposeModal', () => ({
  ComposeModal: () => null,
}))

vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: () => null,
}))

vi.mock('./accounts/add-account-button', () => ({
  AddAccountButton: () => null,
}))

const TestProbe = () => {
  const { selectedAccountId } = useSelectedAccount()
  return <div data-testid="selected-account">{selectedAccountId}</div>
}

describe('UnifiedDashboard', () => {
  it('selecciona por defecto la primera cuenta aprobada', async () => {
    const accounts = [
      {
        id: 'account-1',
        fid: 1,
        username: 'alpha',
        displayName: null,
        pfpUrl: null,
        signerStatus: 'approved',
        type: 'personal',
        isPremium: false,
        isShared: false,
        ownerId: null,
        owner: null,
      },
    ]

    render(
      <SelectedAccountProvider>
        <UnifiedDashboard
          accounts={accounts}
          casts={[]}
          templates={[]}
          currentUserId="user-1"
          isAdmin={false}
        />
        <TestProbe />
      </SelectedAccountProvider>
    )

    await waitFor(() =>
      expect(screen.getByTestId('selected-account')).toHaveTextContent('account-1')
    )
  })
})
