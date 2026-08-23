/**
 * Thread reconstruction. X stores a thread as unconnected self-replies; the
 * chain has to be rebuilt from in_reply_to_status_id_str.
 */

import { describe, it, expect } from 'vitest'
import { buildThreads } from '../threads.ts'
import type { Tweet } from '../types.ts'

let seq = 0
function tweet(over: Partial<Tweet> = {}): Tweet {
  const id = over.id ?? String(++seq)
  return {
    id, aliases: [id], at: Number(id) * 1000, text: `tweet ${id}`, normalized: '',
    kind: 'post', lang: 'en', langIsPlaceholder: false, client: 'web',
    likes: 0, retweets: 0, entities: [], media: [],
    replyTo: null, replyToId: null, parentInArchive: false,
    threadId: null, threadIndex: 0, retweetOf: null, quoteOf: null,
    truncated: false, deleted: false, revisions: 1,
    ...over,
  }
}

/** a <- b <- c, each replying to the one before. */
function chain(ids: string[]): Tweet[] {
  return ids.map((id, i) => tweet({
    id,
    at: i * 1000,
    kind: i === 0 ? 'post' : 'thread',
    replyToId: i === 0 ? null : ids[i - 1],
    parentInArchive: i > 0,
  }))
}

describe('buildThreads', () => {
  it('links a chain and numbers it from one', () => {
    const tweets = chain(['a', 'b', 'c'])
    const threads = buildThreads(tweets)

    expect(threads).toHaveLength(1)
    expect(threads[0].tweetIds).toEqual(['a', 'b', 'c'])
    expect(tweets.map((t) => t.threadIndex)).toEqual([1, 2, 3])
    expect(tweets.every((t) => t.threadId === 'a')).toBe(true)
  })

  it('ignores a lone tweet', () => {
    expect(buildThreads([tweet()])).toHaveLength(0)
  })

  it('does not build a thread from a reply whose parent is absent', () => {
    const orphan = tweet({ replyToId: 'missing', parentInArchive: true })
    expect(buildThreads([orphan])).toHaveLength(0)
  })

  it('follows the earliest child when a tweet was replied to twice', () => {
    // A later reply to the same tweet is a separate remark, not a continuation.
    const root = tweet({ id: 'r', at: 0 })
    const first = tweet({ id: 'first', at: 100, replyToId: 'r', parentInArchive: true })
    const later = tweet({ id: 'later', at: 900, replyToId: 'r', parentInArchive: true })
    const threads = buildThreads([root, first, later])

    expect(threads[0].tweetIds).toEqual(['r', 'first'])
    expect(later.threadId).toBeNull()
  })

  it('computes the reading metrics the list sorts on', () => {
    const tweets = chain(['a', 'b'])
    tweets[0].text = 'one two three four five'
    tweets[1].text = 'six seven'
    tweets[0].likes = 10
    tweets[1].likes = 5
    const [thread] = buildThreads(tweets)

    expect(thread.words).toBe(7)
    expect(thread.likes).toBe(15)
    expect(thread.minutes).toBeGreaterThanOrEqual(1)
  })

  it('counts a link as one word rather than as its characters', () => {
    const tweets = chain(['a', 'b'])
    tweets[0].text = 'look https://t.co/abcdefghij'
    tweets[1].text = 'end'
    expect(buildThreads(tweets)[0].words).toBe(3)
  })

  it('survives a reply that points at itself', () => {
    const loop = tweet({ id: 'x', replyToId: 'x', parentInArchive: true })
    expect(() => buildThreads([loop])).not.toThrow()
  })

  it('orders threads longest first', () => {
    const short = chain(['s1', 's2'])
    const long = chain(['l1', 'l2', 'l3', 'l4'])
    const threads = buildThreads([...short, ...long])
    expect(threads.map((t) => t.length)).toEqual([4, 2])
  })
})
