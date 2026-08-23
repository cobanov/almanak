/**
 * The query layer. These tests are also the specification any future
 * SqliteStore has to satisfy, since both sit behind the same interface.
 */

import { describe, it, expect } from 'vitest'
import { MemoryStore, parseQuery, bucketStart } from '../MemoryStore.ts'
import { emptyFilters } from '../TweetStore.ts'
import { normalizeForSearch } from '../../archive/turkish.ts'
import type { Tweet, ParsedArchive } from '../../archive/types.ts'

let seq = 0
function tweet(over: Partial<Tweet> = {}): Tweet {
  const id = over.id ?? String(++seq)
  const text = over.text ?? `tweet ${id}`
  return {
    id, aliases: [id], at: Date.UTC(2023, 0, 1), text,
    kind: 'post', lang: 'en', langIsPlaceholder: false, client: 'Twitter Web App',
    likes: 0, retweets: 0, entities: [], media: [],
    replyTo: null, replyToId: null, parentInArchive: false,
    threadId: null, threadIndex: 0, retweetOf: null, quoteOf: null,
    truncated: false, deleted: false, revisions: 1,
    ...over,
    // After the spread, so a caller passing `text` gets a matching index.
    normalized: normalizeForSearch(over.text ?? text),
  }
}

function store(tweets: Tweet[]): MemoryStore {
  const times = tweets.map((t) => t.at)
  const parsed: ParsedArchive = {
    tweets: [...tweets].sort((a, b) => a.at - b.at),
    threads: [],
    meta: {
      id: 'test', handle: 'tester', displayName: 'Tester', accountId: '1',
      generatedAt: '2026-01-01T00:00:00.000Z',
      tweetCount: tweets.length, mediaCount: 0,
      firstAt: Math.min(...times), lastAt: Math.max(...times),
      absentFiles: [], hadDirectMessages: false, unverifiedPaths: [],
    },
  }
  return new MemoryStore(parsed)
}

describe('parseQuery', () => {
  it('pulls operators out of the free text', () => {
    const q = parseQuery('"exact words" -nope from:2019 has:media rest')
    expect(q.phrases).toContain('exact words')
    expect(q.year).toBe(2019)
    expect(q.requireMedia).toBe(true)
    expect(q.exclude.length).toBeGreaterThan(0)
    expect(q.terms.join(' ')).toContain('rest')
  })

  it('does not let a phrase leak into the loose terms', () => {
    expect(parseQuery('"one two"').terms).toHaveLength(0)
  })
})

describe('bucketStart', () => {
  const at = Date.UTC(2023, 4, 17, 13, 45)
  it('snaps to the start of each granularity, in UTC', () => {
    expect(bucketStart(at, 'year')).toBe(Date.UTC(2023, 0, 1))
    expect(bucketStart(at, 'month')).toBe(Date.UTC(2023, 4, 1))
    expect(bucketStart(at, 'day')).toBe(Date.UTC(2023, 4, 17))
  })
  it('starts weeks on Monday', () => {
    // 17 May 2023 was a Wednesday.
    expect(new Date(bucketStart(at, 'week')).getUTCDay()).toBe(1)
  })
})

describe('search', () => {
  const s = store([
    tweet({ id: 'a', text: 'yeni modelini denedim' }),
    tweet({ id: 'b', text: 'IŞIK çok güzeldi' }),
    tweet({ id: 'c', text: 'nothing relevant here' }),
  ])

  it('matches an inflected Turkish form from its stem', () => {
    const hits = s.query({ ...emptyFilters(), query: 'model' })
    expect(hits.map((t) => t.id)).toContain('a')
  })

  it('matches across the dotted and dotless i', () => {
    const hits = s.query({ ...emptyFilters(), query: 'ışık' })
    expect(hits.map((t) => t.id)).toContain('b')
  })

  it('excludes with a leading minus', () => {
    const hits = s.query({ ...emptyFilters(), query: '-relevant' })
    expect(hits.map((t) => t.id)).not.toContain('c')
  })

  it('returns everything for an empty query', () => {
    expect(s.query(emptyFilters())).toHaveLength(3)
  })
})

describe('filters', () => {
  const s = store([
    tweet({ id: 'p', kind: 'post', likes: 100, client: 'Twitter for iPhone' }),
    tweet({ id: 'r', kind: 'reply', likes: 1, client: 'Twitter Web App' }),
    tweet({ id: 'm', kind: 'post', likes: 5, media: [{ id: 'x', kind: 'photo', file: 'f.jpg', width: 1, height: 1, present: true }] }),
  ])

  it('filters by kind', () => {
    const hits = s.query({ ...emptyFilters(), kinds: new Set(['reply']) })
    expect(hits.map((t) => t.id)).toEqual(['r'])
  })

  it('filters by presence of media, both ways', () => {
    expect(s.query({ ...emptyFilters(), hasMedia: true }).map((t) => t.id)).toEqual(['m'])
    expect(s.query({ ...emptyFilters(), hasMedia: false })).toHaveLength(2)
  })

  it('filters by client and by minimum likes', () => {
    expect(s.query({ ...emptyFilters(), client: 'Twitter for iPhone' }).map((t) => t.id)).toEqual(['p'])
    expect(s.query({ ...emptyFilters(), minLikes: 50 }).map((t) => t.id)).toEqual(['p'])
  })

  it('composes filters rather than replacing them', () => {
    const hits = s.query({ ...emptyFilters(), kinds: new Set(['post']), minLikes: 50 })
    expect(hits.map((t) => t.id)).toEqual(['p'])
  })

  it('agrees with count()', () => {
    const f = { ...emptyFilters(), kinds: new Set(['post' as const]) }
    expect(s.count(f)).toBe(s.query(f).length)
  })
})

describe('time-of-day filters', () => {
  // 2023-05-17 was a Wednesday: weekday index 2 in a Monday-first week.
  const s = store([
    tweet({ id: 'wed10', at: Date.UTC(2023, 4, 17, 10, 30) }),
    tweet({ id: 'wed23', at: Date.UTC(2023, 4, 17, 23, 30) }),
    tweet({ id: 'thu10', at: Date.UTC(2023, 4, 18, 10, 30) }),
  ])

  it('selects one punchcard cell', () => {
    const hits = s.query({ ...emptyFilters(), weekday: 2, hourFrom: 10, hourTo: 10, useUtc: true })
    expect(hits.map((t) => t.id)).toEqual(['wed10'])
  })

  it('selects an hour range across days', () => {
    const hits = s.query({ ...emptyFilters(), hourFrom: 0, hourTo: 11, useUtc: true })
    expect(hits.map((t) => t.id).sort()).toEqual(['thu10', 'wed10'])
  })
})

describe('range', () => {
  const s = store([
    tweet({ id: 'jan', at: Date.UTC(2023, 0, 15) }),
    tweet({ id: 'feb', at: Date.UTC(2023, 1, 15) }),
    tweet({ id: 'mar', at: Date.UTC(2023, 2, 15) }),
  ])

  it('returns the half-open interval, oldest first', () => {
    const got = s.range(Date.UTC(2023, 1, 1), Date.UTC(2023, 2, 1))
    expect(got.map((t) => t.id)).toEqual(['feb'])
  })

  it('is empty for a stretch with nothing in it', () => {
    expect(s.range(Date.UTC(2024, 0, 1), Date.UTC(2024, 1, 1))).toHaveLength(0)
  })
})

describe('buckets', () => {
  const s = store([
    tweet({ id: '1', at: Date.UTC(2023, 0, 5), kind: 'post' }),
    tweet({ id: '2', at: Date.UTC(2023, 0, 20), kind: 'reply' }),
    tweet({ id: '3', at: Date.UTC(2023, 5, 1), kind: 'post' }),
  ])

  it('splits replies out, so the track can stack them separately', () => {
    const [jan] = s.buckets('month')
    expect(jan).toMatchObject({ total: 2, posts: 1, replies: 1 })
  })

  it('aggregates a year into one bucket', () => {
    expect(s.buckets('year')).toHaveLength(1)
    expect(s.buckets('year')[0].total).toBe(3)
  })
})

describe('identity', () => {
  it('finds a tweet by an old id it had before an edit', () => {
    const s = store([tweet({ id: 'new', aliases: ['old', 'new'] })])
    expect(s.byId('old')?.id).toBe('new')
  })
})
