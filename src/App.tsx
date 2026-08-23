import { useEffect } from 'react'
import { AppProvider, useApp } from './app/state.tsx'
import { useLocation, useNavigate, ROUTES, type Route } from './app/router.ts'
import { Import } from './routes/Import.tsx'
import { Timeline } from './routes/Timeline.tsx'
import { Tweets } from './routes/Tweets.tsx'
import { Threads } from './routes/Threads.tsx'
import { Gallery } from './routes/Gallery.tsx'
import { Analysis } from './routes/Analysis.tsx'
import { Settings } from './routes/Settings.tsx'
import { Num } from './ui/primitives.tsx'
import { Shortcuts } from './ui/Shortcuts.tsx'
import { takeHandoff } from './app/handoff.ts'
import { DemoBanner } from './ui/DemoBanner.tsx'

const LABELS: Record<Route, string> = {
  import: 'Import', timeline: 'Timeline', tweets: 'Tweets', threads: 'Threads',
  gallery: 'Gallery', analysis: 'Analysis', settings: 'Settings',
}

function Chrome() {
  const { archive, openDemo, openDirectory, openZip, progress } = useApp()
  const { route } = useLocation()
  const navigate = useNavigate()

  /**
   * An archive dropped on the landing page is waiting in IndexedDB.
   *
   * Taken once and deleted, so a reload lands on the import screen rather than
   * re-opening something the reader has finished with.
   */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('handoff')) return
    if (archive || progress) return
    let cancelled = false
    void takeHandoff().then((pending) => {
      if (cancelled || !pending) return
      if (pending.kind === 'directory') void openDirectory(pending.handle, pending.label)
      else void openZip(pending.file)
    })
    return () => { cancelled = true }
  }, [archive, progress, openDirectory, openZip])

  /**
   * `?demo=1` opens the bundled archive without a click.
   *
   * Two things need this: the landing page embeds the app and cannot click
   * its own iframe, and a link to the demo should land on the demo rather
   * than on a screen asking you to press a button.
   */
  useEffect(() => {
    const wants = new URLSearchParams(window.location.search).get('demo') === '1'
    if (wants && !archive && !progress) void openDemo()
  }, [archive, progress, openDemo])

  // Embedded in the landing page, the demo notice is redundant: the page it
  // sits in has already said what this is. The navigation stays, because the
  // point of the embed is that people can click around it.
  const embedded = new URLSearchParams(window.location.search).get('embed') === '1'

  // A stored theme choice applies before first paint of the shell.
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored)
    }
  }, [])

  // Keyboard: g then a letter jumps between views, the way a reader would.
  useEffect(() => {
    let armed = false
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return
      if (e.key === 'g') { armed = true; return }
      if (!armed) return
      armed = false
      const jump: Record<string, Route> = {
        t: 'timeline', s: 'tweets', h: 'threads', l: 'gallery', a: 'analysis', c: 'settings',
      }
      if (jump[e.key]) navigate(jump[e.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const VIEWS: Partial<Record<Route, () => React.JSX.Element>> = {
    timeline: Timeline, tweets: Tweets, threads: Threads,
    gallery: Gallery, analysis: Analysis, settings: Settings,
  }
  const View = VIEWS[route] ?? Timeline

  if (!archive || route === 'import') return <Import />

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-1 px-3 h-11 border-b border-[var(--edge)] bg-[var(--surface)] shrink-0">
        <button onClick={() => navigate('import')} className="display text-sm mr-3 hover:text-[var(--accent)]">
          almanak
        </button>
        <nav className="flex gap-0.5 overflow-x-auto">
          {ROUTES.filter((r) => r !== 'settings').map((r) => (
            <button
              key={r}
              onClick={() => navigate(r)}
              aria-current={route === r ? 'page' : undefined}
              className={`px-2.5 py-1 text-sm rounded-sm transition-colors whitespace-nowrap ${
                route === r ? 'text-[var(--accent)] bg-[var(--surface-lit)]'
                            : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {LABELS[r]}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--text-dim)]">
          <span className="hidden sm:inline">
            @{archive.store.meta.handle} · <Num value={archive.store.meta.tweetCount} />
          </span>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
            aria-label="Keyboard shortcuts"
            className="hover:text-[var(--text)]"
          >?</button>
          <button
            onClick={() => navigate('settings')}
            aria-current={route === 'settings' ? 'page' : undefined}
            className={route === 'settings' ? 'text-[var(--accent)]' : 'hover:text-[var(--text)]'}
          >
            Settings
          </button>
        </div>
      </header>
      <DemoBanner isDemo={archive.source.kind === 'bundled' && !embedded} />
      <main className="flex-1 min-h-0"><View /></main>
      <Shortcuts />
    </div>
  )
}

export default function App() {
  return <AppProvider><Chrome /></AppProvider>
}
