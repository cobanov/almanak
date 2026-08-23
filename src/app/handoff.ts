/**
 * Passing a dropped archive from the landing page to the app.
 *
 * The landing page is at `/` and the app at `/app/`, so a drop on the landing
 * page has to survive a navigation. A File cannot be put in a URL, but both
 * File and FileSystemDirectoryHandle are structured-cloneable, so IndexedDB
 * carries them across — and the two pages share an origin, so they share the
 * database.
 *
 * A separate database from the app's own keeps the app's schema and version
 * out of the landing page's plain-HTML hands.
 */

const DB = 'almanak-handoff'
const STORE = 'pending'
const KEY = 'archive'

export type Handoff =
  | { kind: 'directory'; handle: FileSystemDirectoryHandle; label: string }
  | { kind: 'zip'; file: File }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Read the pending archive and remove it in the same breath.
 *
 * Taking it exactly once matters: a reload should land on the import screen,
 * not re-open an archive the reader has moved on from.
 */
export async function takeHandoff(): Promise<Handoff | null> {
  let db: IDBDatabase
  try {
    db = await open()
  } catch {
    return null // private mode, or storage blocked; the drop simply did not carry
  }

  try {
    const value = await new Promise<Handoff | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result as Handoff | undefined)
      req.onerror = () => reject(req.error)
    })

    if (value) {
      await new Promise<void>((resolve) => {
        const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY)
        req.onsuccess = req.onerror = () => resolve()
      })
    }
    return value ?? null
  } catch {
    return null
  } finally {
    db.close()
  }
}
