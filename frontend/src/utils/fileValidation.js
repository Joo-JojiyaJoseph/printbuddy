import { readBytes } from './readBytes'

// Client-side pre-check for fast feedback only. The backend re-validates content, size and count.
export const LIMITS = { maxFiles: 10, maxBytes: 25 * 1024 * 1024 }
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'

const EXT_KIND = {
  pdf: 'pdf', jpg: 'jpg', jpeg: 'jpg', png: 'png', txt: 'txt',
  doc: 'ole', xls: 'ole', ppt: 'ole', docx: 'ooxml', xlsx: 'ooxml', pptx: 'ooxml',
}
const startsWith = (b, sig) => sig.every((v, i) => b[i] === v)

/** Detect the real type from content, never from filename or browser MIME type. */
export async function sniffKind(file) {
  const b = new Uint8Array(await readBytes(file.slice(0, 4096)))
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf'
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpg'
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole'
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return 'ooxml'
  if (b.length && !b.includes(0)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(b); return 'txt' } catch { /* not text */ }
  }
  return null
}

/** @returns {Promise<{ok:true,kind:string}|{ok:false,error:string}>} */
export async function validateFile(file, currentCount = 0) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!(ext in EXT_KIND)) return { ok: false, error: `"${file.name}": .${ext || '?'} files are not supported.` }
  if (currentCount >= LIMITS.maxFiles) return { ok: false, error: `You can add up to ${LIMITS.maxFiles} files per session.` }
  if (file.size === 0) return { ok: false, error: `"${file.name}" is empty.` }
  if (file.size > LIMITS.maxBytes) return { ok: false, error: `"${file.name}" is larger than ${LIMITS.maxBytes / 1024 / 1024} MB.` }
  const kind = await sniffKind(file)
  if (kind !== EXT_KIND[ext]) return { ok: false, error: `"${file.name}" doesn't look like a valid ${ext.toUpperCase()} file.` }
  return { ok: true, kind }
}
