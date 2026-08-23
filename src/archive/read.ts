/**
 * Low-level reading of X export data files.
 *
 * Files in an export are JavaScript assignments, not JSON:
 *
 *     window.YTD.tweets.part0 = [ { "tweet": { ... } }, ... ]
 *
 * The value after `=` is valid JSON. We locate the assignment by scanning
 * bytes for the first `=` rather than running a regular expression over the
 * whole file: these files reach hundreds of megabytes in large archives, and
 * a whole-file regex would copy and scan all of it to find a byte at offset
 * ~30.
 *
 * Nothing here knows what a tweet is. Shape-specific logic lives in the
 * normalizers.
 */

const EQUALS = 0x3d

/** Bytes to probe when looking for the assignment. Real prefixes are ~30. */
export const HEAD_PROBE_BYTES = 512

export class ArchiveFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArchiveFormatError'
  }
}

/**
 * Byte offset of the first character of the JSON value, found by scanning
 * `head` for the first `=`. Pass only the first HEAD_PROBE_BYTES of a file.
 */
export function findValueOffset(head: Uint8Array): number {
  const limit = Math.min(head.length, HEAD_PROBE_BYTES)
  for (let i = 0; i < limit; i++) {
    if (head[i] === EQUALS) return i + 1
  }
  throw new ArchiveFormatError(
    `No "=" in the first ${limit} bytes. This is not an X export data file.`,
  )
}

/**
 * The assigned global name, e.g. "window.YTD.tweets.part0".
 * Used to confirm a file holds what its filename claims.
 */
export function readGlobalName(head: Uint8Array): string {
  const offset = findValueOffset(head)
  return new TextDecoder().decode(head.subarray(0, offset - 1)).trim()
}

/** Parse a complete data file's bytes into its JSON value. */
export function parseArchiveFile<T = unknown>(bytes: Uint8Array): T {
  const offset = findValueOffset(bytes.subarray(0, HEAD_PROBE_BYTES))
  const json = new TextDecoder().decode(bytes.subarray(offset))
  try {
    return JSON.parse(json) as T
  } catch (cause) {
    throw new ArchiveFormatError(
      `Value after "=" is not valid JSON: ${(cause as Error).message}`,
    )
  }
}

/**
 * The manifest is the one file that is not a YTD assignment. It sets
 * `window.__THAR_CONFIG` and describes which data types the export contains.
 */
export interface ArchiveManifest {
  userInfo: { accountId: string; userName: string; displayName: string }
  archiveInfo: {
    sizeBytes: string
    generationDate: string
    isPartialArchive: boolean
    maxPartSizeBytes: string
  }
  dataTypes: Record<
    string,
    {
      mediaDirectory?: string
      files?: { fileName: string; globalName: string; count: string }[]
    }
  >
}

export function parseManifest(bytes: Uint8Array): ArchiveManifest {
  return parseArchiveFile<ArchiveManifest>(bytes)
}
