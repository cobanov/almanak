/**
 * Threads, as things to read.
 *
 * People write essays here without noticing — the reference archive holds 713
 * threads and its longest runs to 18 tweets. V1 listed them; this reads them:
 * a spine connecting the parts, reading time up front, and a copy action that
 * produces one document rather than N quotes.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useStore } from '../app/state.tsx'
import { useParam } from '../app/router.ts'
import { TweetView, statusUrl } from '../ui/TweetView.tsx'
import { Empty, Num } from '../ui/primitives.tsx'
import type { Thread } from '../archive/types.ts'

type Sort = 'longest' | 'newest' | 'liked'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'longest', label: 'Longest' },
  { key: 'newest', label: 'Newest' },
  { key: 'liked', label: 'Most liked' },
]

const MIN_LENGTHS = [2, 5, 10]

export function Threads() {
  const store = useStore()
  const [open, setOpen] = useParam('thread')
  const [sortParam, setSort] = useParam('sort', 'longest')
  const [minParam, setMin] = useParam('min', '2')
  const [copied, setCopied] = useState(false)

  const sort = (SORTS.some((s) => s.key === sortParam) ? sortParam : 'longest') as Sort
  const minLength = Number(minParam) || 2

  const threads = useMemo(() => {
    const list = store.threads.filter((t) => t.length >= minLength)
    switch (sort) {
      case 'newest': return [...list].sort((a, b) => b.at - a.at)
      case 'liked': return [...list].sort((a, b) => b.likes - a.likes)
      default: return [...list].sort((a, b) => b.length - a.length || b.at - a.at)
    }
  }, [store, minLength, sort])

  const current = useMemo(
    () => (open ? threads.findIndex((t) => t.id === open) : -1),
    [threads, open],
  )
  const thread = useMemo(
    () => (open ? store.threads.find((t) => t.id === open) ?? null : null),
    [store, open],
  )
  const tweets = useMemo(() => (open ? store.thread(open) : []), [store, open])

  const copyThread = useCallback(() => {
    if (!thread) return
    const date = new Date(thread.at).toISOString().slice(0, 10)
    const body = tweets
      .map((t, i) => `**${i + 1}/${tweets.length}**\n\n${t.text}`)
      .join('\n\n---\n\n')
    const doc =
      `# Thread — ${date}\n\n` +
      `${tweets.length} tweets · ${thread.words.toLocaleString()} words · ` +
      `[@${store.meta.handle}](${statusUrl(store.meta.handle, thread.id)})\n\n${body}\n`
    void navigator.clipboard.writeText(doc).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [thread, tweets, store.meta.handle])

  const goRelative = useCallback((step: -1 | 1) => {
    const next = threads[current + step]
    if (next) setOpen(next.id, true)
  }, [threads, current, setOpen])

  // j / k move between threads while reading, like any reader.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el?.tagName === 'INPUT' || el?.isContentEditable) return
      if (e.key === 'j') goRelative(1)
      if (e.key === 'k') goRelative(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goRelative])

  if (thread && tweets.length > 0) {
    return (
      <div className="h-full overflow-auto">
        <div className="max-w-2xl mx-auto">
          <header className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--edge)] px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setOpen(null)}
                      className="text-sm text-[var(--accent)] hover:underline">
                ← all threads
              </button>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <button onClick={copyThread}
                        className="text-[var(--text-dim)] hover:text-[var(--accent)]">
                  {copied ? 'copied' : 'copy as markdown'}
                </button>
                <a href={statusUrl(store.meta.handle, thread.id)}
                   target="_blank" rel="noreferrer noopener"
                   className="text-[var(--text-dim)] hover:text-[var(--accent)]">
                  open on x.com ↗
                </a>
              </div>
            </div>
            <p className="text-sm line-clamp-2 leading-relaxed">{thread.preview}</p>
            <p className="text-xs text-[var(--text-dim)] mt-1.5 tnum">
              {thread.length} tweets · {thread.words.toLocaleString()} words ·
              ~{thread.minutes} min · ♥ {thread.likes.toLocaleString()} ·{' '}
              {new Date(thread.at).toLocaleDateString()}
            </p>
          </header>

          {/* The spine: one line down the thread, a dot per tweet, so the
              chain reads as a single piece rather than a stack of cards. */}
          <div className="relative pl-8">
            <span className="absolute left-[13px] top-4 bottom-4 w-px bg-[var(--edge)]" aria-hidden />
            {tweets.map((t, i) => (
              <div key={t.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[22px] top-5 w-2 h-2 rounded-full bg-[var(--surface)]
                             border border-[var(--text-dim)]"
                />
                <span data-numeric className="absolute -left-8 top-[38px] text-[9px] text-[var(--text-dim)]">
                  {i + 1}
                </span>
                <TweetView tweet={t} handle={store.meta.handle} />
              </div>
            ))}
          </div>

          <nav className="flex items-center justify-between px-4 py-6 text-sm">
            <button
              onClick={() => goRelative(-1)}
              disabled={current <= 0}
              className="text-[var(--text-dim)] hover:text-[var(--accent)] disabled:opacity-30"
            >‹ previous thread</button>
            <span className="text-xs text-[var(--text-dim)] tnum">
              {current + 1} of {threads.length}
            </span>
            <button
              onClick={() => goRelative(1)}
              disabled={current < 0 || current >= threads.length - 1}
              className="text-[var(--text-dim)] hover:text-[var(--accent)] disabled:opacity-30"
            >next thread ›</button>
          </nav>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
          <div className="flex rounded-sm border border-[var(--edge)] overflow-hidden">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={`px-2.5 py-1 transition-colors ${
                  sort === s.key ? 'bg-[var(--accent)] text-[var(--bg)]'
                                 : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >{s.label}</button>
            ))}
          </div>

          <div className="flex rounded-sm border border-[var(--edge)] overflow-hidden">
            {MIN_LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => setMin(String(n))}
                aria-pressed={minLength === n}
                className={`px-2.5 py-1 tnum transition-colors ${
                  minLength === n ? 'bg-[var(--accent)] text-[var(--bg)]'
                                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >{n}+</button>
            ))}
          </div>

          <span className="ml-auto text-[var(--text-dim)]">
            <Num value={threads.length} /> threads
          </span>
        </div>

        {threads.length === 0 ? (
          <Empty
            title={`No threads of ${minLength} tweets or more.`}
            action={minLength > 2
              ? <button onClick={() => setMin('2')}
                        className="text-sm text-[var(--accent)] hover:underline">
                  Show shorter threads
                </button>
              : undefined}
          />
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => <ThreadCard key={t.id} thread={t} onOpen={() => setOpen(t.id, true)} />)}
          </ul>
        )}
      </div>
    </div>
  )
}

function ThreadCard({ thread, onOpen }: { thread: Thread; onOpen(): void }) {
  // The opening line is the closest thing a thread has to a title.
  const [title, ...rest] = thread.preview.split('\n')
  const body = rest.join(' ').trim()

  return (
    <li>
      <button
        onClick={onOpen}
        className="w-full text-left p-3 bg-[var(--surface)] border border-[var(--edge)] rounded-sm
                   hover:border-[var(--accent)] transition-colors group"
      >
        <p className="text-sm leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {title}
        </p>
        {body && (
          <p className="text-xs text-[var(--text-dim)] leading-relaxed line-clamp-2 mt-1">{body}</p>
        )}
        <div className="flex items-center gap-2.5 mt-2 text-[10px] text-[var(--text-dim)] tnum flex-wrap">
          <span className="text-[var(--accent)]">{thread.length} tweets</span>
          <span>{thread.words.toLocaleString()} words</span>
          <span>~{thread.minutes} min</span>
          {thread.likes > 0 && <span>♥ {thread.likes.toLocaleString()}</span>}
          {thread.media > 0 && <span>◧ {thread.media}</span>}
          <time className="ml-auto">{new Date(thread.at).toISOString().slice(0, 10)}</time>
        </div>
      </button>
    </li>
  )
}
