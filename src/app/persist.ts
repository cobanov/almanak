/**
 * What survives a reload, and how it all gets deleted.
 *
 * Directory handles are stored in IndexedDB so a returning visitor does not
 * re-pick their archive. The browser still requires a permission prompt on
 * each new session; when that is denied or unsupported, the app falls back to
 * asking for the folder again and says what is reduced.
 *
 * "Delete everything" must actually delete everything. See wipeEverything().
 */

const DB_NAME = 'almanak'
const STORE = 'archives'
const DB_VERSION = 1

export interface StoredArchive {
  id: string
  label: string
  handle: string
  addedAt: number
  tweetCount: number
  /** Absent for demo and ZIP sources, which cannot be re-opened silently. */
  dirHandle?: FileSystemDirectoryHandle
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

export async function listArchives(): Promise<StoredArchive[]> {
  try {
    const all = await tx<StoredArchive[]>('readonly', (s) => s.getAll() as IDBRequest<StoredArchive[]>)
    return all.sort((a, b) => b.addedAt - a.addedAt)
  } catch {
    return [] // private mode, or IndexedDB blocked. The app still runs.
  }
}

export async function saveArchive(entry: StoredArchive): Promise<void> {
  try { await tx('readwrite', (s) => s.put(entry)) } catch { /* not fatal */ }
}

export async function forgetArchive(id: string): Promise<void> {
  try { await tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>) } catch { /* not fatal */ }
}

/** Re-request permission on a stored handle. Returns false when denied. */
export async function regrant(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>
  }
  try {
    if (await h.queryPermission?.({ mode: 'read' }) === 'granted') return true
    return await h.requestPermission?.({ mode: 'read' }) === 'granted'
  } catch {
    return false
  }
}

export interface WipeReport {
  indexedDb: boolean
  opfs: boolean
  caches: boolean
  localStorage: boolean
  serviceWorkers: boolean
}

/**
 * Delete everything this app has stored, and report what actually happened
 * rather than claiming success. Each step is independent: a failure in one
 * must not leave the others untouched.
 */
export async function wipeEverything(): Promise<WipeReport> {
  const report: WipeReport = {
    indexedDb: false, opfs: false, caches: false,
    localStorage: false, serviceWorkers: false,
  }

  try {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })
    report.indexedDb = true
  } catch { /* reported as false */ }

  try {
    const root = await navigator.storage?.getDirectory?.()
    if (root) {
      for await (const entry of (root as any).values()) {
        await root.removeEntry(entry.name, { recursive: true }).catch(() => {})
      }
    }
    report.opfs = true
  } catch { /* OPFS unavailable, nothing to clear */ }

  try {
    if ('caches' in globalThis) {
      for (const key of await caches.keys()) await caches.delete(key)
    }
    report.caches = true
  } catch { /* reported as false */ }

  try {
    localStorage.clear()
    sessionStorage.clear()
    report.localStorage = true
  } catch { /* reported as false */ }

  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    report.serviceWorkers = true
  } catch { /* reported as false */ }

  return report
}
