/**
 * Lazy media loading with a bounded object-URL cache.
 *
 * A real archive's media folder reaches tens of gigabytes, so nothing is
 * bulk-loaded: files are read one at a time from the archive source and the
 * resulting object URLs are kept in an LRU that revokes on eviction. Without
 * the revoke, scrolling a gallery leaks every image it has ever shown.
 */

import type { ArchiveSource } from '../archive/source.ts'

const MAX_ENTRIES = 300

export class MediaLoader {
  #source: ArchiveSource
  #cache = new Map<string, string>()          // file -> object URL, insertion-ordered
  #pending = new Map<string, Promise<string>>()
  #missing = new Set<string>()

  constructor(source: ArchiveSource) { this.#source = source }

  /** Object URL for a media file, or null when the archive lacks it. */
  async get(file: string): Promise<string | null> {
    if (!file || this.#missing.has(file)) return null

    const hit = this.#cache.get(file)
    if (hit) {
      // Refresh recency: delete and re-insert moves it to the end.
      this.#cache.delete(file)
      this.#cache.set(file, hit)
      return hit
    }

    const inFlight = this.#pending.get(file)
    if (inFlight) return inFlight

    const load = this.#source.readMedia(file)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        this.#cache.set(file, url)
        this.#evict()
        return url
      })
      .catch(() => {
        // A referenced file the archive does not contain. Remember it so the
        // gallery does not retry on every scroll.
        this.#missing.add(file)
        return null as unknown as string
      })
      .finally(() => this.#pending.delete(file))

    this.#pending.set(file, load)
    return load
  }

  #evict() {
    while (this.#cache.size > MAX_ENTRIES) {
      const oldest = this.#cache.keys().next().value as string | undefined
      if (oldest === undefined) break
      const url = this.#cache.get(oldest)!
      this.#cache.delete(oldest)
      URL.revokeObjectURL(url)
    }
  }

  /** Release everything. Called when switching or deleting an archive. */
  dispose() {
    for (const url of this.#cache.values()) URL.revokeObjectURL(url)
    this.#cache.clear()
    this.#pending.clear()
    this.#missing.clear()
  }
}
