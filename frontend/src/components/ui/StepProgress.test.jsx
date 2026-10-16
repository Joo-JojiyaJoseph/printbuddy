import { render, screen } from '@testing-library/react'
import StepProgress from './StepProgress'

test('names the current phase accessibly (screens map onto four phases)', () => {
  const { rerender } = render(<StepProgress current={2} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  expect(screen.getByRole('progressbar')).toHaveAccessibleName(/Step 2 of 4: Edit/)
  rerender(<StepProgress current={1} />)
  expect(screen.getByRole('progressbar')).toHaveAccessibleName(/Step 1 of 4: Upload/)
  rerender(<StepProgress current={5} />)
  expect(screen.getByRole('progressbar')).toHaveAccessibleName('Order complete')
})
