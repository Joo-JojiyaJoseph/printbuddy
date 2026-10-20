const OLD = { doc: 'docx', xls: 'xlsx', ppt: 'pptx' }
const NEW = ['docx', 'xlsx', 'pptx']
export const extOf = (name) => name.split('.').pop()?.toLowerCase() ?? ''

/** What to tell the customer when a file cannot be prepared in the browser, or null when it can. */
export function conversionBlocker(file, kind) {
  const ext = extOf(file.name)
  if (kind === 'ole' && OLD[ext]) return `"${file.name}" is an old .${ext} file. In ${ext === 'doc' ? 'Word' : ext === 'xls' ? 'Excel' : 'PowerPoint'} choose File → Save As → .${OLD[ext]} (or PDF) and upload that.`
  if ((kind === 'ooxml' && !NEW.includes(ext)) || kind === 'ole') return `"${file.name}" isn't a Word, Excel or PowerPoint file we can read.`
  return null
}

/** Does this file need turning into a PDF in the browser before it is sent? */
export const needsConversion = (kind) => kind === 'ooxml' || kind === 'ole'
