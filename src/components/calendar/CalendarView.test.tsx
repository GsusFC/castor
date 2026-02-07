import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalendarView } from './CalendarView'

describe('CalendarView', () => {
  const baseProps = {
    casts: [],
    onMoveCast: vi.fn().mockResolvedValue(undefined),
  }

  it('starts week on Monday when weekStartsOn=1', () => {
    render(
      <CalendarView
        {...baseProps}
        weekStartsOn={1}
      />
    )

    const weekdayHeaders = screen.getAllByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)
    expect(weekdayHeaders[0]).toHaveTextContent('Mon')
    expect(weekdayHeaders[6]).toHaveTextContent('Sun')
  })

  it('starts week on Sunday when weekStartsOn=0', () => {
    render(
      <CalendarView
        {...baseProps}
        weekStartsOn={0}
      />
    )

    const weekdayHeaders = screen.getAllByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/)
    expect(weekdayHeaders[0]).toHaveTextContent('Sun')
    expect(weekdayHeaders[6]).toHaveTextContent('Sat')
  })

  it('calls selection callbacks from day and cast interactions', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    const onSelectCast = vi.fn()
    const date = new Date('2026-02-10T10:00:00.000Z')

    render(
      <CalendarView
        casts={[
          {
            id: 'cast-1',
            content: 'Test cast',
            scheduledAt: date,
            status: 'scheduled',
            account: null,
          },
        ]}
        onMoveCast={baseProps.onMoveCast}
        onSelectDate={onSelectDate}
        onSelectCast={onSelectCast}
        locale="en-US"
        timeZone="UTC"
      />
    )

    await user.click(screen.getByRole('button', { name: /Select February 10, 2026/i }))
    await user.click(screen.getByRole('button', { name: /Open cast scheduled at/i }))

    expect(onSelectDate).toHaveBeenCalled()
    expect(onSelectCast).toHaveBeenCalledWith('cast-1')
  })
})
