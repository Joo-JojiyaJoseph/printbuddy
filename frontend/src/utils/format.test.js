import { formatINR } from './format'
test('formats integer paise as INR', () => {
  expect(formatINR(250)).toBe('₹2.50')
  expect(formatINR(0)).toBe('₹0.00')
})
