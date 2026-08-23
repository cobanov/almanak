/**
 * Parsing runs here so the main thread never blocks.
 *
 * The source cannot cross the worker boundary as an object, so the worker is
 * given the primitives it needs — a directory handle, a File, or a base URL —
 * and constructs its own source on this side.
 */

import * as Comlink from 'comlink'
import { parseArchive, type Progress } from '../archive/parse.ts'
import { DirectorySource, ZipSource, BundledSource } from '../archive/source.ts'
import type { ParsedArchive } from '../archive/types.ts'

export type SourceSpec =
  | { kind: 'directory'; handle: FileSystemDirectoryHandle; label: string }
  | { kind: 'zip'; file: File }
  | { kind: 'bundled'; base: string }

const api = {
  async parse(spec: SourceSpec, onProgress: (p: Progress) => void): Promise<ParsedArchive> {
    const source =
      spec.kind === 'directory' ? new DirectorySource(spec.handle, spec.label)
      : spec.kind === 'zip' ? await ZipSource.open(spec.file)
      : new BundledSource(spec.base)

    // Progress is throttled: at 10k tweets an unthrottled callback would post
    // more messages than the main thread can paint.
    let last = 0
    return parseArchive(source, (p) => {
      const now = performance.now()
      if (p.phase === 'done' || now - last > 80) {
        last = now
        onProgress(p)
      }
    })
  },
}

export type ParseApi = typeof api
Comlink.expose(api)
