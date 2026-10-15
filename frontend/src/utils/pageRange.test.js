import { parsePageRange } from './pageRange'

test('parses ranges like the backend', () => {
  expect(parsePageRange('', 3)).toEqual([1, 2, 3])
  expect(parsePageRange('1-3,5', 6)).toEqual([1, 2, 3, 5])
  expect(parsePageRange('5,2,2-3', 6)).toEqual([2, 3, 5])
})
test('rejects invalid input', () => {
  for (const bad of ['7', '3-1', '0-2', 'a', '1;2']) expect(() => parsePageRange(bad, 6)).toThrow()
})
