/** Mirror of the backend PageRange parser, used for instant UX feedback only. */
export function parsePageRange(spec, pageCount) {
  if (!pageCount || pageCount < 1) throw new Error('Document has no pages.')
  const s = (spec ?? '').trim()
  if (!s) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set()
  for (const raw of s.split(',')) {
    const m = raw.trim().match(/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/)
    if (!m) throw new Error(`"${raw.trim()}" isn't a valid page or range.`)
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    if (from < 1 || to < from || to > pageCount) throw new Error(`Pages must be between 1 and ${pageCount}.`)
    for (let p = from; p <= to; p++) pages.add(p)
  }
  return [...pages].sort((a, b) => a - b)
}
