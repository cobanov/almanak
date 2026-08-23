/**
 * The whole parse: source in, ParsedArchive out, progress reported as it goes.
 *
 * This is the only function that knows the order things happen in. Everything
 * it calls is independently testable.
 */

import { parseArchiveFile, parseManifest, type ArchiveManifest } from './read.ts'
import { normalizeTweets } from './normalize.ts'
import { buildThreads } from './threads.ts'
import type { ArchiveSource } from './source.ts'
import type { ParsedArchive, Tweet } from './types.ts'

export interface Progress {
  phase: 'reading' | 'parsing' | 'normalizing' | 'threading' | 'indexing' | 'done'
  message: string
  tweets: number
  media: number
  /** 0..1, or null when the total is not yet known. */
  fraction: number | null
}

export type ProgressFn = (p: Progress) => void

/** Files older archives shipped that current ones do not. */
const HISTORICAL_FILES = [
  'account.js', 'profile.js', 'like.js', 'follower.js', 'following.js',
  'note-tweet.js', 'community-tweet.js', 'moment.js',
]

const decoder = new TextDecoder()

export async function parseArchive(
  source: ArchiveSource,
  onProgress: ProgressFn = () => {},
): Promise<ParsedArchive> {
  const report = (p: Partial<Progress> & { message: string }) =>
    onProgress({ phase: 'parsing', tweets: 0, media: 0, fraction: null, ...p })

  report({ phase: 'reading', message: 'Reading the archive' })
  const present = new Set(await source.list())

  if (!present.has('manifest.js')) {
    throw new ArchiveError(
      'This folder has no data/manifest.js.',
      'Pick the folder that contains "Your archive.html", or drop the ZIP as it came from X.',
    )
  }

  const manifest: ArchiveManifest = parseManifest(await source.readData('manifest.js'))
  const accountId = manifest.userInfo.accountId

  // Which tweets file: current archives use tweets.js, older ones tweet.js.
  const tweetsFile = present.has('tweets.js') ? 'tweets.js'
    : present.has('tweet.js') ? 'tweet.js' : null
  if (!tweetsFile) {
    throw new ArchiveError(
      'This archive contains no tweets file.',
      'X names it data/tweets.js. If your export is still downloading, wait for it to finish.',
    )
  }

  const unverified = new Set<string>()
  if (tweetsFile === 'tweet.js') unverified.add('pre-2020 archive layout')

  // --- media index ----------------------------------------------------------
  report({ phase: 'indexing', message: 'Indexing media' })
  const mediaFiles = await source.listMedia()
  const filesById = new Map<string, string[]>()
  for (const name of mediaFiles) {
    const dash = name.indexOf('-')
    if (dash <= 0) continue
    const id = name.slice(0, dash)
    const list = filesById.get(id)
    if (list) list.push(name)
    else filesById.set(id, [name])
  }
  report({ phase: 'indexing', message: 'Indexing media', media: mediaFiles.length })

  // --- note tweets ----------------------------------------------------------
  // Absent from every archive surveyed so far. The path is written defensively
  // and reports itself as unverified when it fires.
  let noteTexts: Map<string, string> | undefined
  if (present.has('note-tweet.js')) {
    unverified.add('note-tweet stitching')
    noteTexts = new Map()
    try {
      const notes = parseArchiveFile<any[]>(await source.readData('note-tweet.js'))
      for (const n of notes) {
        const note = n.noteTweet ?? n
        const id = note.noteTweetId ?? note.tweetId
        const text = note.core?.text ?? note.text
        if (id && text) noteTexts.set(String(id), String(text))
      }
    } catch {
      unverified.add('note-tweet.js could not be read')
    }
  }

  // --- tweets ---------------------------------------------------------------
  report({ phase: 'parsing', message: 'Parsing tweets', media: mediaFiles.length })
  const bytes = await source.readData(tweetsFile)
  const raw = parseArchiveFile<any[]>(bytes)

  report({
    phase: 'normalizing', message: 'Normalizing', tweets: raw.length,
    media: mediaFiles.length, fraction: 0.5,
  })
  const { tweets, unverified: normUnverified } = normalizeTweets(raw, {
    accountId, filesById, noteTexts,
  })
  for (const u of normUnverified) unverified.add(u)

  // --- deleted tweets -------------------------------------------------------
  let all: Tweet[] = tweets
  if (present.has('deleted-tweets.js')) {
    try {
      const deletedRaw = parseArchiveFile<any[]>(await source.readData('deleted-tweets.js'))
      const { tweets: deleted } = normalizeTweets(deletedRaw, {
        accountId, filesById, deleted: true,
      })
      const known = new Set(all.map((t) => t.id))
      all = [...all, ...deleted.filter((t) => !known.has(t.id))]
      all.sort((a, b) => a.at - b.at)
    } catch {
      unverified.add('deleted-tweets.js could not be read')
    }
  }

  // --- threads --------------------------------------------------------------
  report({
    phase: 'threading', message: 'Reconstructing threads',
    tweets: all.length, media: mediaFiles.length, fraction: 0.85,
  })
  const threads = buildThreads(all)

  // Scanned rather than spread: Math.min(...times) with 200,000 arguments
  // exceeds the call stack, so an archive that size crashed here.
  let firstAt = Infinity, lastAt = -Infinity
  for (const t of all) {
    if (!Number.isFinite(t.at)) continue
    if (t.at < firstAt) firstAt = t.at
    if (t.at > lastAt) lastAt = t.at
  }
  const hasTimes = firstAt !== Infinity
  const parsed: ParsedArchive = {
    meta: {
      id: `${manifest.userInfo.userName}-${manifest.archiveInfo.generationDate}`,
      handle: manifest.userInfo.userName,
      displayName: manifest.userInfo.displayName,
      accountId,
      generatedAt: manifest.archiveInfo.generationDate,
      tweetCount: all.length,
      mediaCount: mediaFiles.length,
      firstAt: hasTimes ? firstAt : 0,
      lastAt: hasTimes ? lastAt : 0,
      absentFiles: HISTORICAL_FILES.filter((f) => !present.has(f)),
      hadDirectMessages: Object.keys(manifest.dataTypes).some((k) => /direct/i.test(k)),
      unverifiedPaths: [...unverified],
    },
    tweets: all,
    threads,
  }

  report({
    phase: 'done', message: 'Ready', tweets: all.length,
    media: mediaFiles.length, fraction: 1,
  })
  return parsed
}

/** An error with a next step, not just a cause. */
export class ArchiveError extends Error {
  readonly nextStep: string
  constructor(message: string, nextStep: string) {
    super(message)
    this.name = 'ArchiveError'
    this.nextStep = nextStep
  }
}

export { decoder }
