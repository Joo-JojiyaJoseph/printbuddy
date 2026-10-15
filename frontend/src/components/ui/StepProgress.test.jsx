import { render, screen } from '@testing-library/react'
import StepProgress from './StepProgress'

test('exposes current step accessibly', () => {
  render(<StepProgress current={2} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  expect(screen.getByRole('progressbar')).toHaveAccessibleName(/Step 3 of 6: Edit/)
})
