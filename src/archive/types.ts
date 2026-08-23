/**
 * The one internal shape. Nothing outside src/archive/ may touch X's JSON.
 *
 * Every field here is either present in every archive we support or explicitly
 * nullable. Where X's data is unreliable, the type says so in its name rather
 * than leaving a plain number that reads as fact.
 */

export type TweetKind = 'post' | 'reply' | 'thread' | 'retweet' | 'quote'

export interface MediaItem {
  /** X's media id, or a URL-derived hash for videos. */
  id: string
  kind: 'photo' | 'video' | 'gif'
  /** Filename inside the media directory, e.g. "123-abc.jpg". */
  file: string
  width: number
  height: number
  /** Absent when the archive references a file it does not contain. */
  present: boolean
}

export interface Entity {
  kind: 'mention' | 'hashtag' | 'url' | 'media'
  /** Display text, without the leading @ or #. */
  text: string
  /** Where it points: a handle, a tag, or an expanded URL. */
  target: string
  /** Codepoint offsets into `text`, or null when X's own offsets do not resolve. */
  start: number | null
  end: number | null
}

export interface Tweet {
  id: string
  /** Every id this tweet has had, including edit revisions. */
  aliases: string[]
  /** UTC milliseconds. */
  at: number
  text: string
  /** Lowercased, diacritic-folded, suffix-stripped. What search indexes. */
  normalized: string
  kind: TweetKind
  lang: string
  /** True when X's lang is a placeholder such as qme or zxx rather than a language. */
  langIsPlaceholder: boolean
  client: string
  likes: number
  retweets: number
  entities: Entity[]
  media: MediaItem[]
  /** Handle this replies to, when it is a reply. */
  replyTo: string | null
  /** Status id this replies to. */
  replyToId: string | null
  /** True when the parent is also ours and present in the archive. */
  parentInArchive: boolean
  /** Thread this belongs to, when it is part of one. */
  threadId: string | null
  /** Position within its thread, 1-based. */
  threadIndex: number
  /** Handle retweeted, for retweets. */
  retweetOf: string | null
  /** Status URL quoted, for quotes. */
  quoteOf: string | null
  /** True when the text was cut off by X and cannot be recovered. */
  truncated: boolean
  deleted: boolean
  /** Number of edit revisions collapsed into this record. */
  revisions: number
}

export interface Thread {
  id: string
  tweetIds: string[]
  at: number
  length: number
  /** First tweet's text, for listing. */
  preview: string
  /** Words across the whole thread. Computed once, not per render. */
  words: number
  /** Minutes at ~200 wpm, rounded up. */
  minutes: number
  likes: number
  retweets: number
  media: number
}

export interface ArchiveMeta {
  id: string
  handle: string
  displayName: string
  accountId: string
  generatedAt: string
  tweetCount: number
  mediaCount: number
  firstAt: number
  lastAt: number
  /** Data files X did not ship, so the UI can say so instead of showing zero. */
  absentFiles: string[]
  /** True when direct-message files were found and skipped. */
  hadDirectMessages: boolean
  /** Format paths that fired but have never been tested against real data. */
  unverifiedPaths: string[]
}

export interface ParsedArchive {
  meta: ArchiveMeta
  tweets: Tweet[]
  threads: Thread[]
}
