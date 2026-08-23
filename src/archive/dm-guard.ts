/**
 * The direct-message boundary, as an enforced invariant.
 *
 * An X export puts DM text and DM media inside the same folder tree the app
 * takes a FileSystemDirectoryHandle on. "We don't read DMs" is therefore a
 * property of our code, not of the filesystem. This module is the single
 * place that property is decided, so it can be tested rather than promised.
 *
 * Every archive path — for parsing or for media — passes through here.
 */

/** Data files the app is allowed to open. Anything absent is refused. */
export const ALLOWED_DATA_FILES = [
  'manifest.js',
  'tweets.js',
  'tweet.js', // pre-2020 archives name it this way
  'tweet-headers.js',
  'deleted-tweets.js',
  'deleted-tweet-headers.js',
  'note-tweet.js',
  'account.js',
  'profile.js',
  'like.js',
  'follower.js',
  'following.js',
  'community-tweet.js',
  'moment.js',
  'ad-engagements.js',
] as const

/** Media directories the app is allowed to read from. */
export const ALLOWED_MEDIA_DIRS = ['tweets_media', 'deleted_tweets_media'] as const

/**
 * Substrings that must never appear in any path the app opens, whatever
 * else the allowlists say. This is the backstop: if a future refactor
 * widens an allowlist by mistake, this still holds.
 */
const FORBIDDEN = ['direct_message', 'direct-message']

export class ForbiddenPathError extends Error {
  constructor(path: string) {
    super(
      `Refused to open "${path}": it is direct-message data. ` +
        `almanak never parses, indexes, or displays DMs.`,
    )
    this.name = 'ForbiddenPathError'
  }
}

/** True when a path is direct-message data under any naming X has used. */
export function isDirectMessagePath(path: string): boolean {
  const p = path.toLowerCase()
  return FORBIDDEN.some((f) => p.includes(f))
}

/** Throws unless `path` is a data file the app is permitted to open. */
export function assertReadableDataFile(path: string): void {
  if (isDirectMessagePath(path)) throw new ForbiddenPathError(path)
  const name = path.split('/').pop() ?? ''
  if (!(ALLOWED_DATA_FILES as readonly string[]).includes(name)) {
    throw new ForbiddenPathError(path)
  }
}

/** Throws unless `path` sits inside a media directory the app may read. */
export function assertReadableMediaPath(path: string): void {
  if (isDirectMessagePath(path)) throw new ForbiddenPathError(path)
  const segments = path.split('/')
  const dir = segments[segments.length - 2]
  if (!(ALLOWED_MEDIA_DIRS as readonly string[]).includes(dir ?? '')) {
    throw new ForbiddenPathError(path)
  }
}
