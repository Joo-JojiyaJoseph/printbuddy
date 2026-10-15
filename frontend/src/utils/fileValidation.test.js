import { validateFile, LIMITS } from './fileValidation'

const file = (bytes, name) => new File([new Uint8Array(bytes)], name)
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]

test('accepts a real PDF and PNG by content', async () => {
  expect(await validateFile(file(PDF, 'a.pdf'))).toEqual({ ok: true, kind: 'pdf' })
  expect(await validateFile(file(PNG, 'a.png'))).toEqual({ ok: true, kind: 'png' })
})
test('rejects an executable renamed to .pdf', async () => {
  const r = await validateFile(file(EXE, 'invoice.pdf'))
  expect(r.ok).toBe(false)
  expect(r.error).toMatch(/valid PDF/)
})
test('rejects a PNG renamed to .jpg', async () => {
  expect((await validateFile(file(PNG, 'x.jpg'))).ok).toBe(false)
})
test('rejects unsupported extensions, empty and oversized files, and file-count overflow', async () => {
  expect((await validateFile(file(PDF, 'a.exe'))).error).toMatch(/not supported/)
  expect((await validateFile(new File([], 'a.pdf'))).error).toMatch(/empty/)
  const big = { name: 'a.pdf', size: LIMITS.maxBytes + 1, slice: () => new Blob([]) }
  expect((await validateFile(big)).error).toMatch(/larger than/)
  expect((await validateFile(file(PDF, 'a.pdf'), LIMITS.maxFiles)).error).toMatch(/up to/)
})
test('treats NUL-containing data as non-text', async () => {
  expect((await validateFile(file([104, 105, 0, 106], 'a.txt'))).ok).toBe(false)
  expect((await validateFile(file([104, 105, 10], 'a.txt'))).ok).toBe(true)
})
