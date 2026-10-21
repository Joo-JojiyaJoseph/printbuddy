import test from 'node:test'
import assert from 'node:assert/strict'
import { checkConfig, safePrinterName, sumatraArgs, testPdf } from './lib.mjs'

const good = { server: 'https://api.example.com/', key: 'tpa_' + 'a'.repeat(48), sumatraPath: 'C:\\x\\SumatraPDF.exe' }
test('good config passes and is tidied', () => {
  const { config, problems } = checkConfig(good, () => true)
  assert.deepEqual(problems, [])
  assert.equal(config.server, 'https://api.example.com')
})
test('a pasted /api/v1 address is trimmed', () => assert.equal(checkConfig({ ...good, server: 'https://a.com/api/v1' }, () => true).config.server, 'https://a.com'))
test('bad key, missing sumatra and plain http are reported', () => {
  assert.ok(checkConfig({ ...good, key: 'nope' }, () => true).problems.some((p) => /key/.test(p)))
  assert.ok(checkConfig({ ...good, sumatraPath: '' }, () => false).problems.some((p) => /SumatraPDF/.test(p)))
  assert.ok(checkConfig({ ...good, server: 'http://shop.example.com' }, () => true).problems.some((p) => /https/.test(p)))
  assert.equal(checkConfig({ ...good, server: 'http://backend.test' }, () => true).problems.length, 0)
})
test('poll interval is kept in range', () => {
  assert.equal(checkConfig({ ...good, pollSeconds: 0 }, () => true).config.pollSeconds, 1)
  assert.equal(checkConfig({ ...good, pollSeconds: 999 }, () => true).config.pollSeconds, 30)
})
test('sumatra arguments match the options', () => {
  assert.deepEqual(sumatraArgs({ copies: 2, duplex: true, landscape: false, color: false, paper: 'A4' }, 'C:\\t\\j.pdf'), ['-print-to-default', '-print-settings', '2x,duplexlong,monochrome,paper=a4,fit', '-silent', 'C:\\t\\j.pdf'])
  assert.deepEqual(sumatraArgs({ copies: 500, duplex: true, landscape: true, color: true, paper: 'Letter' }, 'f.pdf', 'HP Office').slice(0, 4), ['-print-to', 'HP Office', '-print-settings', '100x,duplexshort,color,paper=letter,fit'])
  assert.match(sumatraArgs({ paper: 'weird' }, 'f.pdf')[2], /paper=a4/)
})
test('printer names with odd characters are refused', () => {
  assert.ok(safePrinterName('HP LaserJet Pro M404') && safePrinterName('\\\\SERVER\\Printer'))
  assert.ok(!safePrinterName('a"b') && !safePrinterName('a|b') && !safePrinterName('x'.repeat(200)))
})
test('test PDF looks like a PDF with a right-sized xref', () => {
  const s = testPdf().toString('latin1')
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'))
  const start = Number(s.match(/startxref\n(\d+)/)[1])
  assert.equal(s.slice(start, start + 4), 'xref')
})

import { pdftoppmArgs } from './lib.mjs'
test('poppler arguments: one page, bounded resolution, grey on request', () => {
  assert.deepEqual(pdftoppmArgs('s.pdf', 3, 300, true, 'p3'), ['-r', '300', '-f', '3', '-l', '3', '-jpeg', '-jpegopt', 'quality=92', '-gray', 's.pdf', 'p3'])
  assert.equal(pdftoppmArgs('s.pdf', 1, 99999, false, 'p')[1], '600')
  assert.equal(pdftoppmArgs('s.pdf', 1, 1, false, 'p')[1], '72')
  assert.throws(() => pdftoppmArgs('s.pdf', 'x; rm', 300, false, 'p'))
})
test('poppler path is found automatically or taken from config', () => {
  assert.equal(checkConfig({ ...good, popplerPath: 'D:\\p\\pdftoppm.exe' }, () => true).config.popplerPath, 'D:\\p\\pdftoppm.exe')
  assert.equal(checkConfig(good, () => false).config.popplerPath, '')
})
