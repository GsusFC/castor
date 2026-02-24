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

  it('shows calendar rail and hides right panel body when collapsed', () => {
    render(
      <StudioLayout
        composerPanel={<div>Composer content</div>}
        rightPanel={<div>Right panel content</div>}
        rightPanelControls={<div>Controls content</div>}
        isCalendarCollapsed
        calendarRail={<div>Rail content</div>}
      />
    )

    expect(screen.getByText('Rail content')).toBeInTheDocument()
    expect(screen.queryByText('Right panel content')).not.toBeInTheDocument()
  })

  it('renders focus aside content when calendar is collapsed', () => {
    render(
      <StudioLayout
        composerPanel={<div>Composer content</div>}
        rightPanel={<div>Right panel content</div>}
        isCalendarCollapsed
        calendarRail={<div>Rail content</div>}
        focusAside={<div>Checklist content</div>}
      />
    )

    expect(screen.getByText('Composer content')).toBeInTheDocument()
    expect(screen.getByText('Checklist content')).toBeInTheDocument()
    expect(screen.queryByText('Right panel content')).not.toBeInTheDocument()
  })

  it('hides legacy desktop panel body when collapsed and rightPanel is present', () => {
    render(
      <StudioLayout
        composerPanel={<div>Composer content</div>}
        rightPanel={<div>Right panel content</div>}
        calendarPanel={<div>Calendar panel</div>}
        queuePanel={<div>Queue panel</div>}
        activityPanel={<div>Activity panel</div>}
        isCalendarCollapsed
        calendarRail={<div>Rail content</div>}
      />
    )

    expect(screen.getByText('Rail content')).toBeInTheDocument()
    expect(screen.queryByText('Calendar panel')).not.toBeInTheDocument()
    expect(screen.queryByText('Queue panel')).not.toBeInTheDocument()
    expect(screen.queryByText('Activity panel')).not.toBeInTheDocument()
  })
})
