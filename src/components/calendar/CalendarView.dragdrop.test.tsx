import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

let dragEndHandler: ((event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void) | null = null

const matchMediaMock = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

vi.stubGlobal('matchMedia', (query: string) => matchMediaMock(query))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => Promise<void> | void }) => {
    dragEndHandler = onDragEnd ?? null
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            dragEndHandler?.({
              active: { id: 'cast-1' },
              over: { id: '2026-02-11' },
            })
          }}
        >
          Trigger Drag End
        </button>
        {children}
      </div>
    )
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
  }),
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}))

import { toast } from 'sonner'
import { CalendarView } from './CalendarView'

describe('CalendarView drag and drop rollback', () => {
  it('shows error feedback when drag/drop reschedule fails', async () => {
    const user = userEvent.setup()
    const onMoveCast = vi.fn().mockRejectedValue(new Error('network fail'))

    render(
      <CalendarView
        casts={[
          {
            id: 'cast-1',
            content: 'Drag me',
            scheduledAt: new Date('2026-02-10T10:00:00.000Z'),
            status: 'scheduled',
            account: null,
          },
        ]}
        onMoveCast={onMoveCast}
        locale="en-US"
        timeZone="UTC"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Trigger Drag End' }))

    expect(onMoveCast).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('Could not reschedule cast. Changes were reverted.')
    expect(toast.success).not.toHaveBeenCalled()
  })
})
