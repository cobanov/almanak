/**
 * Fails the build if the bundle can reach the network from anywhere it should
 * not. Non-negotiable #1: this app makes no requests except to its own origin
 * for the demo archive, and to an endpoint the user explicitly configures.
 *
 * Scans source rather than the bundle, so the message can name a file and a
 * line rather than a minified offset.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Modules permitted to perform requests, and why. */
const ALLOWED = new Map<string, string>([
  ['src/archive/source.ts', 'reads the bundled demo archive from this origin'],
  ['src/semantic/client.ts', 'the opt-in endpoint the user types in Settings'],
])

const FORBIDDEN = [
  { pattern: /\bfetch\s*\(/, name: 'fetch()' },
  { pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
  { pattern: /\bnew\s+WebSocket\b/, name: 'WebSocket' },
  { pattern: /\bnew\s+EventSource\b/, name: 'EventSource' },
  { pattern: /\bnavigator\s*\.\s*sendBeacon\b/, name: 'sendBeacon' },
  { pattern: /\bimportScripts\s*\(/, name: 'importScripts' },
]

/** Remote hosts hard-coded anywhere are a failure regardless of the module. */
const REMOTE_URL = /https?:\/\/(?!x\.com|twitter\.com|localhost|127\.0\.0\.1)[a-z0-9.-]+\.[a-z]{2,}/i

/** Links out to x.com are content, not requests. */
const LINK_ONLY = /^\s*(\/\/|\*|<a|href=)/

interface Finding { file: string; line: number; what: string; text: string }

/**
 * Shipped source only.
 *
 * Test files carry archive URLs as fixture data — a t.co link inside a fake
 * tweet record is not a request, and none of it reaches the bundle. Scanning
 * them turned honest test data into build failures.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const findings: Finding[] = []
const root = process.cwd()

for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const allowed = ALLOWED.has(rel)
  const lines = readFileSync(file, 'utf8').split('\n')

  lines.forEach((text, i) => {
    if (LINK_ONLY.test(text)) return
    if (!allowed) {
      for (const { pattern, name } of FORBIDDEN) {
        if (pattern.test(text)) findings.push({ file: rel, line: i + 1, what: name, text: text.trim() })
      }
    }
    const url = text.match(REMOTE_URL)
    // A URL inside a string literal that is not a comment is a real request target.
    if (url && !text.trimStart().startsWith('*') && !text.trimStart().startsWith('//')) {
      findings.push({ file: rel, line: i + 1, what: `remote host ${url[0]}`, text: text.trim() })
    }
  })
}

if (findings.length > 0) {
  console.error('\nNetwork check failed. This app must make no requests.\n')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.what}`)
    console.error(`    ${f.text.slice(0, 100)}`)
  }
  console.error(`\nIf a module legitimately needs this, add it to ALLOWED in`)
  console.error(`scripts/check-network.ts with a reason. Do not delete the check.\n`)
  process.exit(1)
}

console.log(`network check passed — ${ALLOWED.size} module(s) allowed, no stray requests`)
