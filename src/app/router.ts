/**
 * A router in eighty lines, because every view has to be URL-addressable and
 * nothing heavier earns its place.
 *
 * State lives in the query string, not in React: filters, search text, the
 * timeline position and the open lightbox item all round-trip through the URL,
 * so the back button works and a link is shareable.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Route = 'import' | 'timeline' | 'tweets' | 'threads' | 'gallery' | 'analysis' | 'settings'

export const ROUTES: Route[] = ['timeline', 'tweets', 'threads', 'gallery', 'analysis', 'settings']

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function subscribe(fn: () => void) {
  listeners.add(fn)
  window.addEventListener('popstate', notify)
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) window.removeEventListener('popstate', notify)
  }
}

const snapshot = () => window.location.hash || '#/import'

/** Hash routing, so the app works from file:// and any static host. */
export function useLocation() {
  const hash = useSyncExternalStore(subscribe, snapshot, snapshot)
  const [pathPart, queryPart = ''] = hash.replace(/^#\/?/, '').split('?')
  const route = (ROUTES.includes(pathPart as Route) ? pathPart : 'import') as Route
  return { route, params: new URLSearchParams(queryPart) }
}

function write(route: Route, params: URLSearchParams, replace: boolean) {
  // Drop empty values so a shared URL carries only what was actually set.
  for (const [k, v] of [...params]) if (v === '' || v === 'null') params.delete(k)
  const q = params.toString()
  const next = `#/${route}${q ? `?${q}` : ''}`
  if (next === window.location.hash) return
  if (replace) history.replaceState(null, '', next)
  else history.pushState(null, '', next)
  notify()
}

export function useNavigate() {
  return useCallback((route: Route, params?: URLSearchParams, replace = false) => {
    write(route, params ?? new URLSearchParams(), replace)
  }, [])
}

/**
 * Read and write one URL parameter. Writing replaces rather than pushes by
 * default: typing in a search box should not fill the back stack with every
 * keystroke.
 */
export function useParam(key: string, fallback = '') {
  const { route, params } = useLocation()
  const value = params.get(key) ?? fallback
  const set = useCallback((next: string | null, push = false) => {
    const p = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    if (next === null || next === '') p.delete(key)
    else p.set(key, next)
    write(route, p, !push)
  }, [key, route])
  return [value, set] as const
}

/** Push a route change on Escape, for closing overlays. */
export function useEscape(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handler() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler, active])
}
