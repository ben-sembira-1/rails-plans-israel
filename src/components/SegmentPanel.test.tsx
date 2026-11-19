import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { findSegment, lines } from '../data/index.ts'

import { SegmentPanel } from './SegmentPanel.tsx'

const first = lines[0]?.segments[0]
const ref = first === undefined ? undefined : findSegment(first.id)

describe('SegmentPanel', () => {
  it('shows the segment, a chronological timeline and sources', async () => {
    if (ref === undefined) {
      throw new Error('no data')
    }
    const onClose = vi.fn()
    render(<SegmentPanel segmentRef={ref} time={Date.UTC(2027, 0, 1)} onClose={onClose} />)

    expect(screen.getByRole('heading', { name: ref.segment.name })).toBeInTheDocument()
    const items = within(screen.getByRole('list', { name: 'Timeline' })).getAllByRole('listitem')
    expect(items.length).toBe(
      ref.segment.phases.length + ref.segment.milestones.length + ref.segment.workAreas.length,
    )
    expect(screen.getAllByText(/^Sources?:$/u).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
