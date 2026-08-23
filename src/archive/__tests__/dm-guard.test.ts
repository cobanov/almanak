/**
 * The direct-message boundary.
 *
 * This is the app's central privacy promise, and it is a property of code
 * rather than of the filesystem: DM data sits in the same folder tree the app
 * takes a directory handle on. These tests are what turn the promise into
 * something that stays true after a refactor.
 */

import { describe, it, expect } from 'vitest'
import {
  isDirectMessagePath, assertReadableDataFile, assertReadableMediaPath,
  ForbiddenPathError, ALLOWED_DATA_FILES, ALLOWED_MEDIA_DIRS,
} from '../dm-guard.ts'

/** Every DM-bearing name X has shipped, plus casing X has not. */
const DM_PATHS = [
  'data/direct-messages.js',
  'data/direct-messages-group.js',
  'data/direct-message-headers.js',
  'data/direct-message-group-headers.js',
  'data/direct_messages_media/1-2.jpg',
  'data/direct_messages_group_media/1-2.jpg',
  'data/DIRECT-MESSAGES.js',
  'data/Direct_Messages_Media/x.png',
]

describe('isDirectMessagePath', () => {
  it('recognises every direct-message name, in any casing', () => {
    for (const p of DM_PATHS) expect(isDirectMessagePath(p)).toBe(true)
  })

  it('does not fire on ordinary tweet data', () => {
    for (const p of ['data/tweets.js', 'data/tweets_media/1-2.jpg', 'data/manifest.js']) {
      expect(isDirectMessagePath(p)).toBe(false)
    }
  })
})

describe('assertReadableDataFile', () => {
  it('refuses every direct-message file', () => {
    for (const p of DM_PATHS.filter((p) => p.endsWith('.js'))) {
      expect(() => assertReadableDataFile(p)).toThrow(ForbiddenPathError)
    }
  })

  it('refuses anything not on the allowlist, even if it is not a DM file', () => {
    // The allowlist is the primary control; the DM substring check is a backstop.
    // A file X invents tomorrow is refused because nobody allowed it, not
    // because it happened to be named after messages.
    for (const p of ['data/some-new-thing.js', 'data/passwords.js', 'data/../secrets.js']) {
      expect(() => assertReadableDataFile(p)).toThrow(ForbiddenPathError)
    }
  })

  it('permits each file on the allowlist', () => {
    for (const name of ALLOWED_DATA_FILES) {
      expect(() => assertReadableDataFile(`data/${name}`)).not.toThrow()
    }
  })
})

describe('assertReadableMediaPath', () => {
  it('refuses direct-message media', () => {
    for (const p of DM_PATHS.filter((p) => !p.endsWith('.js'))) {
      expect(() => assertReadableMediaPath(p)).toThrow(ForbiddenPathError)
    }
  })

  it('permits the media directories the app is meant to read', () => {
    for (const dir of ALLOWED_MEDIA_DIRS) {
      expect(() => assertReadableMediaPath(`data/${dir}/1-2.jpg`)).not.toThrow()
    }
  })

  it('refuses a media path outside those directories', () => {
    expect(() => assertReadableMediaPath('data/somewhere_else/1.jpg')).toThrow(ForbiddenPathError)
  })
})

describe('the guard as a whole', () => {
  it('names direct messages in its error, so a failure explains itself', () => {
    try {
      assertReadableDataFile('data/direct-messages.js')
      throw new Error('should have thrown')
    } catch (e) {
      expect((e as Error).message).toMatch(/direct-message/i)
      expect((e as Error).message).toMatch(/never parses/i)
    }
  })

  it('keeps direct messages off both allowlists', () => {
    for (const name of ALLOWED_DATA_FILES) expect(isDirectMessagePath(name)).toBe(false)
    for (const dir of ALLOWED_MEDIA_DIRS) expect(isDirectMessagePath(dir)).toBe(false)
  })
})
