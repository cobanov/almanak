/**
 * Thread reconstruction from self-replies.
 *
 * A thread is a chain of tweets each replying to the previous one, all mine.
 * In the reference archive 1,276 of 1,290 self-reply edges resolve in-archive
 * and the longest chain is 18 tweets, so this is worth doing properly.
 *
 * Mutates `threadId` and `threadIndex` on the tweets it is given.
 */

import type { Tweet, Thread } from './types.ts'

export function buildThreads(tweets: Tweet[]): Thread[] {
  const byId = new Map<string, Tweet>()
  for (const t of tweets) {
    byId.set(t.id, t)
    // Edit revisions keep their old ids as aliases; a reply may point at one.
    for (const alias of t.aliases) if (!byId.has(alias)) byId.set(alias, t)
  }

  /** child id -> parent tweet, only where the parent is mine and present. */
  const parentOf = new Map<string, Tweet>()
  const children = new Map<string, Tweet[]>()

  for (const t of tweets) {
    if (!t.parentInArchive || !t.replyToId) continue
    const parent = byId.get(t.replyToId)
    if (!parent || parent.id === t.id) continue
    parentOf.set(t.id, parent)
    const list = children.get(parent.id)
    if (list) list.push(t)
    else children.set(parent.id, [t])
  }

  // A root is any tweet with children but no parent of its own.
  const roots = tweets.filter((t) => children.has(t.id) && !parentOf.has(t.id))
  const threads: Thread[] = []

  for (const root of roots) {
    // Follow the earliest child at each step: a fork is a separate reply, not
    // a continuation, and taking all of them would interleave two threads.
    const chain: Tweet[] = [root]
    let current = root
    const guard = new Set<string>([root.id])
    for (;;) {
      const next = (children.get(current.id) ?? [])
        .filter((c) => !guard.has(c.id))
        .sort((a, b) => a.at - b.at)[0]
      if (!next) break
      guard.add(next.id)
      chain.push(next)
      current = next
    }
    if (chain.length < 2) continue

    const id = root.id
    chain.forEach((t, i) => {
      t.threadId = id
      t.threadIndex = i + 1
    })

    // Reading metrics are computed here, once, rather than in the component:
    // the list sorts on them and would otherwise recount every render.
    let words = 0, likes = 0, retweets = 0, media = 0
    for (const t of chain) {
      // Links are one "word" to a reader, not the character soup of a t.co URL.
      words += t.text.replace(/https?:\/\/\S+/g, 'link').split(/\s+/).filter(Boolean).length
      likes += t.likes
      retweets += t.retweets
      media += t.media.length
    }

    threads.push({
      id,
      tweetIds: chain.map((t) => t.id),
      at: root.at,
      length: chain.length,
      preview: root.text.slice(0, 200),
      words,
      minutes: Math.max(1, Math.ceil(words / 200)),
      likes, retweets, media,
    })
  }

  threads.sort((a, b) => b.length - a.length || b.at - a.at)
  return threads
}
