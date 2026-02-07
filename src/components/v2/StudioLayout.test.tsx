import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { StudioLayout } from './StudioLayout'

describe('StudioLayout', () => {
  it('renders accessible tabs and switches content', async () => {
    const user = userEvent.setup()

    render(
      <StudioLayout
        composerPanel={<div>Composer content</div>}
        calendarPanel={<div>Calendar panel</div>}
        queuePanel={<div>Queue panel</div>}
        activityPanel={<div>Activity panel</div>}
      />
    )

    expect(screen.getByRole('tablist', { name: 'Studio right panel tabs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Calendar panel')

    await user.click(screen.getByRole('tab', { name: 'Queue' }))

    expect(screen.getByRole('tab', { name: 'Queue' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Queue panel')
  })
})
