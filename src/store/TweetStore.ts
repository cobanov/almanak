/**
 * The query interface. Views and analytics talk to this and nothing else, so
 * the in-memory implementation can be swapped for SQLite without touching a
 * single caller. See PLAN.md, milestone M1.5.
 */

import type { Tweet, Thread, ArchiveMeta } from '../archive/types.ts'

export type SortOrder = 'newest' | 'oldest' | 'most-liked' | 'most-retweeted'

export interface Filters {
  /** Free text. Supports "exact phrase", -exclude, from:2019, has:media. */
  query: string
  /** UTC ms, inclusive. */
  from: number | null
  to: number | null
  kinds: Set<'post' | 'reply' | 'thread' | 'retweet' | 'quote'>
  hasMedia: boolean | null
  mentions: string | null
  hashtag: string | null
  domain: string | null
  lang: string | null
  client: string | null
  minLikes: number | null
  /** 0 = Monday .. 6 = Sunday, matching the punchcard's rows. */
  weekday: number | null
  /** Inclusive hour bounds, 0-23. Set together by a punchcard cell. */
  hourFrom: number | null
  hourTo: number | null
  /** Read weekday and hour in UTC rather than local time. */
  useUtc: boolean
  sort: SortOrder
}

export function emptyFilters(): Filters {
  return {
    query: '', from: null, to: null, kinds: new Set(), hasMedia: null,
    mentions: null, hashtag: null, domain: null, lang: null, client: null,
    minLikes: null, weekday: null, hourFrom: null, hourTo: null,
    useUtc: false, sort: 'newest',
  }
}

export interface Bucket {
  /** Start of the bucket, UTC ms. */
  at: number
  total: number
  /** Counts per kind, so the timeline can stack replies separately. */
  posts: number
  replies: number
  media: number
}

export type Granularity = 'year' | 'month' | 'week' | 'day'

export interface TweetStore {
  readonly meta: ArchiveMeta
  readonly threads: Thread[]

  /** All tweets matching `filters`, sorted. */
  query(filters: Filters): Tweet[]
  /** Count only — cheaper than query() when the list is not rendered. */
  count(filters: Filters): number
  byId(id: string): Tweet | undefined
  /** Tweets of one thread, in order. */
  thread(id: string): Tweet[]
  /**
   * Tweets in [from, to), oldest first. Located by binary search over the
   * time-sorted array rather than a scan, because the timeline inspector calls
   * this on every drag frame.
   */
  range(from: number, to: number): Tweet[]
  /** Pre-aggregated buckets for the timeline, cached per granularity. */
  buckets(granularity: Granularity, filters?: Filters): Bucket[]
  /** Distinct values for filter menus, most frequent first. */
  facets(): { clients: string[]; langs: string[]; domains: string[]; mentions: string[] }
}
