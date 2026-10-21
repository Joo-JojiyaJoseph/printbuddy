// Taprint Print Agent: runs on the shop's Windows PC. Collects paid print jobs from the Taprint website
// and prints them with this PC's own SumatraPDF and printer. Needs Node.js 18 or newer. No other packages.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkConfig, safePrinterName, sumatraArgs, testPdf } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loadConfig() {
  let raw
  try { raw = JSON.parse(await readFile(join(here, 'config.json'), 'utf8')) } catch (e) {
    console.error('Could not read config.json next to agent.mjs. Copy config.example.json to config.json and fill it in.\n', e.message)
    process.exit(1)
  }
  const { config, problems } = checkConfig(raw)
  if (problems.length) { console.error('Please fix config.json:\n - ' + problems.join('\n - ')); process.exit(1) }
  if (config.printerName && !safePrinterName(config.printerName)) { console.error('"printerName" has characters that are not allowed.'); process.exit(1) }
  return config
}

function runSumatra(config, args) {
  return new Promise((resolve) => {
    execFile(config.sumatraPath, args, { timeout: 90_000, windowsHide: true }, (err) => resolve(err ? { ok: false, code: err.code, killed: err.killed } : { ok: true }))
  })
}

async function api(config, path, init = {}) {
  const res = await fetch(`${config.server}/api/v1/agent${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.key}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(30_000),
  })
  return res
}

async function printOne(config, job) {
  const dir = await mkdtemp(join(tmpdir(), 'taprint-'))
  const file = join(dir, 'job.pdf')
  let outcome = { ok: false, message: 'Something went wrong on the shop computer.' }
  try {
    const res = await api(config, `/jobs/${job.id}/file`)
    if (!res.ok) throw new Error(`download failed (${res.status})`)
    await writeFile(file, Buffer.from(await res.arrayBuffer()))
    const printer = config.printerName // each shop PC chooses its own printer
    const r = await runSumatra(config, sumatraArgs(job, file, printer))
    outcome = r.ok ? { ok: true } : { ok: false, message: r.killed ? 'The printer took too long to answer.' : 'The printer did not accept the job. Check it is on, has paper, and the name is right.' }
  } catch (e) {
    outcome = { ok: false, message: 'Could not get the file from the website.' }
    log('error:', e.message)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
  // The result must reach the server, or the job would sit in "printing" until it times out.
  for (let i = 0; i < 5; i++) {
    try {
      const res = await api(config, `/jobs/${job.id}/result`, { method: 'POST', body: JSON.stringify(outcome) })
      if (res.ok || res.status === 409) break
    } catch { /* retry */ }
    await sleep(2000)
  }
  log(outcome.ok ? `printed ${job.reference} (${job.pages} page(s), ${job.copies} copy)` : `FAILED ${job.reference}: ${outcome.message}`)
}

async function testPrint(config) {
  const dir = await mkdtemp(join(tmpdir(), 'taprint-'))
  const file = join(dir, 'test.pdf')
  await writeFile(file, testPdf())
  const r = await runSumatra(config, sumatraArgs({ copies: 1, paper: 'A4' }, file, config.printerName))
  setTimeout(() => rm(dir, { recursive: true, force: true }).catch(() => {}), 20_000)
  console.log(r.ok ? 'Test page sent to the printer. Check the tray.' : 'The printer did not accept the test page. Check the printer name in config.json and that SumatraPDF can print.')
  process.exit(r.ok ? 0 : 1)
}

async function main() {
  const config = await loadConfig()
  if (process.argv.includes('--test')) return testPrint(config)
  log(`Taprint Print Agent started. Server: ${config.server}. SumatraPDF: ${config.sumatraPath}. Printer: ${config.printerName || 'Windows default printer'}.`)
  let warned = ''
  for (;;) {
    try {
      const res = await api(config, '/jobs/next', { method: 'POST' })
      if (res.status === 401) { if (warned !== '401') log('The key was rejected. Make a new key in the admin panel and paste it into config.json.'); warned = '401'; await sleep(10_000); continue }
      warned = ''
      if (res.status === 200) { const { data } = await res.json(); await printOne(config, data); continue }
      if (res.status !== 204) log(`server answered ${res.status}`)
    } catch (e) {
      if (warned !== 'net') log('Cannot reach the website. Retrying…', e.cause?.code || e.message)
      warned = 'net'
      await sleep(8000)
      continue
    }
    await sleep(config.pollSeconds * 1000)
  }
}

main()
