// Pure helpers for the Taprint Print Agent (no I/O, unit tested).
import { existsSync } from 'node:fs'

export const SUMATRA_GUESSES = [
  'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
]

export const POPPLER_GUESSES = [
  'C:\\poppler\\Library\\bin\\pdftoppm.exe',
  'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe',
  'C:\\Program Files\\poppler\\bin\\pdftoppm.exe',
]

/** Arguments to render one PDF page to a JPEG picture (same options the server used). */
export function pdftoppmArgs(pdfPath, page, dpi, gray, prefix) {
  const p = Math.trunc(Number(page))
  const r = Math.min(600, Math.max(72, Math.trunc(Number(dpi)) || 300))
  if (!Number.isFinite(p) || p < 1 || p > 100000) throw new Error('bad page number')
  return ['-r', String(r), '-f', String(p), '-l', String(p), '-jpeg', '-jpegopt', 'quality=92', ...(gray ? ['-gray'] : []), pdfPath, prefix]
}

/** Checks config.json and returns { config, problems }. Nothing is printed here. */
export function checkConfig(raw, exists = existsSync) {
  const problems = []
  const c = { pollSeconds: 2, printerName: '', ...raw }
  let url = String(c.server || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+/i.test(url)) problems.push('"server" must be the website address of your Taprint backend, for example https://taprint-backend.example.com')
  if (/\/api\/v1$/i.test(url)) url = url.replace(/\/api\/v1$/i, '')
  if (/^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|[^/]+\.test)(:\d+)?$/i.test(url)) problems.push('Use https:// for a server on the internet.')
  if (!/^tpa_[0-9a-f]{20,}$/.test(String(c.key || '').trim())) problems.push('"key" is missing or wrong. Create it in the admin panel: Printer & kiosks, Create key.')
  let sumatra = String(c.sumatraPath || '').trim()
  if (!sumatra) sumatra = SUMATRA_GUESSES.find((p) => exists(p)) || ''
  if (!sumatra || !exists(sumatra)) problems.push('SumatraPDF.exe was not found. Install SumatraPDF, or put its full path in "sumatraPath".')
  let poppler = String(c.popplerPath || '').trim()
  if (!poppler) poppler = POPPLER_GUESSES.find((p) => exists(p)) || ''
  const poll = Number(c.pollSeconds)
  return { config: { ...c, server: url, key: String(c.key || '').trim(), sumatraPath: sumatra, popplerPath: poppler, pollSeconds: Number.isFinite(poll) ? Math.min(30, Math.max(1, poll)) : 2, printerName: String(c.printerName || '').trim() }, problems }
}

/** Arguments for SumatraPDF, same meaning as the server's own Sumatra driver. */
export function sumatraArgs(job, pdfPath, printerName = '') {
  const paper = { A4: 'a4', A5: 'a5', Letter: 'letter' }[job.paper] || 'a4'
  const settings = [
    `${Math.max(1, Math.min(100, Number(job.copies) || 1))}x`,
    job.duplex ? (job.landscape ? 'duplexshort' : 'duplexlong') : 'simplex',
    job.color ? 'color' : 'monochrome',
    `paper=${paper}`,
    'fit',
  ]
  const target = printerName ? ['-print-to', printerName] : ['-print-to-default']
  return [...target, '-print-settings', settings.join(','), '-silent', pdfPath]
}

/** A printer name is passed as one argument, never through a shell; still refuse odd characters. */
export function safePrinterName(name) {
  return typeof name === 'string' && name.length <= 120 && !/[\x00-\x1F"<>|]/.test(name)
}

/** A tiny one-page test PDF (no libraries needed). */
export function testPdf(text = 'Taprint print agent test page') {
  const esc = (s) => s.replace(/[\\()]/g, '\\$&')
  const stream = `BT /F1 20 Tf 60 760 Td (${esc(text)}) Tj 0 -30 Td /F1 12 Tf (If you can read this, printing from this computer works.) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offs = []
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
