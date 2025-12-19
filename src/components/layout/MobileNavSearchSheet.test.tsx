import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MobileNavSearchSheet } from './MobileNavSearchSheet'

vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SheetContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SheetHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SheetTitle = ({ children }: { children: React.ReactNode }) => <div>{children}</div>

  return { Sheet, SheetContent, SheetHeader, SheetTitle }
})

describe('MobileNavSearchSheet', () => {
  it('abre un cast al hacer click en un resultado de Casts', async () => {
    const user = userEvent.setup()
    const onSelectCast = vi.fn()

    render(
      <MobileNavSearchSheet
        open
        onOpenChange={() => null}
        searchQuery="hello"
        onSearchQueryChange={() => null}
        searchResults={{
          users: [],
          channels: [],
          casts: [
            {
              hash: '0xabc',
              text: 'hello world',
              author: { username: 'alice', pfp_url: null },
            },
          ],
        }}
        isSearching={false}
        favorites={[]}
        toggleFavorite={async () => null}
        onSelectUser={() => null}
        onSelectChannel={() => null}
        onSelectCast={onSelectCast}
      />
    )

    await user.click(screen.getByRole('tab', { name: 'Casts' }))
    await user.click(screen.getByText(/hello world/i))

    expect(onSelectCast).toHaveBeenCalledWith('0xabc')
  })

  it('muestra no-results por tab', async () => {
    const user = userEvent.setup()

    render(
      <MobileNavSearchSheet
        open
        onOpenChange={() => null}
        searchQuery="zz"
        onSearchQueryChange={() => null}
        searchResults={{ users: [], channels: [], casts: [{ hash: '0x1', text: 'cast', author: { username: 'u' } }] }}
        isSearching={false}
        favorites={[]}
        toggleFavorite={async () => null}
        onSelectUser={() => null}
        onSelectChannel={() => null}
        onSelectCast={() => null}
      />
    )

    await user.click(screen.getByRole('tab', { name: 'Users' }))
    expect(screen.getByText('No users found')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Casts' }))
    expect(screen.queryByText('No casts found')).not.toBeInTheDocument()
  })
})
