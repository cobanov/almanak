/**
 * Copy the built site somewhere launchd can actually read it.
 *
 * macOS protects ~/Documents: a process started by launchd cannot read it
 * without Full Disk Access, which is a manual grant in System Settings and not
 * something a project should ask for. So the long-running server reads from
 * ~/Library/Application Support instead, and this syncs the build there.
 *
 *   npm run publish:local
 */

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const dist = join(process.cwd(), 'dist')
const target = join(homedir(), 'Library', 'Application Support', 'almanak', 'site')

if (!existsSync(dist)) {
  console.error('No dist/. Run `npm run build` first.')
  process.exit(1)
}

if (existsSync(target)) rmSync(target, { recursive: true })
mkdirSync(target, { recursive: true })
cpSync(dist, target, { recursive: true })
console.log(`published -> ${target}`)
