/**
 * One tweet, rendered honestly.
 *
 * Two decisions here come straight from what the archive actually contains:
 *
 * - A reply's parent is not in the export. Rather than showing an orphaned
 *   fragment, the missing parent is drawn as a labelled void with a link out.
 *   Sixty per cent of a real archive is these.
 * - A retweet's text is frequently cut off mid-word and cannot be recovered.
 *   It is labelled rather than presented as if it were complete.
 */

import { useState, useEffect, memo } from 'react'
import type { Tweet } from '../archive/types.ts'
import { useMedia } from '../app/state.tsx'

const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function statusUrl(handle: string, id: string) {
  return `https://x.com/${handle}/status/${id}`
}

/**
 * Only these schemes are ever put in an href.
 *
 * X emits http(s) expanded_urls, so this is not a live vector — but the input
 * is a file the user supplies, and a malformed or hand-edited archive should
 * not be able to talk the renderer into a javascript: link.
 */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://x.com')
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}

/** Linkify mentions, hashtags and URLs using the converted entity offsets. */
function renderText(tweet: Tweet) {
  const spans = tweet.entities
    .filter((e) => e.start !== null && e.end !== null && e.kind !== 'media')
    .sort((a, b) => a.start! - b.start!)

  const out: React.ReactNode[] = []
  let cursor = 0
  spans.forEach((e, i) => {
    if (e.start! < cursor) return // overlapping entity, skip
    if (e.start! > cursor) out.push(tweet.text.slice(cursor, e.start!))
    const label = tweet.text.slice(e.start!, e.end!)
    const raw =
      e.kind === 'mention' ? `https://x.com/${encodeURIComponent(e.target)}`
      : e.kind === 'hashtag' ? `https://x.com/hashtag/${encodeURIComponent(e.target)}`
      : e.target
    const href = safeHref(raw)
    const text = e.kind === 'url' ? e.text : label

    out.push(
      href
        ? <a key={`e${i}`} href={href} target="_blank" rel="noreferrer noopener"
             className="text-[var(--accent)] hover:underline break-words">{text}</a>
        // A scheme we will not link. Show the text; do not make it clickable.
        : <span key={`e${i}`} className="break-words">{text}</span>,
    )
    cursor = e.end!
  })
  if (cursor < tweet.text.length) out.push(tweet.text.slice(cursor))
  return out
}

function MediaThumb({ file, alt, onOpen }: { file: string; alt: string; onOpen?: () => void }) {
  const loader = useMedia()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void loader.get(file).then((u) => { if (live) { setUrl(u); if (!u) setFailed(true) } })
    return () => { live = false }
  }, [file, loader])

  const isVideo = file.toLowerCase().endsWith('.mp4')

  if (failed) {
    return (
      <div className="aspect-square grid place-items-center bg-[var(--surface-lit)] border border-[var(--edge)] rounded-sm">
        <span className="text-[10px] text-[var(--text-dim)] px-2 text-center">file not in archive</span>
      </div>
    )
  }
  return (
    <button
      onClick={onOpen}
      aria-label={isVideo ? `Play video from this tweet: ${alt}` : `Open image: ${alt}`}
      className="block w-full aspect-square overflow-hidden rounded-sm bg-[var(--surface-lit)] relative"
    >
      {url && (isVideo
        ? <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        : <img src={url} alt={alt} loading="lazy" className="w-full h-full object-cover" />)}
      {isVideo && (
        <span className="absolute bottom-1 right-1 text-[10px] px-1 rounded-sm bg-black/60 text-white tnum">
          video
        </span>
      )}
    </button>
  )
}

export const TweetView = memo(function TweetView({
  tweet, handle, onOpenMedia, highlight, compact = false,
}: {
  tweet: Tweet
  handle: string
  onOpenMedia?: (tweetId: string, index: number) => void
  highlight?: string
  compact?: boolean
}) {
  const date = new Date(tweet.at)

  return (
    <article className={`${compact ? 'py-3' : 'py-4'} px-4 border-b border-[var(--edge)]`}>
      {/* The other half of the conversation, which X does not include. */}
      {tweet.kind === 'reply' && tweet.replyTo && (
        <div className="mb-2 pl-3 border-l border-dashed border-[var(--edge)] text-xs text-[var(--text-dim)]">
          replying to{' '}
          <a href={`https://x.com/${tweet.replyTo}`} target="_blank" rel="noreferrer noopener"
             className="text-[var(--accent)] hover:underline">@{tweet.replyTo}</a>
          {' · '}
          <span className="inferred">their message is not in this archive</span>
        </div>
      )}

      {tweet.threadId && tweet.threadIndex > 0 && (
        <p className="text-xs text-[var(--text-dim)] mb-2 tnum">
          thread · {tweet.threadIndex}
        </p>
      )}

      <p className={`whitespace-pre-wrap break-words leading-relaxed ${compact ? 'text-sm' : ''}`}>
        {highlight ? highlightText(tweet, highlight) : renderText(tweet)}
      </p>

      {tweet.truncated && (
        <p className="text-xs text-[var(--text-dim)] mt-2 inferred">
          cut off by x — the rest is not in the archive
        </p>
      )}

      {tweet.media.length > 0 && (
        <div className={`grid gap-1 mt-3 ${tweet.media.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-2 max-w-md'}`}>
          {tweet.media.map((m, i) => (
            <MediaThumb
              key={m.id + i} file={m.file}
              alt={tweet.text.slice(0, 120) || 'Media from this tweet'}
              onOpen={() => onOpenMedia?.(tweet.id, i)}
            />
          ))}
        </div>
      )}

      <footer className="flex items-center gap-3 mt-3 text-xs text-[var(--text-dim)]">
        <a href={statusUrl(handle, tweet.id)} target="_blank" rel="noreferrer noopener"
           className="hover:text-[var(--accent)] tnum">
          <time dateTime={date.toISOString()}>{dateFmt.format(date)}</time>
          <span className="mx-1.5 opacity-50">·</span>
          {timeFmt.format(date)}
        </a>
        <span className="opacity-50">{tweet.client}</span>
        {tweet.likes > 0 && <span className="tnum">♥ {tweet.likes.toLocaleString()}</span>}
        {tweet.retweets > 0 && <span className="tnum">↻ {tweet.retweets.toLocaleString()}</span>}
        {tweet.deleted && <span className="text-[var(--danger)]">deleted</span>}
        {tweet.revisions > 1 && (
          <span className="inferred" title={`Stored as ${tweet.revisions} revisions; showing the last`}>
            edited ×{tweet.revisions - 1}
          </span>
        )}
        <button
          onClick={() => void navigator.clipboard.writeText(
            `> ${tweet.text.replace(/\n/g, '\n> ')}\n\n— [@${handle}](${statusUrl(handle, tweet.id)}), ${dateFmt.format(date)}`,
          )}
          className="ml-auto hover:text-[var(--accent)]"
        >
          copy as markdown
        </button>
      </footer>
    </article>
  )
})

/** Wrap matches in <mark>, matching on folded text so Turkish behaves. */
function highlightText(tweet: Tweet, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1 && !t.startsWith('-') && !t.includes(':'))
  if (terms.length === 0) return renderText(tweet)

  const pattern = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi')
  const parts = tweet.text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part)
      ? <mark key={i} className="bg-[var(--accent)]/25 text-inherit rounded-[2px]">{part}</mark>
      : part,
  )
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
